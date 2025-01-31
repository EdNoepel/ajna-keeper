import { Address, Pool, Signer } from '@ajna-finance/sdk'
import { getLoans } from './subgraph';
import { delay, wadToNumber } from './utils';
import { PoolConfig } from './config';
import { approveErc20, getBalanceOfErc20 } from './erc20';
import { BigNumber } from 'ethers';
import { priceToBucket } from './price';

const APPROVAL_AMOUNT_FACTOR = 1.10

export async function handleKicks(handleKickParams: {
  signer: Signer,
  pool: Pool,
  poolConfig: PoolConfig,
  subgraphUrl: string,
  price: number,
  delayBetweenLoans: number,
  dryRun: boolean,
}) {
  const {
    signer,
    pool,
    poolConfig,
    subgraphUrl,
    price,
    delayBetweenLoans,
    dryRun
  } = handleKickParams;

  const {pool: {lup}, loans} = await getLoans(subgraphUrl, pool.poolAddress)
  for(const loanFromSubgraph of loans) {
    const {borrower, thresholdPrice} = loanFromSubgraph

    // If TP is lower than lup, the bond can not be kicked.
    if (thresholdPrice >= lup) continue

    const {neutralPrice, liquidationBond, debt} = await pool.getLoan(borrower)

    // if loan debt is lower than configured fixed value (denominated in quote token), skip it
    if (wadToNumber(debt) < poolConfig.kick!.minDebt) continue

    // Only kick bonds which are lower than the price * priceFactor to ensure that they are profitable.
    const shouldBeProfitable = wadToNumber(neutralPrice) * poolConfig.kick!.priceFactor > price;

    if (shouldBeProfitable) {
      if (!dryRun) {
        console.log(`Kicking loan - pool: ${pool.name}, borrower: ${borrower}, TP: ${thresholdPrice}, feedPrice: ${price}`);
        await kick(signer, pool, borrower, price, liquidationBond);
      }else {
        console.debug(`DryRun - Would kick loan - pool: ${pool.name}, borrower: ${borrower}, TP: ${thresholdPrice}, feedPrice: ${price}`);
      }
    }

    await delay(delayBetweenLoans);
  }
}

export async function kick(signer: Signer, pool: Pool, borrower: Address, limitPrice: number, liquidationBond: BigNumber) {
  try {
    const collateralBalance = await getBalanceOfErc20(signer, pool.collateralAddress);
    if (collateralBalance < liquidationBond) {
      console.log(`Balance of token: ${pool.collateralSymbol} too low to kick loan. pool: ${pool.name}, borrower: ${borrower}, bond: ${liquidationBond}`)
      return;
    }
    console.log(`Approving liquidationBond for kick. pool: ${pool.name}, liquidationBond: ${liquidationBond}`);
    await approveErc20(signer, pool.quoteAddress, pool.poolAddress, liquidationBond);
    const limitIndex = priceToBucket(limitPrice)
    const wrappedTransaction = await pool.kick(signer, borrower, limitIndex);  // TODO: Add limitIndex?
    console.log(`Sending kick transaction. pool: ${pool.name}, borrower: ${borrower}`);
    const tx = await wrappedTransaction.submit();
    console.log(`Kick transaction confirmed. pool: ${pool.name}, borrower: ${borrower}`);
  } catch (error) {
    console.error(`Failed to kick loan. pool: ${pool.name}, borrower: ${borrower}. Error: `, error);
    throw error;
  } finally {
    await approveErc20(signer, pool.quoteAddress, pool.poolAddress, BigNumber.from(0));
  }
}