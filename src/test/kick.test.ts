import './subgraph-mock';
import { getLoansToKick } from '../kick';
import { AjnaSDK, FungiblePool } from '@ajna-finance/sdk';
import { MAINNET_CONFIG } from './test-config';
import { configureAjna } from '../config';
import { getProvider, resetHardhat, increaseTime } from './test-utils';
import { makeGetLoansFromSdk, overrideGetLoans } from './subgraph-mock';
import { expect } from 'chai';
import { numberToWad } from '../utils';
import { BigNumber } from 'ethers';

// import spies from 'chai-spies';
// chai.use(spies);

describe.only('getLoansToKick', () => {
  before(async () => {
    await resetHardhat();
  });

  it('Returns empty array when all loans are in good health.', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
    );
    overrideGetLoans(makeGetLoansFromSdk(pool, 10));
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

  // it.only('Returns loan when loan is in bad health', async () => {
  //   configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
  //   const ajna = new AjnaSDK(getProvider());
  //   const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
  //     MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
  //   );
  //   overrideGetLoans(makeGetLoansFromSdk(pool, 10));

  //   // Create kickable loan
  //   console.log('impersonating account');
  //   const signer = await impersonateSigner(
  //     MAINNET_CONFIG.WBTC_USDC_POOL.collateralWhaleAddress
  //   );
  //   console.log('Approving collateral');
  //   await setBalance(
  //     MAINNET_CONFIG.WBTC_USDC_POOL.collateralWhaleAddress,
  //     '0x10000000000000000000000'
  //   );
  //   const approveTx = await pool.collateralApprove(
  //     signer,
  //     numberToWad(1)
  //     // BigNumber.from('0x1000000000')
  //   );
  //   await approveTx.verifyAndSubmit();
  //   console.group('drawing debt');
  //   const drawTx = await pool.drawDebt(
  //     signer,
  //     numberToWad(51),
  //     numberToWad(0.001)
  //     // BigNumber.from('0x100000000'),
  //     // BigNumber.from('0x100000000')
  //   );
  //   const response = await drawTx.verifyAndSubmitResponse();
  //   const loansToKick = await getLoansToKick({
  //     pool,
  //     poolConfig: MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig,
  //     price: 0,
  //     config: {
  //       subgraphUrl: '',
  //     },
  //   });
  //   expect(loansToKick).to.not.be.empty;
  // });

  it('Returns loan when loan is in bad health', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address
    );
    overrideGetLoans(makeGetLoansFromSdk(pool, 10));

    // Create kickable loan
    increaseTime(3.154e7 * 10); // Increase timestamp by 10 years.

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
});
