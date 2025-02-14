import { expect } from 'chai';
import { getProvider } from '../integration-tests/test-utils';
import { txSemaphore } from '../tx-semaphore';
import { delay } from '../utils';
import sinon from 'sinon';

let txCount = 0;
const mockGetTransactionCount = async (...args: any) => {
  return txCount++;
};

describe('TransactionSemaphore', () => {
  const provider = getProvider();
  const signer = provider.getSigner();

  afterEach(() => {
    sinon.restore();
  });

  it('Returns result of inner function', async () => {
    sinon
      .stub(signer, 'getTransactionCount')
      .callsFake(mockGetTransactionCount);
    const result = await txSemaphore.waitForTx(async () => {
      await delay(1);
      return 100;
    }, signer);

    expect(result).equals(100);
  });

  it('Performs the actions in order', async () => {
    sinon
      .stub(signer, 'getTransactionCount')
      .callsFake(mockGetTransactionCount);
    let actionCount = 0;
    const prom1 = txSemaphore.waitForTx(async () => {
      await delay(0.5);
      await delay(0.1);
      return actionCount++;
    }, signer);
    const prom2 = txSemaphore.waitForTx(async () => {
      await delay(0.1);
      return actionCount++;
    }, signer);
    const prom3 = txSemaphore.waitForTx(async () => {
      return actionCount++;
    }, signer);
    const [result1, result2, result3] = await Promise.all([
      prom1,
      prom2,
      prom3,
    ]);
    expect(result1).equals(0);
    expect(result2).equals(1);
    expect(result3).equals(2);
  });

  it('Throws errors', async () => {
    sinon
      .stub(signer, 'getTransactionCount')
      .callsFake(mockGetTransactionCount);

    const failPromise = txSemaphore.waitForTx(async () => {
      throw new Error('Test error');
    }, signer);
    expect(failPromise).to.be.rejectedWith('Test error');
  });

  it('Waits for getTransactionCount to increase', async function () {
    this.timeout(40000);
    let manualTxCount = 0;
    const manualTransactionCount = async (...args: any) => {
      return manualTxCount;
    };
    sinon.stub(signer, 'getTransactionCount').callsFake(manualTransactionCount);
    const expectedResult = 'Hello world';
    const prom = txSemaphore.waitForTx(async () => {
      return expectedResult;
    }, signer);
    const resolvesInSeconds = async (seconds: number) => {
      await delay(seconds);
      return undefined;
    };
    const raceResult1 = await Promise.race([prom, resolvesInSeconds(1)]);
    expect(raceResult1).equals(undefined);
    manualTxCount = 1;
    const raceResult2 = await Promise.race([prom, resolvesInSeconds(1)]);
    expect(raceResult2).equals(expectedResult);
  });
});
