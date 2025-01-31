import { Signer } from "@ajna-finance/sdk";
import { BigNumber, Contract, ContractTransaction, providers } from 'ethers';
import IERC20Minimal from '@uniswap/v3-core/artifacts/contracts/interfaces/IERC20Minimal.sol/IERC20Minimal.json';

export function approveErc20(
    signer: Signer,
    tokenAddress: string,
    spenderAddress: string,
    amount: BigNumber,
): Promise<ContractTransaction> {
    const contract = new Contract(tokenAddress, IERC20Minimal.abi, signer);
    return contract.approve(spenderAddress, amount);
}

// export async function getDecimalsErc20(
//   provider: providers.JsonRpcProvider,
//   tokenAddress: string,
// ) {
//   const contract = new Contract(tokenAddress, IERC20Minimal.abi, provider);
//   const decimals = await contract.decimals();
//   return decimals; 
// }

export async function getBalanceOfErc20(
  signer: Signer,
  tokenAddress: string,
): Promise<BigNumber> {
  const contract = new Contract(tokenAddress, IERC20Minimal.abi, signer);
  const ownerAddress = await signer.getAddress();
  return await contract.balanceOf(ownerAddress)
}
