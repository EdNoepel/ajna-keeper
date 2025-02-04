import './subgraph-mock';
import { getLoansToKick, handleKicks, kick } from '../kick';
import { AjnaSDK, FungiblePool } from '@ajna-finance/sdk';
import { MAINNET_CONFIG, USER1_MNEMONIC } from './test-config';
import { configureAjna } from '../config';
import {
  getProvider,
  resetHardhat,
  increaseTime,
  impersonateSigner,
  mine,
  setBalance,
} from './test-utils';
import {
  makeGetLiquidationsFromSdk,
  makeGetLoansFromSdk,
  overrideGetLiquidations,
  overrideGetLoans,
} from './subgraph-mock';
import { expect } from 'chai';
import { arbTakeLiquidation, getLiquidationsToArbTake } from '../take';
import { Wallet } from 'ethers';
import { decimaledToWei, weiToDecimaled } from '../utils';

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
    await increaseTime(86400 * 1); // Increase timestamp by 2 days.
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

describe.only('arbTakeLiquidation', () => {
  before(async () => {
    await resetHardhat();
  });

  it('Takes liquidations', async () => {
    const pool = await setup();
    await setupKickedLoans(pool);
    await increaseTime(86400 * 1); // Increase timestamp by 1 day.
    const signer = await impersonateSigner(
      await Wallet.fromMnemonic(USER1_MNEMONIC).getAddress()
    );

    setBalance(await signer.getAddress(), decimaledToWei(1).toHexString());
    const liquidationsToArbTake = await getLiquidationsToArbTake({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      config: {
        subgraphUrl: '',
      },
    });
    const initialLiquidationsSize = liquidationsToArbTake.length;
    expect(initialLiquidationsSize).to.be.greaterThan(0);
    const firstLiquidation = liquidationsToArbTake[0];
    await arbTakeLiquidation({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      signer,
      config: {
        dryRun: false,
      },
      liquidation: firstLiquidation,
    });
    const bucket = await pool.getBucketByIndex(firstLiquidation.hpbIndex);
    const lpBalance = await bucket.lpBalance(await signer.getAddress());
    expect(weiToDecimaled(lpBalance)).to.be.greaterThan(0);
  });
});
