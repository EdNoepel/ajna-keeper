import { FungiblePool, Signer } from '@ajna-finance/sdk';
import subgraph from './subgraph';
import { delay, numberToWad, wadToNumber } from './utils';
import { KeeperConfig, PoolConfig } from './config';
import { getBalanceOfErc20 } from './erc20';
import { BigNumber } from 'ethers';
import { priceToBucket } from './price';

interface HandleKickParams {
  pool: FungiblePool;
  poolConfig: PoolConfig;
  price: number;
  signer: Signer;
  config: Pick<KeeperConfig, 'dryRun' | 'subgraphUrl' | 'delayBetweenActions'>;
}

export async function handleKicks({
  pool,
  poolConfig,
  price,
  signer,
  config,
}: HandleKickParams) {
  const loansToKick = await getLoansToKick({ pool, poolConfig, price, config });

  for (const loanToKick of loansToKick) {
    await kick({ signer, pool, loanToKick, config, price });
    await delay(config.delayBetweenActions);
  }
}

interface LoanToKick {
  borrower: string;
  liquidationBond: BigNumber;
}

interface GetLoansToKickParams
  extends Pick<HandleKickParams, 'pool' | 'poolConfig' | 'price'> {
  config: Pick<KeeperConfig, 'subgraphUrl'>;
}

export async function getLoansToKick({
  pool,
  config,
  poolConfig,
  price,
}: GetLoansToKickParams): Promise<Array<LoanToKick>> {
  const { subgraphUrl } = config;
  const result: LoanToKick[] = [];

  const {
    pool: { lup, hpb },
    loans,
  } = await subgraph.getLoans(subgraphUrl, pool.poolAddress);
  for (const loanFromSubgraph of loans) {
    const { borrower, thresholdPrice } = loanFromSubgraph;

    // If TP is lower than lup, the bond can not be kicked.
    if (thresholdPrice < lup) continue;

    const { neutralPrice, liquidationBond, debt } =
      await pool.getLoan(borrower);

    // if loan debt is lower than configured fixed value (denominated in quote token), skip it
    if (wadToNumber(debt) < poolConfig.kick!.minDebt) continue;

    // Only kick loans with a neutralPrice above price (with some margin) to ensure they are profitable.
    const isNpAbovePrice =
      wadToNumber(neutralPrice) * poolConfig.kick!.priceFactor > price;

    // Only kick loans with a neutralPrice above hpb to ensure they are profitalbe.
    const isNpAboveHpb = wadToNumber(neutralPrice) > hpb;
    const shouldBeProfitable = isNpAbovePrice && isNpAboveHpb;

    if (shouldBeProfitable) {
      result.push({ borrower, liquidationBond });
    }
  }
  return result;
}

interface KickParams extends Omit<HandleKickParams, 'poolConfig' | 'config'> {
  loanToKick: LoanToKick;
  config: Pick<KeeperConfig, 'dryRun'>;
}

const LIQUIDATION_BOND_MARGIN: number = 1.1; // Add a margin to the liquidation bond to ensure it is enough.

export async function kick({
  pool,
  signer,
  config,
  loanToKick,
  price,
}: KickParams) {
  const { dryRun } = config;
  const { borrower, liquidationBond } = loanToKick;

  if (dryRun) {
    console.debug(
      `DryRun - Would kick loan - pool: ${pool.name}, borrower: ${borrower}`
    );
    return;
  }
  // try {
  console.log(`Kicking loan - pool: ${pool.name}, borrower: ${borrower}`);
  const quoteBalance = await getBalanceOfErc20(signer, pool.quoteAddress);
  if (quoteBalance < liquidationBond) {
    console.log(
      `Balance of token: ${pool.quoteSymbol} too low to kick loan. pool: ${pool.name}, borrower: ${borrower}, bond: ${liquidationBond}`
    );
    return;
  }
  console.log(
    `Approving liquidationBond for kick. pool: ${pool.name}, liquidationBond: ${liquidationBond}, quoteBalance: ${quoteBalance}`
  );
  const bondWithMargin = numberToWad(
    Math.round(wadToNumber(liquidationBond) * LIQUIDATION_BOND_MARGIN)
  );
  const approveTx = await pool.quoteApprove(signer, bondWithMargin);
  await approveTx.verifyAndSubmit();

  const limitIndex = priceToBucket(price, pool);
  console.log(
    `Sending kick transaction. pool: ${pool.name}, borrower: ${borrower}`
  );
  // const wrappedTransaction = await pool.kick(signer, borrower, limitIndex);
  const kickTx = await pool.kick(signer, borrower);
  await kickTx.verifyAndSubmit();
  console.log(
    `Kick transaction confirmed. pool: ${pool.name}, borrower: ${borrower}`
  );
  // } catch (error) {
  //   console.error(
  //     `Failed to kick loan. pool: ${pool.name}, borrower: ${borrower}. Error: `,
  //     error
  //   );
  // } finally {
  //   await pool.quoteApprove(signer, BigNumber.from(0));
  // }
}
