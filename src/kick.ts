import { Address, Pool, Signer } from '@ajna-finance/sdk'
import { getLoans } from './subgraph';
import { delay, bigNumberToWad } from './utils';
import { PoolConfig } from './config';
import { approveErc20, getBalanceOfErc20 } from './erc20';
import { BigNumber } from 'ethers';

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
    const {borrower, inLiquidation, thresholdPrice} = loanFromSubgraph

    // Cannot kick bonds which are already being liquidated.
    if (inLiquidation) continue

    // If TP is lower than lup, the bond can not be kicked.
    if (thresholdPrice >= lup) continue

    const {neutralPrice, liquidationBond, debt} = await pool.getLoan(borrower)

    // if loan debt is lower than configured fixed value (denominated in quote token), skip it
    // TODO: Does the decimals of the token impact the use of bigNumberToWad?
    if (bigNumberToWad(debt) < poolConfig.kick!.minDebt) continue

    // Only kick bonds which are lower than the price * priceFactor to ensure that they are profitable.
    const shouldBeProfitable = bigNumberToWad(neutralPrice) * poolConfig.kick!.priceFactor > price;

    // TODO: Make sure that user has enough QT to fund Liquidation Bond. 
    //    Note: If two kicks happen simultaneously, make sure they do not overdraft.
    if (shouldBeProfitable) {
      if (!dryRun) {
        console.log(`Kicking loan - pool: ${pool.name}, borrower: ${borrower}, TP: ${thresholdPrice}, feedPrice: ${price}`);
        await kick(signer, pool, borrower, liquidationBond);
      }else {
        console.log(`DryRun - Would kick loan - pool: ${pool.name}, borrower: ${borrower}, TP: ${thresholdPrice}, feedPrice: ${price}`);
      }
    }

    await delay(delayBetweenLoans);
  }
}

export async function kick(signer: Signer, pool: Pool, borrower: Address, liquidationBond: BigNumber) {
  try {
    const collateralBalance = await getBalanceOfErc20(signer, pool.collateralAddress);
    if (collateralBalance < liquidationBond) {
      console.log(`Balance of token: ${pool.collateralSymbol} too low to kick loan. pool: ${pool.name}, borrower: ${borrower}, bond: ${liquidationBond}`)
      return;
    }
    console.log(`Approving liquidationBond for kick. pool: ${pool.name}, liquidationBond: ${liquidationBond}`);
    await approveErc20(signer, pool.quoteAddress, pool.poolAddress, liquidationBond.mul(APPROVAL_AMOUNT_FACTOR));
    const wrappedTransaction = await pool.kick(signer, borrower);  // TODO: Add limitIndex?
    console.log(`Kicking loan. pool: ${pool.name}, borrower: ${borrower}`);
    const tx = await wrappedTransaction.submit();
    console.log(`Kick transaction confirmed. pool: ${pool.name}, borrower: ${borrower}`);
  } catch (error) {
    console.error(`Failed to kick loan. pool: ${pool.name}, borrower: ${borrower}. Error: `, error);
    throw error;
  } finally {
    await approveErc20(signer, pool.quoteAddress, pool.poolAddress, BigNumber.from(0));
  }
}