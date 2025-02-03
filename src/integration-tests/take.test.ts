import './subgraph-mock';
import { getLoansToKick, handleKicks, kick } from '../kick';
import { AjnaSDK, FungiblePool } from '@ajna-finance/sdk';
import { MAINNET_CONFIG } from './test-config';
import { configureAjna } from '../config';
import {
  getProvider,
  resetHardhat,
  increaseTime,
  impersonateSigner,
  mine,
} from './test-utils';
import {
  makeGetLiquidationsFromSdk,
  makeGetLoansFromSdk,
  overrideGetLiquidations,
  overrideGetLoans,
} from './subgraph-mock';
import { expect } from 'chai';
import { getLiquidationsToArbTake } from '../take';

const setup = async () => {
  configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
  const ajna = new AjnaSDK(getProvider());
  const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
    MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
  );
  overrideGetLiquidations(makeGetLiquidationsFromSdk(pool));
  return pool;
};

const setupKickedLoans = async (pool: FungiblePool) => {
  const signer = await impersonateSigner(
    MAINNET_CONFIG.WBTC_USDC_POOL.quoteWhaleAddress
  );
  overrideGetLoans(makeGetLoansFromSdk(pool));
  await increaseTime(3.154e7 * 2); // Increase timestamp by 10 years.
  await handleKicks({
    pool,
    poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
    price: 0,
    signer,
    config: {
      dryRun: false,
      subgraphUrl: '',
      delayBetweenActions: 0,
    },
  });
};

describe('getLiquidationsToArbTake', () => {
  before(async () => {
    await resetHardhat();
  });

  it('gets nothing when there arent any kicked loans', async () => {
    const pool = await setup();
    const liquidationsToArbTake = await getLiquidationsToArbTake({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      config: {
        subgraphUrl: '',
      },
    });
    expect(liquidationsToArbTake).to.be.empty;
  });

  it.only('gets loans when there are kicked loans', async () => {
    const pool = await setup();
    await setupKickedLoans(pool);
    await mine();
    const liquidationsToArbTake = await getLiquidationsToArbTake({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      config: {
        subgraphUrl: '',
      },
    });
    expect(liquidationsToArbTake).to.not.be.empty;
  });
});
