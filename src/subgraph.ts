import { gql, request } from "graphql-request";

export async function getLoans(subgraphUrl: string, poolAddress: string) {
  const query = gql`
    query {
      pool (id: "${poolAddress}") {
        lup
      }
      loans (where: {poolAddress: "${poolAddress}"}){
        borrower
        inLiquidation
        thresholdPrice
      }
    }
  `

  const result: {
    pool: {
      lup: number;
    },
    loans: {
      borrower: string;
      inLiquidation: boolean;
      thresholdPrice: number;
    }[] 
  } = await request(subgraphUrl, query);
  return result;
}


export async function getLiquidations(subgraphUrl: string, poolAddress: string, minCollateral: number) {
  // TODO: Should probably sort auctions by kickTime so that we kick the most profitable auctions first.
  const query = gql`
    query {
      pool (id: "${poolAddress}") {
        hpb
        hpbIndex
        liquidationAuctions (where: {collateralRemaining_gt: "${minCollateral}"}) {
          borrower
          collateralRemaining
          kickTime
          referencePrice
        }
      }
    }
  `

  const result: {
    pool: {
      hpb: number;
      hpbIndex: number;
      liquidationAuctions: {
        borrower: string;
        collateralRemaining: number;
        kickTime: number;
        referencePrice: number;
      }[]
    }
  } = await request(subgraphUrl, query);
  return result;
}