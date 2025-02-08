import { FungiblePool, Signer } from '@ajna-finance/sdk';
import { BigNumber } from 'ethers';
import { PoolConfig } from './config';

interface CollectBondParams {
  pool: FungiblePool;
  signer: Signer;
}

export async function collectBondFromPool({ pool, signer }: CollectBondParams) {
  const signerAddress = await signer.getAddress();
  const { claimable, locked } = await pool.kickerInfo(signerAddress);
  if (locked.eq(BigNumber.from('0')) && claimable.gt(BigNumber.from('0'))) {
    const withdrawTx = await pool.withdrawBonds(signer);
    await withdrawTx.verifyAndSubmit();
  }
}
