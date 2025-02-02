import { ERC20Pool__factory, FungiblePool } from '@ajna-finance/sdk';
import subgraphModule, { GetLoanResponse } from '../subgraph';
import { getProvider } from './test-utils';
import { wadToNumber } from '../utils';

export function overrideGetLoans(
  fn: typeof subgraphModule.getLoans
): () => void {
  const originalGetLoans = subgraphModule.getLoans;
  const undoFn = () => {
    subgraphModule.getLoans = originalGetLoans;
  };
  subgraphModule.getLoans = fn;
  return undoFn;
}

export const makeGetLoansFromSdk = (pool: FungiblePool, first: number) => {
  return async (
    subgraphUrl: string,
    poolAddress: string
  ): Promise<GetLoanResponse> => {
    const { lup, hpb } = await pool.getPrices();
    const { loansCount } = await pool.getStats();
    const poolContract = ERC20Pool__factory.connect(
      pool.poolAddress,
      getProvider()
    );
    const borrowers: string[] = [];
    for (let i = 1; i < Math.min(first, loansCount) + 1; i++) {
      const [borrower] = await poolContract.loanInfo(i);
      borrowers.push(borrower);
    }
    const loansMap = await pool.getLoans(borrowers);
    const borrowerLoanTuple = Array.from(loansMap.entries());
    const loans = borrowerLoanTuple
      .filter(([_, { isKicked }]) => !isKicked)
      .map(([borrower, { thresholdPrice }]) => ({
        borrower,
        thresholdPrice: wadToNumber(thresholdPrice),
      }));
    return {
      pool: {
        lup: wadToNumber(lup),
        hpb: wadToNumber(hpb),
      },
      loans,
    };
  };
};
