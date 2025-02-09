import './subgraph-mock';
import {
  AjnaSDK,
  ERC20Pool__factory,
  FungiblePool,
  Signer,
} from '@ajna-finance/sdk';
import { MAINNET_CONFIG } from './test-config';
import { configureAjna, TokenToCollect } from '../config';
import {
  getProvider,
  resetHardhat,
  increaseTime,
  impersonateSigner,
} from './test-utils';
import {
  makeGetLiquidationsFromSdk,
  makeGetLoansFromSdk,
  overrideGetLiquidations,
  overrideGetLoans,
} from './subgraph-mock';
import { expect } from 'chai';
import { delay, weiToDecimaled } from '../utils';
import { depositQuoteToken, drawDebt } from './loan-helpers';
import { collectBondFromPool } from '../collect-bond';
import { handleKicks } from '../kick';
import { handleArbTakes } from '../take';
import { LpCollector } from '../collect-lp';
import { BigNumber } from 'ethers';

const setup = async () => {
  configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
  const ajna = new AjnaSDK(getProvider());
  const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
    MAINNET_CONFIG.SOL_WETH_POOL.poolConfig.address
  );
  overrideGetLoans(makeGetLoansFromSdk(pool));
  overrideGetLiquidations(makeGetLiquidationsFromSdk(pool));
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
  await increaseTime(3.154e7 * 2);
  const signer = await impersonateSigner(
    MAINNET_CONFIG.SOL_WETH_POOL.collateralWhaleAddress2
  );
  await handleKicks({
    pool,
    poolConfig: MAINNET_CONFIG.SOL_WETH_POOL.poolConfig,
    signer,
    config: {
      dryRun: false,
      subgraphUrl: '',
      pricing: {
        coinGeckoApiKey: '',
      },
      delayBetweenActions: 0,
    },
  });
  await increaseTime(86400 * 2);
  return pool;
};

describe.only('LpCollector', () => {
  beforeEach(async () => {
    await resetHardhat();
  });

  it('Tracks reward after BucketTake', async () => {
    const pool = await setup();
    const signer = await impersonateSigner(
      MAINNET_CONFIG.SOL_WETH_POOL.collateralWhaleAddress2
    );
    const lpCollector = new LpCollector(pool, signer, {
      collectLpReward: {
        redeemAs: TokenToCollect.QUOTE,
        minAmount: 0,
      },
    });
    await lpCollector.startSubscription();
    await delay(5);
    await handleArbTakes({
      pool,
      poolConfig: MAINNET_CONFIG.SOL_WETH_POOL.poolConfig,
      signer,
      config: {
        dryRun: false,
        subgraphUrl: '',
        delayBetweenActions: 0,
      },
    });
    await delay(5);
    const entries = Array.from(lpCollector.lpMap.entries());
    const rewardLp = weiToDecimaled(entries[0][1]);
    expect(rewardLp).greaterThan(0);
  });
});
