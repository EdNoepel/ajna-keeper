import { AjnaConfigParams } from "../config";

export const HARDHAT_RPC_URL = 'http://127.0.0.1:8545';

export const LOCAL_MAIN_NET_CONFIG = {
  AJNA_CONFIG: {
    'erc20PoolFactory': '0x6146DD43C5622bB6D12A5240ab9CF4de14eDC625',
    'erc721PoolFactory': '0x27461199d3b7381De66a85D685828E967E35AF4c',
    'poolUtils': '0x30c5eF2997d6a882DE52c4ec01B6D0a5e5B4fAAE',
    'positionManager': '0x87B0F458d8F1ACD28A83A748bFFbE24bD6B701B1',
    'ajnaToken': '0x9a96ec9B57Fb64FbC60B423d1f4da7691Bd35079',
    'grantFund': '',
    'burnWrapper': '',
    'lenderHelper': '',
  } as AjnaConfigParams,
  WSTETH_ETH_POOL_ADDRESS: "0x3ba6a019ed5541b5f5555d8593080042cf3ae5f4"
}
