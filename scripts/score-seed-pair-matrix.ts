/**
 * Score every ordered pair (12×12) of compat-algo-v2 seed users and write JSON results.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/score-seed-pair-matrix.ts
 *   npx tsx --env-file=.env scripts/score-seed-pair-matrix.ts --out scripts/output/compat-matrix.json
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { computePairCompatibilityScore } from '../src/features/compatibility/computePairCompatibilityScore';
import {
  createServiceRoleSupabase,
  loadMatchmakingUserSnapshot,
} from '../src/features/compatibility/loadMatchmakingUserSnapshot';
import {
  mapMatchmakingUserToCompatibilityInputs,
  type MappedUserCompatibilityInputs,
} from '../src/features/compatibility/mapMatchmakingUserToCompatibilityInputs';

const SEED_TAG = 'compat-algo-v2';

type SeedUser = {
  slug: string;
  label: string;
  index: number;
  userId: string;
};

type PairResult = {
  slugA: string;
  slugB: string;
  labelA: string;
  labelB: string;
  userIdA: string;
  userIdB: string;
  compatibilityScore: number;
  finalScore: number;
  dealbreakerMultiplier: 0 | 1;
  subscores: ReturnType<typeof computePairCompatibilityScore>['subscores'];
  adjustments: ReturnType<typeof computePairCompatibilityScore>['adjustments'];
  breakdown: ReturnType<typeof computePairCompatibilityScore>['breakdown'];
};

async function loadSeedUsers(): Promise<SeedUser[]> {
  const supabase = createServiceRoleSupabase();
  const { data, error } = await supabase.from('profiles').select('id, profile_json');
  if (error) throw new Error(`profiles: ${error.message}`);

  const users: SeedUser[] = [];
  for (const row of data ?? []) {
    const seed = (row.profile_json as Record<string, unknown> | null)?.compatibilityTestSeed;
    if (
      !seed ||
      typeof seed !== 'object' ||
      Array.isArray(seed) ||
      (seed as Record<string, unknown>).tag !== SEED_TAG
    ) {
      continue;
    }
    const s = seed as Record<string, unknown>;
    const slug = String(s.slug ?? '').trim();
    if (!slug) continue;
    users.push({
      slug,
      label: String(s.label ?? slug),
      index: typeof s.index === 'number' ? s.index : 0,
      userId: row.id,
    });
  }

  users.sort((a, b) => a.index - b.index || a.slug.localeCompare(b.slug));
  if (users.length === 0) {
    throw new Error(`No seed users found with tag "${SEED_TAG}". Run: npm run seed-test-users`);
  }
  return users;
}

async function preloadMappedInputs(
  users: SeedUser[],
): Promise<Map<string, { user: SeedUser; mapped: MappedUserCompatibilityInputs }>> {
  const supabase = createServiceRoleSupabase();
  const out = new Map<string, { user: SeedUser; mapped: MappedUserCompatibilityInputs }>();

  await Promise.all(
    users.map(async (user) => {
      const loaded = await loadMatchmakingUserSnapshot(supabase, user.userId);
      const mapped = mapMatchmakingUserToCompatibilityInputs(loaded.snapshot, loaded.extras);
      out.set(user.slug, { user, mapped });
    }),
  );

  return out;
}

function parseOutPath(): string {
  const outIdx = process.argv.indexOf('--out');
  if (outIdx >= 0 && process.argv[outIdx + 1]) {
    return resolve(process.argv[outIdx + 1]);
  }
  return resolve('scripts/output/compat-seed-pair-matrix.json');
}

async function main(): Promise<void> {
  const outFile = parseOutPath();
  const users = await loadSeedUsers();
  const bySlug = await preloadMappedInputs(users);

  const results: PairResult[] = [];
  const scoreMatrix: Record<string, Record<string, number>> = {};

  for (const userA of users) {
    scoreMatrix[userA.slug] = {};
    const entryA = bySlug.get(userA.slug);
    if (!entryA) {
      throw new Error(`Missing mapped inputs for ${userA.slug}`);
    }

    for (const userB of users) {
      const entryB = bySlug.get(userB.slug);
      if (!entryB) {
        throw new Error(`Missing mapped inputs for ${userB.slug}`);
      }

      const result = computePairCompatibilityScore(entryA.mapped, entryB.mapped);
      scoreMatrix[userA.slug][userB.slug] = result.finalScore;

      results.push({
        slugA: userA.slug,
        slugB: userB.slug,
        labelA: userA.label,
        labelB: userB.label,
        userIdA: userA.userId,
        userIdB: userB.userId,
        compatibilityScore: Math.round(result.finalScore * 100),
        finalScore: result.finalScore,
        dealbreakerMultiplier: result.subscores.dealbreakerMultiplier,
        subscores: result.subscores,
        adjustments: result.adjustments,
        breakdown: result.breakdown,
      });
    }
  }

  const sortedByScore = [...results].sort((a, b) => b.finalScore - a.finalScore);

  const payload = {
    generatedAt: new Date().toISOString(),
    seedTag: SEED_TAG,
    userCount: users.length,
    pairCount: results.length,
    users: users.map((u) => ({
      slug: u.slug,
      label: u.label,
      index: u.index,
      userId: u.userId,
    })),
    scoreMatrix,
    highestPairs: sortedByScore.slice(0, 10).map((r) => ({
      pair: `${r.labelA} + ${r.labelB}`,
      slugA: r.slugA,
      slugB: r.slugB,
      finalScore: r.finalScore,
      compatibilityScore: r.compatibilityScore,
    })),
    lowestPairs: sortedByScore
      .slice(-10)
      .reverse()
      .map((r) => ({
        pair: `${r.labelA} + ${r.labelB}`,
        slugA: r.slugA,
        slugB: r.slugB,
        finalScore: r.finalScore,
        compatibilityScore: r.compatibilityScore,
      })),
    zeroScorePairs: results
      .filter((r) => r.finalScore === 0)
      .map((r) => ({
        pair: `${r.labelA} + ${r.labelB}`,
        slugA: r.slugA,
        slugB: r.slugB,
        dealbreakerMultiplier: r.dealbreakerMultiplier,
      })),
    pairs: results,
  };

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');

  console.log(`Wrote ${outFile}`);
  console.log(`Users: ${users.length} | Ordered pairs: ${results.length}`);
  console.log(
    `Top: ${sortedByScore[0].labelA} + ${sortedByScore[0].labelB} → ${(sortedByScore[0].finalScore * 100).toFixed(1)}%`,
  );
  console.log(
    `Bottom: ${sortedByScore[sortedByScore.length - 1].labelA} + ${sortedByScore[sortedByScore.length - 1].labelB} → ${(sortedByScore[sortedByScore.length - 1].finalScore * 100).toFixed(1)}%`,
  );
  console.log(`Zero scores: ${payload.zeroScorePairs.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
