import {
  AjnaConfigParams,
  KickSettings,
  PoolConfig,
  PriceOrigin,
  PriceOriginSource,
} from '../config';

export const HARDHAT_RPC_URL = 'http://127.0.0.1:8545';

export const USER1_MNEMONIC =
  'dragon empower index stage okay add nose worry grace play mail horse nurse rabbit blur';

export const MAINNET_CONFIG = {
  BLOCK_NUMBER: 21731352,
  AJNA_CONFIG: {
    erc20PoolFactory: '0x6146DD43C5622bB6D12A5240ab9CF4de14eDC625',
    erc721PoolFactory: '0x27461199d3b7381De66a85D685828E967E35AF4c',
    poolUtils: '0x30c5eF2997d6a882DE52c4ec01B6D0a5e5B4fAAE',
    positionManager: '0x87B0F458d8F1ACD28A83A748bFFbE24bD6B701B1',
    ajnaToken: '0x9a96ec9B57Fb64FbC60B423d1f4da7691Bd35079',
    grantFund: '',
    burnWrapper: '',
    lenderHelper: '',
  } as AjnaConfigParams,
  WSTETH_WETH_POOL: {
    quoteAddress: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', // WETH
    collateralAddress: '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0', //wstETH
    poolConfig: {
      name: 'WstETH/WETH',
      address: '0x3ba6a019ed5541b5f5555d8593080042cf3ae5f4',
      price: {
        source: PriceOriginSource.FIXED,
        value: 1,
      } as PriceOrigin,
    } as PoolConfig,
  },
  WBTC_DAI_POOL: {
    quoteAddress: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    collateralAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
    poolConfig: {
      name: 'WBTC/DAI',
      address: '0x50f1c63f3aefd60c665ef45aa74f274dabf93405',
      price: {
        source: PriceOriginSource.FIXED,
        value: 1,
      } as PriceOrigin,
      kick: {
        minDebt: 1,
        priceFactor: 0.9,
      } as KickSettings,
    } as PoolConfig,
  },
};
