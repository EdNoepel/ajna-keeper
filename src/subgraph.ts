import { gql, request } from "graphql-request";

export async function getLoans(subgraphUrl: string, poolAddress: string) {
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
  `

  const result: {
    pool: {
      lup: number;
      hpb: number;
    },
    loans: {
      borrower: string;
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