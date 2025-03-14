import {
  ERC20Pool__factory,
  FungiblePool,
  indexToPrice,
  min,
  Signer,
  wdiv,
} from '@ajna-finance/sdk';
import { TypedListener } from '@ajna-finance/sdk/dist/types/contracts/common';
import {
  BucketTakeLPAwardedEvent,
  BucketTakeLPAwardedEventFilter,
  ERC20Pool,
} from '@ajna-finance/sdk/dist/types/contracts/ERC20Pool';
import { BigNumber, constants } from 'ethers';
import { KeeperConfig, PoolConfig, TokenToCollect } from './config-types';
import { logger } from './logging';
import { RewardActionTracker } from './reward-action-tracker';
import {
  bucketRemoveCollateralToken,
  bucketRemoveQuoteToken,
} from './transactions';
import { decimaledToWei, weiToDecimaled } from './utils';

/**
 * Collects lp rewarded from BucketTakes without collecting the user's deposits or loans.
 */
export class LpCollector {
  public lpMap: Map<number, BigNumber> = new Map(); // Map<bucketIndexString, rewardLp>
  public poolContract: ERC20Pool;
  public kickerAwardEvt: Promise<BucketTakeLPAwardedEventFilter>;
  public takerAwardEvt: Promise<BucketTakeLPAwardedEventFilter>;

  private started: boolean = false;

  constructor(
    private pool: FungiblePool,
    private signer: Signer,
    private poolConfig: Required<Pick<PoolConfig, 'collectLpReward'>>,
    private config: Pick<KeeperConfig, 'dryRun'>,
    private exchangeTracker: RewardActionTracker
  ) {
    const poolContract = ERC20Pool__factory.connect(
      this.pool.poolAddress,
      this.signer
    );
    this.poolContract = poolContract;
    this.takerAwardEvt = (async () => {
      const signerAddress = await this.signer.getAddress();
      return poolContract.filters.BucketTakeLPAwarded(signerAddress);
    })();
    this.kickerAwardEvt = (async () => {
      const signerAddress = await this.signer.getAddress();
      return poolContract.filters.BucketTakeLPAwarded(undefined, signerAddress);
    })();
  }

  public async startSubscription() {
    if (!this.started) {
      await this.subscribeToLpRewards();
      this.started = true;
    }
  }

  public async stopSubscription() {
    if (this.started) {
      this.stopSubscriptionToLpRewards();
      this.started = false;
    }
  }

  public async collectLpRewards() {
    if (!this.started)
      throw new Error('Must start subscriptions before collecting rewards');
    const lpMapEntries = Array.from(this.lpMap.entries()).filter(
      ([bucketIndex, rewardLp]) => rewardLp.gt(constants.Zero)
    );
    for (let [bucketIndex, rewardLp] of lpMapEntries) {
      const lpConsumed = await this.collectLpRewardFromBucket(
        bucketIndex,
        rewardLp
      );
      this.subtractReward(bucketIndex, lpConsumed);
    }
  }

