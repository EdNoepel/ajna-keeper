import './subgraph-mock';
import { getLoansToKick, kick } from '../kick';
import { AjnaSDK, FungiblePool } from '@ajna-finance/sdk';
import { MAINNET_CONFIG } from './test-config';
import { configureAjna } from '../config';
import {
  getProvider,
  resetHardhat,
  increaseTime,
  impersonateSigner,
  depositQuoteToken,
  takeLoan,
} from './test-utils';
import { makeGetLoansFromSdk, overrideGetLoans } from './subgraph-mock';
import { expect } from 'chai';

// import spies from 'chai-spies';
// chai.use(spies);

describe('getLoansToKick', () => {
  before(async () => {
    await resetHardhat();
  });

  it('Returns empty array when all loans are in good health.', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
    );
    overrideGetLoans(makeGetLoansFromSdk(pool));
    const loansToKick = await getLoansToKick({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      price: 1,
      config: {
        subgraphUrl: '',
      },
    });
    expect(loansToKick).to.be.empty;
  });

  it('Returns loan when loan is in bad health', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
    );
    overrideGetLoans(makeGetLoansFromSdk(pool));

    await increaseTime(3.154e7 * 2); // Increase timestamp by 10 years.

    const loansToKick = await getLoansToKick({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      price: 0,
      config: {
        subgraphUrl: '',
      },
    });
    expect(loansToKick).to.not.be.empty;
  });

  it('Returns loan when loan is in bad health', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
    );
    overrideGetLoans(makeGetLoansFromSdk(pool));

    await depositQuoteToken(
      pool,
      MAINNET_CONFIG.WBTC_USDC_POOL.quoteWhaleAddress,
      1,
      0.07
    );
    console.log('deposit successful');
    await takeLoan(
      pool,
      MAINNET_CONFIG.WBTC_USDC_POOL.collateralWhaleAddress,
      14,
      1
    );
    console.log('got this far');
  });
});

describe('kick', () => {
  before(async () => {
    await resetHardhat();
  });

  it('Kicks loan', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
    );
    const signer = await impersonateSigner(
      MAINNET_CONFIG.WBTC_USDC_POOL.quoteWhaleAddress
    );
    overrideGetLoans(makeGetLoansFromSdk(pool));
    await increaseTime(3.154e7 * 2); // Increase timestamp by 10 years.
    const loansToKick = await getLoansToKick({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
      price: 1,
      config: {
        subgraphUrl: '',
      },
    });
    const loanToKick = loansToKick[0];

    await kick({
      pool,
      signer,
      loanToKick,
      config: {
        dryRun: false,
      },
      price: 1,
    });
  });
});
