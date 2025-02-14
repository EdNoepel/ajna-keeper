import { TransactionReceipt } from '@ethersproject/abstract-provider';
import { Signer } from 'ethers';
import { waitForConditionToBeTrue } from './utils';

/** Once a transaction is built, it must be sent and received by the block chain with a before the next transaction can be sent or received. This class handles that process. */
class TransactionSemaphore {
  private lastPromise: Promise<any> = new Promise((resolve) => resolve(null));

  public async waitForTx<T>(buildAndSendTx: () => Promise<T>, signer: Signer) {
    const currPromise = callAfterBlocker(
      this.lastPromise,
      buildAndSendTx,
      signer
    );
    this.lastPromise = currPromise;
    const { result, error } = await currPromise;
    if (error) {
      throw error;
    } else {
      return result;
    }
  }
}

/** Call buildAndSendTx after blockingPromise has resolved. Resolves the result of buildAndSendTx. */
async function callAfterBlocker<T>(
  blockingPromise: Promise<any>,
  buildAndSendTx: () => Promise<T>,
  signer: Signer
): Promise<{ result: T | undefined; error: unknown }> {
  await blockingPromise;
  let result: T | undefined;
  try {
    const txCount = await signer.getTransactionCount();
    result = await buildAndSendTx();

    // Wait for transactionCount to increase to avoid nonce errors.
    await waitForConditionToBeTrue(
      async () => {
        const newTxCount = await signer.getTransactionCount();
        return newTxCount > txCount;
      },
      0.2,
      20
    );
  } catch (error) {
    return { result, error };
  }
  return { result, error: null };
}

const txSemaphore = new TransactionSemaphore();

export { txSemaphore };
