import { Address, FungiblePool, Pool, Signer } from '@ajna-finance/sdk'
import { getLoans } from './subgraph';
import { delay, wadToNumber } from './utils';
import { KeeperConfig, PoolConfig } from './config';
import { approveErc20, getBalanceOfErc20 } from './erc20';
import { BigNumber } from 'ethers';
import { priceToBucket } from './price';

export async function handleKicks(handleKickParams: {
  pool: FungiblePool,
  poolConfig: PoolConfig,
  price: number,
  signer: Signer,
  config: Pick<KeeperConfig, "dryRun" | "subgraphUrl" | "delayBetweenActions">
}) {
  const {
    signer,
    pool,
    poolConfig,
    price,
    config: {
      subgraphUrl,
      delayBetweenActions,
      dryRun,
    }
  } = handleKickParams;

  const {pool: {lup, hpb}, loans} = await getLoans(subgraphUrl, pool.poolAddress)
  for(const loanFromSubgraph of loans) {
    const {borrower, thresholdPrice} = loanFromSubgraph

    // If TP is lower than lup, the bond can not be kicked.
    if (thresholdPrice < lup) continue

    const {neutralPrice, liquidationBond, debt} = await pool.getLoan(borrower)

    // if loan debt is lower than configured fixed value (denominated in quote token), skip it
    if (wadToNumber(debt) < poolConfig.kick!.minDebt) continue

    // Only kick loans with a neutralPrice above price (with some margin) to ensure they are profitable.
    const isNpAbovePrice = wadToNumber(neutralPrice) * poolConfig.kick!.priceFactor > price;

    // Only kick loans with a neutralPrice above hpb to ensure they are profitalbe.
    const isNpAboveHpb = wadToNumber(neutralPrice) > hpb;
    const shouldBeProfitable = isNpAbovePrice && isNpAboveHpb;

    if (shouldBeProfitable) {
      if (!dryRun) {
        console.log(`Kicking loan - pool: ${pool.name}, borrower: ${borrower}, NP: ${neutralPrice}, feedPrice: ${price}`);
        await kick(signer, pool, borrower, price, liquidationBond);
      }else {
        console.debug(`DryRun - Would kick loan - pool: ${pool.name}, borrower: ${borrower}, NP: ${neutralPrice}, feedPrice: ${price}`);
      }
    }

    await delay(delayBetweenActions);
  }
}

export async function kick(signer: Signer, pool: FungiblePool, borrower: Address, limitPrice: number, liquidationBond: BigNumber) {
  try {
    const quoteBalance = await getBalanceOfErc20(signer, pool.quoteAddress);
    if (quoteBalance < liquidationBond) {
      console.log(`Balance of token: ${pool.quoteSymbol} too low to kick loan. pool: ${pool.name}, borrower: ${borrower}, bond: ${liquidationBond}`)
      return;
    }
    console.log(`Approving liquidationBond for kick. pool: ${pool.name}, liquidationBond: ${liquidationBond}`);
    await approveErc20(signer, pool.quoteAddress, pool.poolAddress, liquidationBond);

    
    const limitIndex = priceToBucket(limitPrice, pool);
    console.log(`Sending kick transaction. pool: ${pool.name}, borrower: ${borrower}`);
    const wrappedTransaction = await pool.kick(signer, borrower, limitIndex);

    await wrappedTransaction.submit();
    console.log(`Kick transaction confirmed. pool: ${pool.name}, borrower: ${borrower}`);
  } catch (error) {
    console.error(`Failed to kick loan. pool: ${pool.name}, borrower: ${borrower}. Error: `, error);
  } finally {
    await approveErc20(signer, pool.quoteAddress, pool.poolAddress, BigNumber.from(0));
  }
}