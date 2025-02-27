import { BigNumber, Signer } from 'ethers';
import {
  ExchangeRewardOnUniswap,
  KeeperConfig,
  RewardAction,
  RewardActionLabel,
  TransferReward,
} from './config-types';
import uniswap from './uniswap';
import { logger } from './logging';
import { DexRouter } from './dex-router';
import { delay, tokenChangeDecimals, weiToDecimaled } from './utils';
import { getDecimalsErc20, transferErc20 } from './erc20';
import { FeeAmount } from '@uniswap/v3-sdk';
import { TokenConfig } from './echange-tracker';

export function deterministicJsonStringify(obj: any): string {
  // Note: this works fine as long as the object is not nested.
  const determineObj: { [key: string]: any } = {};
  const sortedKeys = Object.keys(obj).sort();
  for (const key of sortedKeys) {
    determineObj[key] = obj[key];
  }
  return JSON.stringify(determineObj);
}

function serializeRewardAction(
  rewardAction: RewardAction,
  token: string
): string {
  const key = deterministicJsonStringify({ token, ...rewardAction });
  return key;
}

function deserializeRewardAction(serial: string): {
  rewardAction: RewardAction;
  token: string;
} {
  const { token, ...rewardAction } = JSON.parse(serial);
  if (!(typeof token == 'string')) {
    throw new Error(`Could not deserialize token from ${serial}`);
  }
  return { token, rewardAction };
}

export class RewardActionTracker {
  private feeTokenAmountMap: Map<string, BigNumber> = new Map();
  
  constructor(
    private signer: Signer,
    private config: Pick<
    KeeperConfig,
    'uniswapOverrides' | 'delayBetweenActions'
    >,
    private dexRouter: DexRouter,
  ) {}

  private async swapToken(chainId: number, tokenAddress: string, amount: BigNumber, targetToken: string, useOneInch: boolean, slippage: number): Promise<void> {
    const tokenAddresses = {
      avax: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
      usdc: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E",
      weth: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2"
    };
    const address = await this.signer.getAddress();
  
    const targetAddress = chainId === 43114 && targetToken in tokenAddresses
      ? tokenAddresses[targetToken as keyof typeof tokenAddresses]
      : this.config.uniswapOverrides?.wethAddress;

    if (targetAddress) {
      await this.dexRouter.swap(chainId, amount, tokenAddress, targetAddress, address, useOneInch, slippage);
    }
  }

  public async handleRewardsForToken(token: TokenConfig, chainId: number): Promise<void> {
    const amount = BigNumber.from("10000000000000000000");
    const tokenAddress = token.address.toLowerCase();
    const useOneInch = token.useOneInch !== undefined ? token.useOneInch : (chainId === 43114);

    await this.swapToken(chainId, tokenAddress, amount, token.targetToken, useOneInch, token.slippage);
  }

  public async handleAllTokens() {
    const nonZeroEntries = Array.from(this.feeTokenAmountMap.entries()).filter(
      ([key, amountWad]) => amountWad.gt(BigNumber.from('0'))
    );
    for (const [key, amountWad] of nonZeroEntries) {
      const { rewardAction, token } = deserializeRewardAction(key);
      if (rewardAction.action == RewardActionLabel.TRANSFER) {
        await this.transferReward(rewardAction, token, amountWad);
      } // else if (rewardAction.action == RewardActionLabel.EXCHANGE_ON_UNISWAP) {
      //   await this.swapOnUniswap(rewardAction, token, amountWad);
      // }
    }
  }

  addToken(
    rewardAction: RewardAction,
    tokenCollected: string,
    amountWadToAdd: BigNumber
  ) {
    const key = serializeRewardAction(rewardAction, tokenCollected);
    const currAmount = this.feeTokenAmountMap.get(key) ?? BigNumber.from('0');
    this.feeTokenAmountMap.set(key, currAmount.add(amountWadToAdd));
  }

  removeToken(
    rewardAction: RewardAction,
    tokenCollected: string,
    amountWadToSub: BigNumber
  ) {
    const key = serializeRewardAction(rewardAction, tokenCollected);
    const currAmount = this.feeTokenAmountMap.get(key) ?? BigNumber.from('0');
    this.feeTokenAmountMap.set(key, currAmount.sub(amountWadToSub));
  }

  // async swapOnUniswap(
  //   rewardAction: ExchangeRewardOnUniswap,
  //   token: string,
  //   amountWad: BigNumber
  // ) {
  //   try {
  //     await uniswap.swapToWeth(
  //       this.signer,
  //       token,
  //       amountWad,
  //       rewardAction.fee,
  //       this.config.uniswapOverrides
  //     );
  //     this.removeToken(rewardAction, token, amountWad);
  //     logger.info(
  //       `Successfully exchanged token on Uniswap. token: ${token}, fee: ${rewardAction.fee / 10000}%, amountWad: ${weiToDecimaled(amountWad)}`
  //     );
  //     await delay(this.config.delayBetweenActions);
  //   } catch (error) {
  //     logger.error(
  //       `Failed to exchange token on Uniswap. token: ${token}, amountWad: ${weiToDecimaled(amountWad)}`,
  //       error
  //     );
  //   }
  // }

  async transferReward(
    rewardAction: TransferReward,
    token: string,
    amountWad: BigNumber
  ) {
    try {
      logger.debug(
        `Sending reward token to ${rewardAction.to}, amountWad: ${weiToDecimaled(amountWad)}, tokenAddress: ${token}`
      );
      const decimals = await getDecimalsErc20(this.signer, token);
      const amount = tokenChangeDecimals(amountWad, 18, decimals);
      await transferErc20(this.signer, token, rewardAction.to, amount);
      this.removeToken(rewardAction, token, amountWad);
      logger.info(
        `Successfully transfered reward token to ${rewardAction.to}, amountWad: ${weiToDecimaled(amountWad)}, tokenAddress: ${token}`
      );
    } catch (error) {
      logger.error(
        `Failed to transfer token to ${rewardAction.to}, amountWad: ${weiToDecimaled(amountWad)}, tokenAddress: ${token}`,
        error
      );
    }
  }
}
