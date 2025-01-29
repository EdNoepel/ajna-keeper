import { gql, request } from "graphql-request";

export async function getLoans(subgraphUrl: string, poolAddress: string) {
  const query = gql`
    query {
      pool (id: "${poolAddress}") {
        lup
        loans() {
          borrower
          inLiquidation
          thresholdPrice
        }
      }
    }
  `

  const result: {
    pool: {
      lup: number;
      loans: {
        borrower: string;
        inLiquidation: boolean;
        thresholdPrice: number;
      }[] }
    }
    = await request(subgraphUrl, query)
  return result.pool
}
