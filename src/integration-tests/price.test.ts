import { AjnaSDK, Pool } from '@ajna-finance/sdk';
import { expect } from 'chai';
import { providers } from 'ethers';
import { configureAjna, PriceOriginPoolReference } from '../config-types';
import { getPoolPrice } from '../price';
import { getProvider, resetHardhat } from './test-utils';
import { MAINNET_CONFIG } from './test-config';
import { JsonRpcProvider } from '../provider';

describe('getPoolPrice', () => {
  const poolAddress = MAINNET_CONFIG.WBTC_USDC_POOL.poolConfig.address;
  let provider: JsonRpcProvider;
  let ajna: AjnaSDK;
  let fungiblePool: Pool;

  beforeEach(async () => {
    await resetHardhat();
    provider = getProvider();
    configureAjna(MAINNET_CONFIG.AJNA_CONFIG);
    ajna = new AjnaSDK(provider);
    fungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(poolAddress);
  });

  it('should find price for hpb', async () => {
    const hpbPrice = await getPoolPrice(
      await fungiblePool.getPrices(),
      PriceOriginPoolReference.HPB
    );
    expect(hpbPrice).to.equal(59726.377253304);
  });

  it('should find price for htp', async () => {
    const htpPrice = await getPoolPrice(
      await fungiblePool.getPrices(),
      PriceOriginPoolReference.HTP
    );
    expect(htpPrice).to.equal(38336.04015947);
  });

  it('should find price for lup', async () => {
    const lupPrice = await getPoolPrice(
      await fungiblePool.getPrices(),
      PriceOriginPoolReference.LUP
    );
    expect(lupPrice).to.equal(52988.385953918);
  });

  it('should find price for llb', async () => {
    const llbPrice = await getPoolPrice(
      await fungiblePool.getPrices(),
      PriceOriginPoolReference.LLB
    );
    expect(llbPrice).to.equal(1004968987.6065);
  });
});
