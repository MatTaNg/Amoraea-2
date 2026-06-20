/**
 * Aggregate validation cohort statistics (relationship track).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/validationCohortStatistics.ts
 *   npx tsx --env-file=.env scripts/validationCohortStatistics.ts --include-platonic-test-data
 */
import { createClient } from '@supabase/supabase-js';
import {
  filterValidationCohortRows,
  parseIncludePlatonicTestDataFlag,
} from '../src/features/relationshipValidation/validationCohortFilters';
import { RELATIONSHIP_VALIDATION_TRACK } from '../src/features/relationshipValidation/constants';

type CohortRow = {
  user_id: string;
  relationship_test_mode: 'romantic' | 'platonic' | null;
  pre_assessment: { overallCompatibility?: number; overallSatisfaction?: number } | null;
  post_assessment: { scoreAccuracy?: number } | null;
  compatibility_score: number | null;
  psychometrics_completed_at: string | null;
  pair_confirmed_at: string | null;
  partner_user_id: string | null;
};

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den < 1e-9) return null;
  return num / den;
}

async function main(): Promise<void> {
  const includePlatonic = parseIncludePlatonicTestDataFlag(process.argv.slice(2));
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key);
  const { data: users, error: usersErr } = await supabase
    .from('users')
    .select('id')
    .eq('validation_track', RELATIONSHIP_VALIDATION_TRACK);
  if (usersErr) throw usersErr;

  const ids = (users ?? []).map((u) => u.id);
  if (ids.length === 0) {
    console.log('No relationship validation participants.');
    return;
  }

  const { data: rawRows, error: recErr } = await supabase
    .from('relationship_validation_records')
    .select(
      'user_id, relationship_test_mode, pre_assessment, post_assessment, compatibility_score, psychometrics_completed_at, pair_confirmed_at, partner_user_id',
    )
    .in('user_id', ids);
  if (recErr) throw recErr;

  const allRows = (rawRows ?? []) as CohortRow[];
  const rows = filterValidationCohortRows(allRows, includePlatonic);
  const excludedPlatonic = allRows.length - rows.length;

  const preCompat = rows
    .map((r) => r.pre_assessment?.overallCompatibility)
    .filter((n): n is number => typeof n === 'number');
  const postAccuracy = rows
    .map((r) => r.post_assessment?.scoreAccuracy)
    .filter((n): n is number => typeof n === 'number');

  const selfReport: number[] = [];
  const algo: number[] = [];
  for (const row of rows) {
    const self = row.pre_assessment?.overallCompatibility;
    const score = row.compatibility_score;
    if (typeof self === 'number' && typeof score === 'number') {
      selfReport.push(self);
      algo.push(score * 10);
    }
  }

  console.log('Relationship validation cohort statistics');
  console.log(`Include platonic test data: ${includePlatonic}`);
  console.log(`Participants (filtered): ${rows.length}`);
  if (!includePlatonic && excludedPlatonic > 0) {
    console.log(`Excluded platonic test rows: ${excludedPlatonic}`);
  }
  console.log(`Avg pre-assessment compatibility (1–10): ${avg(preCompat)?.toFixed(2) ?? '—'}`);
  console.log(`Avg post-assessment score accuracy (1–10): ${avg(postAccuracy)?.toFixed(2) ?? '—'}`);
  const correlation = pearson(selfReport, algo);
  console.log(
    `Correlation (self-report vs algorithm): ${correlation != null ? correlation.toFixed(3) : '—'}${
      selfReport.length > 0 ? ` (n=${selfReport.length})` : ''
    }`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
