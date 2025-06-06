import { Signer, SignerOrProvider } from '@ajna-finance/sdk';
import { BigNumber, Contract } from 'ethers';
import Erc20Abi from './abis/erc20.abi.json';
import { NonceTracker } from './nonce';
import { TransactionResponse } from '@ethersproject/abstract-provider';

// TODO: Remove caching. This performance improvement is not worth the complexity.
const cachedDecimals: Map<string, number> = new Map(); // Map of address to int decimals.
export async function getDecimalsErc20(
  signer: SignerOrProvider,
  tokenAddress: string
) {
  if (!cachedDecimals.has(tokenAddress)) {
    const decimals = await _getDecimalsErc20(signer, tokenAddress);
    cachedDecimals.set(tokenAddress, decimals);
  }
  return cachedDecimals.get(tokenAddress)!;
}

async function _getDecimalsErc20(
  signer: SignerOrProvider,
  tokenAddress: string
) {
  const contract = new Contract(tokenAddress, Erc20Abi, signer);
  const decimals = await contract.decimals();
  return decimals;
}

export async function getBalanceOfErc20(
  signer: Signer,
  tokenAddress: string
): Promise<BigNumber> {
  const contract = new Contract(tokenAddress, Erc20Abi, signer);
  const ownerAddress = await signer.getAddress();
  return await contract.balanceOf(ownerAddress);
}

export async function getAllowanceOfErc20(
  signer: Signer,
  tokenAddress: string,
  allowedAddress: string
): Promise<BigNumber> {
  const contract = new Contract(tokenAddress, Erc20Abi, signer);
  const signerAddress = await signer.getAddress();
  return await contract.allowance(signerAddress, allowedAddress);
}

export async function approveErc20(
  signer: Signer,
  tokenAddress: string,
  allowedAddress: string,
  amount: BigNumber
) {
  const signerAddress = await signer.getAddress();
  try {
    const nonce = NonceTracker.getNonce(signer);
    const contractUnconnected = new Contract(tokenAddress, Erc20Abi, signer);
    const contract = contractUnconnected.connect(signer);
    const tx: TransactionResponse = await contract.approve(
      allowedAddress,
      amount,
      { nonce }
    );
    console.log('submitted tx', tx.hash)
    return await tx.wait();
  } catch (error) {
    NonceTracker.resetNonce(signer, signerAddress);
    throw error;
  }
}

export async function transferErc20(
  signer: Signer,
  tokenAddress: string,
  recipient: string,
  amount: BigNumber
) {
  const signerAddress = await signer.getAddress();
  try {
    const nonce = NonceTracker.getNonce(signer);
    const contractUnconnected = new Contract(tokenAddress, Erc20Abi, signer);
    const contract = contractUnconnected.connect(signer);
    const tx: TransactionResponse = await contract.transfer(recipient, amount, {
      nonce,
    });
    return await tx.wait();
  } catch (error) {
    NonceTracker.resetNonce(signer, signerAddress);
    throw error;
  }
}
