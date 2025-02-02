import {
  providers,
  Wallet,
  Contract,
  BigNumber,
  ContractTransaction,
} from 'ethers';
import { Signer } from '@ajna-finance/sdk';
import { approveErc20, getBalanceOfErc20 } from '../erc20';
import { resetHardhat, impersonateSigner, setBalance } from './test-utils';
import { MAINNET_CONFIG, USER1_MNEMONIC } from './test-config';
import { expect } from 'chai';
import { wadToNumber } from '../utils';

const WETH_WHALE_ADDRESS = '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e';
const WETH_ABI = [
  // From https://etherscan.io/token/0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2#code
  {
    constant: true,
    inputs: [
      { name: '', type: 'address' },
      { name: '', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    payable: false,
    stateMutability: 'view',
    type: 'function',
  },
];

export async function getErc20Allowance(
  signer: Signer,
  tokenAddress: string,
  owner: string,
  spender: string
): Promise<BigNumber> {
  const contract = new Contract(tokenAddress, WETH_ABI, signer);
  return await contract.allowance(owner, spender);
}

describe('approverErc20', () => {
  before(async () => {
    await resetHardhat();
  });

  it('Can approve ERC20 transfer', async () => {
    const receiver = Wallet.fromMnemonic(USER1_MNEMONIC);
    const signer = await impersonateSigner(WETH_WHALE_ADDRESS);
    await setBalance(WETH_WHALE_ADDRESS, '0x100000000000000000');
    const approveTx = await approveErc20(
      signer,
      MAINNET_CONFIG.WSTETH_WETH_POOL.quoteAddress,
      receiver.address,
      BigNumber.from('1000000000')
    );
    await approveTx.wait();
    const allowance = await getErc20Allowance(
      signer,
      MAINNET_CONFIG.WSTETH_WETH_POOL.quoteAddress,
      WETH_WHALE_ADDRESS,
      receiver.address
    );
    expect(allowance.toString()).to.equal('1000000000');
  });
});

describe('getBallanceOfErc20', () => {
  before(async () => {
    await resetHardhat();
  });

  it('Can get balance of ERC20', async () => {
    const signer = await impersonateSigner(WETH_WHALE_ADDRESS);
    const balanceBig = await getBalanceOfErc20(
      signer,
      MAINNET_CONFIG.WSTETH_WETH_POOL.quoteAddress
    );
    const balance = wadToNumber(balanceBig);
    expect(balance).to.equal(604264.559344);
  });
});
