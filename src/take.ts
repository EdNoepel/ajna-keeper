import { Signer, FungiblePool } from '@ajna-finance/sdk'
import { getLiquidations } from './subgraph';
import { delay } from './utils';
import { KeeperConfig, PoolConfig } from './config';
import { getAuctionPrice } from './price';
import { getTime } from './time';

interface HandleArbParams {
  signer: Signer,
  pool: FungiblePool,
  poolConfig: PoolConfig,
  config: Pick<KeeperConfig, "dryRun" | "subgraphUrl" | "delayBetweenActions">,
}

export async function handleArbTakes({signer, pool, poolConfig, config}: HandleArbParams) {
  const { subgraphUrl, delayBetweenActions, dryRun, } = config;
  const {pool: {hpb, hpbIndex, liquidationAuctions}} = await getLiquidations(subgraphUrl, pool.poolAddress, poolConfig.take!.minCollateral);
  for (const auction of liquidationAuctions) {
    const {borrower, kickTime, referencePrice} = auction;
    const timeElapsed = getTime() - kickTime;
    const currentPrice = getAuctionPrice(referencePrice, timeElapsed);

    if (currentPrice < hpb) {
      const liquidation = {borrower, hpbIndex};
      await arbTakeLiquidation({pool, poolConfig, signer, liquidation, config});
    }
  }
}

interface LiquidationToArbTake {
  borrower: string;
  hpbIndex: number;
}

interface ArbTakeLiquidationParams {
  pool: FungiblePool,
  poolConfig: PoolConfig,
  signer: Signer,
  liquidation: LiquidationToArbTake,
  config: Pick<KeeperConfig, "delayBetweenActions" | "dryRun">,
}

async function arbTakeLiquidation({pool, poolConfig, signer, liquidation, config}: ArbTakeLiquidationParams) {
  const {borrower, hpbIndex} = liquidation;
  const {delayBetweenActions, dryRun} = config;

  if (dryRun) {
    console.log(`DryRun - would ArbTake - poolAddress: ${pool.poolAddress}, borrower: ${borrower}`);
  } else {
    // TODO: should we loop through this step until collateral remaining is zero?
    console.log(`Sending ArbTake Tx - poolAddress: ${pool.poolAddress}, borrower: ${borrower}`);
    const liquidationSdk = pool.getLiquidation(borrower);
    const arbTakeTx = await liquidationSdk.arbTake(signer, hpbIndex);
    await arbTakeTx.verifyAndSubmit();
    console.log(`ArbTake successful - poolAddress: ${pool.poolAddress}, borrower: ${borrower}`);

    // withdraw liquidity.
    if (poolConfig.take!.withdrawRewardLiquidity) {
      const withdrawTx = await pool.withdrawLiquidity(signer, [hpbIndex]);
      await withdrawTx.verifyAndSubmit();
      await delay(delayBetweenActions);
    }
  }
}