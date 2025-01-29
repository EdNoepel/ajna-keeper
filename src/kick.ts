import { Pool } from '@ajna-finance/sdk'
import { getLoans } from './subgraph';
import { delay, priceToNumber } from './utils';
import { PoolConfig } from './config';

export async function handleKicks(
  pool: Pool,
  poolConfig: PoolConfig,
  price: number,
  subgraphUrl: string,
  delayBetweenLoans: number
) {
  const loans = await getLoans(subgraphUrl, pool.poolAddress)
  for(const loanFromSubgraph of loans) {
    const loanFromSDK = await pool.getLoan(loanFromSubgraph.borrower)
    const {inLiquidation} = loanFromSubgraph
    const debt = priceToNumber(loanFromSDK.debt)

    // if loan debt is lower than configured fixed value (denominated in quote token), skip it
    if (debt < poolConfig.kick.minDebt) continue

    // if threshold price below this, kick if not already under liquidation
    const comparisonPrice = price * poolConfig.kick.priceFactor

    if (price < comparisonPrice) {
      console.log(poolConfig.name, 'loan', loanFromSubgraph.borrower, 'may be kickable')
      if (!inLiquidation) {
        // TODO: check for active liquidation, synchronously kick if not already under liquidation
      }
    } else {
      console.debug(poolConfig.name, 'loan', loanFromSubgraph.borrower,
        'with threshold price', loanFromSubgraph.thresholdPrice,
        'and debt', debt,
        'and feed price',
      )
    }

    await delay(delayBetweenLoans);
  }
}