  /**
   * Collects the lpReward from bucket. Returns amount of lp used.
   * @param bucketIndex
   * @param rewardLp
   * @resolves the amount of lp used while redeeming rewards.
   */
  private async collectLpRewardFromBucket(
    bucketIndex: number,
    rewardLp: BigNumber
  ): Promise<BigNumber> {
    const { redeemAs, minAmount, rewardAction } =
      this.poolConfig.collectLpReward;
    const signerAddress = await this.signer.getAddress();
    const bucket = await this.pool.getBucketByIndex(bucketIndex);
    const { exchangeRate, collateral } = await bucket.getStatus();
    const { lpBalance, depositWithdrawable } =
      await bucket.getPosition(signerAddress);
    if (lpBalance.lt(rewardLp)) rewardLp = lpBalance;

    if (redeemAs === TokenToCollect.QUOTE) {
      const rewardQuote = await bucket.lpToQuoteTokens(rewardLp);
      const quoteToWithdraw = min(depositWithdrawable, rewardQuote);
      if (quoteToWithdraw.gt(decimaledToWei(minAmount))) {
        if (this.config.dryRun) {
          logger.info(
            `DryRun - would collect LP reward as quote. pool: ${this.pool.name}`
          );
        } else {
          try {
            logger.debug(
              `Collecting LP reward as quote. pool: ${this.pool.name}`
            );
            await bucketRemoveQuoteToken(bucket, this.signer, quoteToWithdraw);
            logger.info(
              `Collected LP reward as quote. pool: ${this.pool.name}, amount: ${weiToDecimaled(quoteToWithdraw)}`
            );

            if (rewardAction) {
              this.exchangeTracker.addToken(
                rewardAction,
                this.pool.quoteAddress,
                quoteToWithdraw
              );
            }

            return wdiv(quoteToWithdraw, exchangeRate);
          } catch (error) {
            logger.error(
              `Failed to collect LP reward as quote. pool: ${this.pool.name}`,
              error
            );
          }
        }
      }
    } else {
      const rewardCollateral = await bucket.lpToCollateral(rewardLp);
      const collateralToWithdraw = min(rewardCollateral, collateral);
      if (collateralToWithdraw.gt(decimaledToWei(minAmount))) {
        if (this.config.dryRun) {
          logger.info(
            `DryRun - Would collect LP reward as collateral. pool: ${this.pool.name}`
          );
        } else {
          try {
            logger.debug(
              `Collecting LP reward as collateral. pool ${this.pool.name}`
            );
            await bucketRemoveCollateralToken(
              bucket,
              this.signer,
              collateralToWithdraw
            );
            logger.info(
              `Collected LP reward as collateral. pool: ${this.pool.name}, token: ${this.pool.collateralSymbol}, amount: ${weiToDecimaled(collateralToWithdraw)}`
            );

            if (rewardAction) {
              this.exchangeTracker.addToken(
                rewardAction,
                this.pool.collateralAddress,
                collateralToWithdraw
              );
            }

            const price = indexToPrice(bucketIndex);
            return wdiv(wdiv(collateralToWithdraw, price), exchangeRate);
          } catch (error) {
            logger.error(
              `Failed to collect LP reward as collateral. pool: ${this.pool.name}`,
              error
            );
          }
        }
      }
    }
    return constants.Zero;
  }

  private async subscribeToLpRewards() {
    this.poolContract.on(await this.takerAwardEvt, this.onTakerAwardEvent);
    this.poolContract.on(await this.kickerAwardEvt, this.onKickerAwardEvent);
  }

  private async stopSubscriptionToLpRewards() {
    this.poolContract.off(await this.takerAwardEvt, this.onTakerAwardEvent);
    this.poolContract.off(await this.kickerAwardEvt, this.onKickerAwardEvent);
  }

  private onTakerAwardEvent: TypedListener<BucketTakeLPAwardedEvent> = async (
    taker,
    kicker,
    lpAwardedTaker,
    lpAwardedKicker,
    evt
  ) => {
    const bucketIndex = await this.getBucketTakeBucketIndex(evt);
    this.addReward(bucketIndex, lpAwardedTaker);
  };

  private onKickerAwardEvent: TypedListener<BucketTakeLPAwardedEvent> = async (
    taker,
    kicker,
    lpAwardedTaker,
    lpAwardedKicker,
    evt
  ) => {
    const bucketIndex = await this.getBucketTakeBucketIndex(evt);
    this.addReward(bucketIndex, lpAwardedKicker);
  };

  private addReward(index: BigNumber, rewardLp: BigNumber) {
    if (rewardLp.eq(constants.Zero)) return;
    const bucketIndex = parseInt(index.toString());
    const prevReward = this.lpMap.get(bucketIndex) ?? constants.Zero;
    const sumReward = prevReward.add(rewardLp);
    logger.info(
      `Received LP Rewards in pool: ${this.pool.name}, bucketIndex: ${index}, rewardLp: ${rewardLp}`
    );
    this.lpMap.set(bucketIndex, sumReward);
  }

  private subtractReward(bucketIndex: number, lp: BigNumber) {
    const prevReward = this.lpMap.get(bucketIndex) ?? constants.Zero;
    const newReward = prevReward.sub(lp);
    if (newReward.lte(constants.Zero)) {
      this.lpMap.delete(bucketIndex);
    } else {
      this.lpMap.set(bucketIndex, newReward);
    }
  }

  private getBucketTakeBucketIndex = async (evt: BucketTakeLPAwardedEvent) => {
    const poolContract = ERC20Pool__factory.connect(
      this.pool.poolAddress,
      this.signer
    );
    const tx = await evt.getTransaction();
    const parsedTransaction = poolContract.interface.parseTransaction(tx);
    if (parsedTransaction.functionFragment.name !== 'bucketTake') {
      throw new Error(
        `Cannot get bucket index from transaction: ${parsedTransaction.functionFragment.name}`
      );
    }
    const [borrower, depositTake, index] = parsedTransaction.args as [
      string,
      boolean,
      BigNumber,
    ];
    return index;
  };
}
