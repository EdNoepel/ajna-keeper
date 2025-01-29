import { AjnaSDK, Pool } from '@ajna-finance/sdk';
import { expect } from 'chai';
import { providers } from 'ethers';
import { configureAjna, PriceOriginPoolReference } from '../config';
import { getPoolPrice } from '../price';
import { HARDHAT_RPC_URL, LOCAL_MAIN_NET_CONFIG} from './test-utils';


describe('getPoolPrice', () => {
  const poolAddress = LOCAL_MAIN_NET_CONFIG.WSTETH_ETH_POOL_ADDRESS;
  let provider: providers.JsonRpcProvider;
  let ajna: AjnaSDK;
  let fungiblePool: Pool

  before(async () => {
    provider = new providers.JsonRpcProvider(HARDHAT_RPC_URL);
    configureAjna(LOCAL_MAIN_NET_CONFIG.AJNA_CONFIG)
    ajna = new AjnaSDK(provider);
    fungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(poolAddress);
  });

  it('should find price for hpb', async () => {
    const hpbPrice = await getPoolPrice(fungiblePool, PriceOriginPoolReference.HPB);
    expect(hpbPrice).to.equal(1.149872);
  });

  it('should find price for htp', async () => {
    const htpPrice = await getPoolPrice(fungiblePool, PriceOriginPoolReference.HTP);
    expect(htpPrice).to.equal(0.702218);
  });

  it('should find price for lup', async () => {
    const lupPrice = await getPoolPrice(fungiblePool, PriceOriginPoolReference.LUP);
    expect(lupPrice).to.equal(1.138459);
  });

  it('should find price for llb', async () => {
    const llbPrice = await getPoolPrice(fungiblePool, PriceOriginPoolReference.LLB);
    expect(llbPrice).to.equal(1004968987.606512);
  });
});