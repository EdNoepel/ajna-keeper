import { getLoansToKick, handleKicks, kick } from '../kick';
import { AjnaSDK, FungiblePool } from '@ajna-finance/sdk';
import { MAINNET_CONFIG, USER1_MNEMONIC } from './test-config';
import { configureAjna } from '../config';
import {
  getProvider,
  resetHardhat,
  increaseTime,
  impersonateSigner,
  setBalance,
  DURATION,
} from './test-utils';
import {
  makeGetLiquidationsFromSdk,
  makeGetLoansFromSdk,
  makeGetRewardsFromSdk,
  overrideGetLiquidations,
  overrideGetLoans,
  overrideGetRewards,
} from './subgraph-mock';
import { expect } from 'chai';
import {
  arbTakeLiquidation,
  getLiquidationsToArbTake,
  handleArbTakes,
} from '../take';
import { Wallet } from 'ethers';
import { decimaledToWei, weiToDecimaled } from '../utils';
import { depositQuoteToken, drawDebt } from './loan-helpers';
import { getBalanceOfErc20 } from '../erc20';
import subgraph from '../subgraph';
import { handleCollect } from '../collect';

const setup = async () => {
  configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
  const ajna = new AjnaSDK(getProvider());
  const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
    MAINNET_CONFIG.SOL_WETH_POOL.poolConfig.address
  );
  overrideGetLoans(makeGetLoansFromSdk(pool));
  overrideGetLiquidations(makeGetLiquidationsFromSdk(pool));
  overrideGetRewards(makeGetRewardsFromSdk(pool));
  await depositQuoteToken({
    pool,
    owner: MAINNET_CONFIG.SOL_WETH_POOL.quoteWhaleAddress,
    amount: 1,
    price: 0.07,
  });
  await drawDebt({
    pool,
    owner: MAINNET_CONFIG.SOL_WETH_POOL.collateralWhaleAddress,
    amountToBorrow: 0.9,
    collateralToPledge: 14,
  });
  await increaseTime(DURATION.year * 2);
  const signer = await impersonateSigner(
    MAINNET_CONFIG.SOL_WETH_POOL.quoteWhaleAddress2
  );
  setBalance(
    MAINNET_CONFIG.SOL_WETH_POOL.quoteWhaleAddress2,
    '100000000000000000000'
  );
  await handleKicks({
    pool,
    poolConfig: MAINNET_CONFIG.SOL_WETH_POOL.poolConfig,
    price: 0,
    signer,
    config: {
      dryRun: false,
      subgraphUrl: '',
      delayBetweenActions: 0,
    },
  });

  await increaseTime(DURATION.day * 1);
  await handleArbTakes({
    pool,
    signer,
    poolConfig: MAINNET_CONFIG.SOL_WETH_POOL.poolConfig,
    config: {
      dryRun: false,
      subgraphUrl: '',
      delayBetweenActions: 0,
    },
  });

  return pool;
};

describe.only('collectTakeRewards', () => {
  beforeEach(async () => {
    await resetHardhat();
  });

  it('withdraws lp balance', async () => {
    const pool = await setup();
    const signer = await impersonateSigner(
      MAINNET_CONFIG.SOL_WETH_POOL.quoteWhaleAddress2
    );
    const quoteBalanceBefore = await getBalanceOfErc20(
      signer,
      pool.quoteAddress
    );
    const collateralBalanceBefore = await getBalanceOfErc20(
      signer,
      pool.collateralAddress
    );
    const rewardsResponse = await subgraph.getRewards(
      '',
      pool.poolAddress,
      MAINNET_CONFIG.SOL_WETH_POOL.quoteWhaleAddress2
    );
    console.log(rewardsResponse);
    await handleCollect({
      pool,
      poolConfig: MAINNET_CONFIG.SOL_WETH_POOL.poolConfig,
      signer,
      config: {
        subgraphUrl: '',
      },
    });
    const quoteBalanceAfter = await getBalanceOfErc20(
      signer,
      pool.quoteAddress
    );
    const collateralBalanceAfter = await getBalanceOfErc20(
      signer,
      pool.collateralAddress
    );
    console.log({
      collateralBalanceAfter,
      collateralBalanceBefore,
      quoteBalanceAfter,
      quoteBalanceBefore,
    });
    expect(quoteBalanceBefore.lt(quoteBalanceAfter)).to.be.true;
  });
});
