import chai from 'chai';
import './subgraph-mock';
import { getLoansToKick } from '../kick';
import { AjnaSDK, FungiblePool } from '@ajna-finance/sdk';
import { MAINNET_CONFIG } from './test-config';
import { configureAjna } from '../config';
import { getProvider } from './test-utils';
import { makeGetLoansFromSdk, overrideGetLoans } from './subgraph-mock';
import { expect } from 'chai';

// import spies from 'chai-spies';
// chai.use(spies);

describe.only('getLoansToKick', () => {
  it('Calls mocked function', async () => {
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    const ajna = new AjnaSDK(getProvider());
    const pool: FungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(
      MAINNET_CONFIG.WBTC_DAI_POOL.poolConfig.address
    );
    overrideGetLoans(makeGetLoansFromSdk(pool, 10));
    const loansToKick = await getLoansToKick({
      pool,
      poolConfig: MAINNET_CONFIG.WBTC_DAI_POOL.poolConfig,
      price: 1,
      config: {
        subgraphUrl: '',
      },
    });
    expect(loansToKick).to.be.empty;
  });
});
