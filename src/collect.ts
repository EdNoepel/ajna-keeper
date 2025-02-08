import { FungiblePool, Signer } from '@ajna-finance/sdk';
import subgraph, { GetRewardsResponse } from './subgraph';
import { KeeperConfig, PoolConfig } from './config';
import { RequireFields } from './utils';

interface HandleRewardsParams {
  pool: FungiblePool;
  poolConfig: RequireFields<PoolConfig, 'collect'>;
  signer: Signer;
  config: Pick<KeeperConfig, 'subgraphUrl'>;
}

/**
 Subscribe to BucketTakeLPAwarded(taker, kicker, lpAwardedTaker, lpAwardedKicker)
  on BucketTakeLPAwarded: try to collect LP. If LP is locked, subscribe to AuctionSettle.

 Subscribe to Kick(borrower, debt, collateral, bond)
  on Kick: try to collect.

 Subscribe to AuctionSettle(borrower, collateral)
 */

async function getCollectRewards({
  pool,
  poolConfig,
  signer,
  config,
}: HandleRewardsParams) {
  const poolContract = pool.contract.connect(signer);
  poolContract.filters.KickEvent();
  contract.queryFilter();
}

export async function handleCollect({
  pool,
  poolConfig,
  signer,
  config,
}: HandleRewardsParams) {
  const borrower = await signer.getAddress();
  const rewards = await subgraph.getRewards(
    config.subgraphUrl,
    pool.poolAddress,
    borrower
  );
  const { lends, kicks } = rewards.account;
  if (poolConfig.collect.collectLiquidity) {
    await collectTakeRewards({ pool, signer, lends });
  }
  if (poolConfig.collect.collectBonds) {
    await collectBond({ pool, signer, kicks });
  }
}

type LendRewards = GetRewardsResponse['account']['lends'];

interface CollectTakeRewardsParams
  extends Pick<HandleRewardsParams, 'pool' | 'signer'> {
  lends: LendRewards;
}

async function collectTakeRewards({
  pool,
  signer,
  lends,
}: CollectTakeRewardsParams) {
  if (lends.length == 0) return;
  const bucketIndices = lends.map(({ bucketIndex }) => bucketIndex);
  console.log(`Withdrawing liquidity from pool: ${pool.name}`);
  const withdrawTx = await pool.withdrawLiquidity(signer, bucketIndices);
  await withdrawTx.verifyAndSubmit();
  console.log(`Successfully withdrew liquidity from pool: ${pool.name}`);
}

type KickRewards = GetRewardsResponse['account']['kicks'];

interface CollectBondParams
  extends Pick<HandleRewardsParams, 'pool' | 'signer'> {
  kicks: KickRewards;
}
async function collectBond({ pool, signer, kicks }: CollectBondParams) {
  if (kicks.length == 0) return;
  console.log(`Withdrawing bonds from pool: ${pool.name}`);
  const withdrawTx = await pool.withdrawBonds(signer);
  withdrawTx.verifyAndSubmit();
  console.log(`Successfully withdrew bonds from pool: ${pool.name}`);
}
