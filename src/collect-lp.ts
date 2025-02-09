import {
  Signer,
  FungiblePool,
  ERC20Pool__factory,
  indexToPrice,
  wdiv,
  min,
} from '@ajna-finance/sdk';
import { KeeperConfig, PoolConfig, TokenToCollect } from './config';
import { TypedListener } from '@ajna-finance/sdk/dist/types/contracts/common';
import { BucketTakeLPAwardedEvent } from '@ajna-finance/sdk/dist/types/contracts/ERC20Pool';
import { BigNumber } from 'ethers';
import { decimaledToWei, RequireFields, weiToDecimaled } from './utils';

/**
 * Collects lp rewarded from BucketTakes without collecting the user's deposits or loans.
 */
export class LpCollector {
  public lpMap: Map<number, BigNumber> = new Map(); // Map<bucketIndexString, rewardLp>

  private started: boolean = false;

  constructor(
    private pool: FungiblePool,
    private signer: Signer,
    private poolConfig: Required<Pick<PoolConfig, 'collectLpReward'>>
  ) {}

  public async startSubscription() {
    if (!this.started) {
      await this._subscribeToLpRewards();
      this.started = true;
    }
  }

  public async collectLpRewards() {
    const lpMapEntries = Array.from(this.lpMap.entries()).filter(
      ([bucketIndex, rewardLp]) => rewardLp.gt(BigNumber.from('0'))
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
    const { redeemAs, minAmount } = this.poolConfig.collectLpReward;
    const signerAddress = await this.signer.getAddress();
    const bucket = await this.pool.getBucketByIndex(bucketIndex);
    const { exchangeRate, collateral } = await bucket.getStatus();
    const { lpBalance, depositWithdrawable } =
      await bucket.getPosition(signerAddress);
    if (lpBalance.lt(rewardLp)) rewardLp = lpBalance;

    if (redeemAs == TokenToCollect.QUOTE) {
      const rewardQuote = await bucket.lpToQuoteTokens(rewardLp);
      const quoteToWithdraw = min(depositWithdrawable, rewardQuote);
      if (quoteToWithdraw.gt(decimaledToWei(minAmount))) {
        const withdrawQuoteTx = await bucket.removeQuoteToken(
          this.signer,
          quoteToWithdraw
        );
        await withdrawQuoteTx.verifyAndSubmit();
        console.log(
          `Collected LP Reward as Quote. pool: ${this.pool.name}, token: ${this.pool.quoteSymbol}, amount: ${weiToDecimaled(quoteToWithdraw)}`
        );
        return wdiv(quoteToWithdraw, exchangeRate);
      }
    } else {
      const rewardCollateral = await bucket.lpToCollateral(rewardLp);
      const collateralToWithdraw = min(rewardCollateral, collateral);
      if (collateralToWithdraw.gt(decimaledToWei(minAmount))) {
        const withdrawCollateralTx = await bucket.removeQuoteToken(
          this.signer,
          collateralToWithdraw
        );
        await withdrawCollateralTx.verifyAndSubmit();
        console.log(
          `Collected LP Reward as Collateral. pool: ${this.pool.name}, token: ${this.pool.collateralSymbol}, amount: ${weiToDecimaled(collateralToWithdraw)}`
        );
        const price = indexToPrice(bucketIndex);
        return wdiv(wdiv(collateralToWithdraw, price), exchangeRate);
      }
    }
    return BigNumber.from('0');
  }

  private async _subscribeToLpRewards() {
    const poolContract = ERC20Pool__factory.connect(
      this.pool.poolAddress,
      this.signer
    );
    const signerAddress = await this.signer.getAddress();
    const takerAwardEvt =
      poolContract.filters.BucketTakeLPAwarded(signerAddress);
    const kickerAwardEvt = poolContract.filters.BucketTakeLPAwarded(
      undefined,
      signerAddress
    );
    const awardEvt = poolContract.filters.BucketTakeLPAwarded();
    poolContract.on(takerAwardEvt, this.onTakerAwardEvent);
    poolContract.on(kickerAwardEvt, this.onKickerAwardEvent);
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
    if (rewardLp.eq(BigNumber.from('0'))) return;
    const bucketIndex = parseInt(index.toString());
    const prevReward = this.lpMap.get(bucketIndex) ?? BigNumber.from('0');
    const sumReward = prevReward.add(rewardLp);
    this.lpMap.set(bucketIndex, sumReward);
  }

  private subtractReward(bucketIndex: number, lp: BigNumber) {
    const prevReward = this.lpMap.get(bucketIndex) ?? BigNumber.from('0');
    const newReward = prevReward.sub(lp);
    if (newReward.lte(BigNumber.from('0'))) {
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
    if (parsedTransaction.functionFragment.name != 'bucketTake') {
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
