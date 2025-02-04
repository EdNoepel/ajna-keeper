import { gql, request } from 'graphql-request';

export interface GetLoanResponse {
  pool: {
    lup: number;
    hpb: number;
  };
  loans: {
    borrower: string;
    thresholdPrice: number;
  }[];
}

async function getLoans(subgraphUrl: string, poolAddress: string) {
  const query = gql`
    query {
      pool (id: "${poolAddress}") {
        lup
        hpb
      }
      loans (where: {inLiquidation: false, poolAddress: "${poolAddress}"}){
        borrower
        thresholdPrice
      }
    }
  `;

  const result: GetLoanResponse = await request(subgraphUrl, query);
  return result;
}

export interface GetLiquidationResponse {
  pool: {
    hpb: number;
    hpbIndex: number;
    liquidationAuctions: {
      borrower: string;
    }[];
  };
}

async function getLiquidations(
  subgraphUrl: string,
  poolAddress: string,
  minCollateral: number
) {
  // TODO: Should probably sort auctions by kickTime so that we kick the most profitable auctions first.
  const query = gql`
    query {
      pool (id: "${poolAddress}") {
        hpb
        hpbIndex
        liquidationAuctions (where: {collateralRemaining_gt: "${minCollateral}"}) {
          borrower
        }
      }
    }
  `;

  const result: GetLiquidationResponse = await request(subgraphUrl, query);
  return result;
}

interface GetLendsResponse {}

async function getLends(subgraphUrl: string, borrower: string) {
  const query = gql`
  query {
    accounts(where: {id: "${borrower}"}) {
      id
      lends {
        pool {
          id
          quoteToken {
            symbol
          }
          collateralToken {
            symbol
          }
        }
        bucket {
          bucketIndex
        }
      }
    }
  }`;
  const result: GetLendsResponse = await request(subgraphUrl, query);
  return result;
}

// Exported as default module to enable mocking in tests.
export default { getLoans, getLiquidations };
