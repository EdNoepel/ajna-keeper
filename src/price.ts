import { PriceOrigin, PriceOriginSource } from './config'
import { getPrice as getPriceCoinGecko } from './coingecko'
import { priceToNumber } from './utils'
import { KeeperContext } from './run';

// Retrieves the market price using the configured source
export async function getPrice(poolAddress: string, priceOrigin: PriceOrigin, coinGeckoApiKey: string = "", pools: KeeperContext["pools"]) {
  let price: number;
  switch (priceOrigin.source) {
    case PriceOriginSource.COINGECKO:
      price = await getPriceCoinGecko(priceOrigin.query, coinGeckoApiKey);
      break;
    case PriceOriginSource.FIXED:
      price = priceOrigin.value;
      break;
    case PriceOriginSource.POOL:
      price = await getPoolPrice(poolAddress, priceOrigin.reference, pools);
      break;
    default:
      throw new Error('Unknown price provider:' + (priceOrigin as any).source);
  }
  if (priceOrigin.invert) {
    return (price !== 0) ? 1 / price : 0;
  } else {
    return price;
  }
}

async function getPoolPrice(poolAddress: string, reference: string, pools: KeeperContext["pools"]): Promise<number> {
  const poolPrices = await pools.get(poolAddress)?.getPrices();
  let price;
  switch (reference) {
    case 'hpb':
      price = poolPrices?.hpb;
      break;
    case 'htp':
      price = poolPrices?.htp;
      break;
    case 'lup':
      price = poolPrices?.lup;
      break;
    case 'llb':
      price = poolPrices?.llb;
      break;
    default:
      throw new Error('Unknown pool price reference:' + reference);
  }
  if (price == undefined) {
    throw new Error(`Unable to get price for ${poolAddress} - ${reference}`);
  }
  return priceToNumber(price);
}
