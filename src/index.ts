#!/usr/bin/env ts-node

import yargs from 'yargs/yargs'

import { AjnaSDK, Pool, Signer } from '@ajna-finance/sdk'
import { configureAjna, readConfigFile, KeeperConfig, PoolConfig, PriceOrigin, PriceOriginSource } from './config'
import { getPrice as getPriceCoinGecko } from './coingecko'
import { delay, getProviderAndSigner, overrideMulticall, priceToNumber } from './utils'
import { handleKicks } from './kick'

const argv = yargs(process.argv.slice(2)).options({
  config: { type: 'string', demandOption: true, describe: 'Path to the config file' },
}).parseSync()

// these are in seconds, helps manage API costs and rate limits
const DELAY_BETWEEN_LOANS = 1.5
const DELAY_MAIN_LOOP = 15

let pools: Map<string, Pool> = new Map()
let config: KeeperConfig

async function main() {
  config = await readConfigFile(argv.config)
  console.log('Starting keeper with...')
  console.log('  ETH_RPC_URL ', config.ETH_RPC_URL)
  console.log('  SUBGRAPH_URL', config.SUBGRAPH_URL)

  const { provider, signer } = await getProviderAndSigner(config.KEEPER_KEYSTORE, config.ETH_RPC_URL)
  configureAjna(config.ajna)
  // FIXME: failed attempt to hack around "Multicall contract is not available on this network" warnings
  // await configureMulticall(provider, config.chain)
  const ajna = new AjnaSDK(provider);

  console.log('...and pools:')
  for(const pool of config.pools) {
    const name: string = pool.name ?? '(unnamed)'
    console.log('loading pool', name.padStart(18), 'at', pool.address)
    const fungiblePool = await ajna.fungiblePoolFactory.getPoolByAddress(pool.address)
    overrideMulticall(fungiblePool, config)
    pools.set(pool.address, fungiblePool)
  }

  while (true) {
    for(const pool of config.pools) {
      try {
        keepPool(pool, signer) // not awaiting here; we want these calls dispatched in parallel
      } catch (error) {
        console.error(`Error keeping pool ${pool.address}:`, error)
      }
    }
    console.log('\n')
    await delay(DELAY_MAIN_LOOP)
  }
}

// Retrieves the market price using the configured source
async function getPrice(poolAddress: string, priceOrigin: PriceOrigin) {
  let price: number;
  switch (priceOrigin.source) {
    case PriceOriginSource.COINGECKO:
      price = await getPriceCoinGecko(priceOrigin.query, config.pricing.coinGeckoApiKey)
      break
    case PriceOriginSource.FIXED:
      price = priceOrigin.value
      break
    case PriceOriginSource.POOL:
      price = await getPoolPrice(poolAddress, priceOrigin.reference)
      break
    default:
      throw new Error('Unknown price provider:' + (priceOrigin as any).source)
  }
  if (priceOrigin.invert) {
    return (price !== 0) ? 1 / price : 0
  } else {
    return price
  }
}

async function getPoolPrice(poolAddress: string, reference: string): Promise<number> {
  const poolPrices = await pools.get(poolAddress)?.getPrices()
  let price
  switch (reference) {
    case 'hpb':
      price = poolPrices?.hpb
      break
    case 'htp':
      price = poolPrices?.htp
      break
    case 'lup':
      price = poolPrices?.lup
      break
    case 'llb':
      price = poolPrices?.llb
      break
    default:
      throw new Error('Unknown pool price reference:' + reference)
  }
  if (price == undefined) {
    throw new Error(`Unable to get price for ${poolAddress} - ${reference}`)
  }
  return priceToNumber(price)
}

async function keepPool(poolConfig: PoolConfig, signer: Signer) {
  let price: number
  if (poolConfig.price) {
    price = await getPrice(poolConfig.address, poolConfig.price)
  } else {
    throw new Error('No price feed configured for pool ' + poolConfig.address)
  }
  console.log(poolConfig.name, `${poolConfig.price.source} price`, price)

  const pool = pools.get(poolConfig.address)
  if (pool == undefined) throw new Error(`Cannot find pool for address: ${poolConfig.address}`)
  if (poolConfig.kick) handleKicks(pool, poolConfig, price, config.SUBGRAPH_URL, DELAY_BETWEEN_LOANS, signer, !!config.dryRun)
  // TODO: implement poolConfig.arbtake
}

main()
