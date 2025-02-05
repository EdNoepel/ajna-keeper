import { providers, Signer, Wallet } from 'ethers';
import { HARDHAT_RPC_URL, MAINNET_CONFIG } from './test-config';
import { FungiblePool } from '@ajna-finance/sdk';
import { getDecimalsErc20 } from '../erc20';
import { decimaledToWei } from '../utils';

export const getProvider = () => new providers.JsonRpcProvider(HARDHAT_RPC_URL);

export const resetHardhat = () =>
  getProvider().send('hardhat_reset', [
    {
      forking: {
        jsonRpcUrl: `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
        blockNumber: MAINNET_CONFIG.BLOCK_NUMBER,
      },
    },
  ]);

export const setBalance = (address: string, balance: string) =>
  getProvider().send('hardhat_setBalance', [address, balance]);

export const getBalance = (address: string) =>
  getProvider().send('eth_getBalance', [address]);

const impersonateAccount = (address: string) =>
  getProvider().send('hardhat_impersonateAccount', [address]);

export const impersonateSigner = async (address: string) => {
  await impersonateAccount(address);
  const provider = getProvider();
  return provider.getSigner(address);
};

export const mine = () => getProvider().send('evm_mine', []);

export const latestBlockTimestamp = async () => {
  const latestBlock = await getProvider().send('eth_getBlockByNumber', [
    'latest',
    false,
  ]);
  return parseInt(latestBlock.timestamp, 16);
};

export const increaseTime = async (seconds: number) => {
  const provider = getProvider();
  const currTimestamp = await latestBlockTimestamp();
  const nextTimestamp = (currTimestamp + seconds).toString();
  await getProvider().send('evm_setNextBlockTimestamp', [nextTimestamp]);
  await mine();
  return await latestBlockTimestamp();
};

export const depositQuoteToken = async (
  pool: FungiblePool,
  ownerAddress: string,
  amount: number,
  price: number
) => {
  const signer = await impersonateSigner(ownerAddress);
  const decimals = await getDecimalsErc20(signer, pool.quoteAddress);
  const priceBn = decimaledToWei(price);
  const bucket = await pool.getBucketByPrice(priceBn);
  const amountBn = decimaledToWei(amount, decimals);

  console.log(
    `approving helper. signer: ${await signer.getAddress()} amt: ${amountBn}`
  );

  const qApproveTx = await pool.quoteApproveHelper(signer, amountBn);
  await qApproveTx.verifyAndSubmit();

  console.log('approving transferror');
  const approveHelperTx = await pool.approveLenderHelperLPTransferor(signer);
  await approveHelperTx.verifyAndSubmit();

  console.log('adding quote token');
  const addTx = await bucket.addQuoteToken(signer, amountBn);
  await addTx.verifyAndSubmit();
};

export const takeLoan = async (
  pool: FungiblePool,
  ownerAddress: string,
  amountToBorrow: number,
  collateralToPledge: number
) => {
  const signer = await impersonateSigner(ownerAddress);
  const collateralDecimals = await getDecimalsErc20(
    signer,
    pool.collateralAddress
  );
  const collateralAmt = decimaledToWei(collateralToPledge, collateralDecimals);

  const qApproveTx = await pool.collateralApprove(signer, collateralAmt);
  await qApproveTx.verifyAndSubmit();

  const quoteDecimals = await getDecimalsErc20(signer, pool.quoteAddress);
  const borrowAmt = decimaledToWei(amountToBorrow, quoteDecimals);
  const drawTx = await pool.drawDebt(signer, borrowAmt, collateralAmt);
  await drawTx.verifyAndSubmit();
};
