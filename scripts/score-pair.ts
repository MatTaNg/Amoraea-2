/**
 * Score a user pair with the v2 deterministic compatibility algorithm.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/score-pair.ts <userIdA> <userIdB>
 */
import { computePairCompatibilityScore } from '../src/features/compatibility/computePairCompatibilityScore';
import {
  createServiceRoleSupabase,
  loadMatchmakingUserSnapshot,
} from '../src/features/compatibility/loadMatchmakingUserSnapshot';
import { mapMatchmakingUserToCompatibilityInputs } from '../src/features/compatibility/mapMatchmakingUserToCompatibilityInputs';

async function main(): Promise<void> {
  const userIdA = process.argv[2];
  const userIdB = process.argv[3];
  if (!userIdA || !userIdB) {
    console.error('Usage: npx tsx --env-file=.env scripts/score-pair.ts <userIdA> <userIdB>');
    process.exit(1);
  }

  const supabase = createServiceRoleSupabase();
  const [loadedA, loadedB] = await Promise.all([
    loadMatchmakingUserSnapshot(supabase, userIdA),
    loadMatchmakingUserSnapshot(supabase, userIdB),
  ]);

  const mappedA = mapMatchmakingUserToCompatibilityInputs(loadedA.snapshot, loadedA.extras);
  const mappedB = mapMatchmakingUserToCompatibilityInputs(loadedB.snapshot, loadedB.extras);
  const result = computePairCompatibilityScore(mappedA, mappedB);

  const displayScore = Math.round(result.finalScore * 100);

  console.log(JSON.stringify({
    userA: userIdA,
    userB: userIdB,
    compatibilityScore: displayScore,
    compatibilityScoreNormalized: result.finalScore,
    dealbreakerMultiplier: result.subscores.dealbreakerMultiplier,
    subscores: result.subscores,
    adjustments: result.adjustments,
    breakdown: result.breakdown,
    eligibleForMatching: {
      userA: loadedA.snapshot.eligibleForMatching ?? null,
      userB: loadedB.snapshot.eligibleForMatching ?? null,
    },
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
