/**
 * Depth signal modifier distribution: all completed attempts vs scorable vs incomplete.
 * Usage: npx tsx --env-file=.env scripts/depthModifierBreakdown.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  recomputeAttemptForAnalytics,
  type AnalyticsAttempt,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

const ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  is_phantom,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  ego_development_level,
  language_markers,
  skip_count,
  skip_penalty_total,
  auto_failed,
  defense_patterns,
  mentalizing_overcertainty_count,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  review_flags,
  reasoning_pending,
  probe_log
`;

function mergeEnvFromDotenvFile(): void {
  try {
    const path = join(process.cwd(), '.env');
    if (!existsSync(path)) return;
    const txt = readFileSync(path, 'utf8');
    for (const line of txt.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq < 1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (process.env[k] === undefined) process.env[k] = v;
    }
  } catch {
    /* ignore */
  }
}

function createAdminClient(): SupabaseClient {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing Supabase env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<RawAttemptForAnalytics[]> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');
  if (error) throw new Error(error.message);
  return (data ?? []) as RawAttemptForAnalytics[];
}

function depthModifier(a: AnalyticsAttempt): number | null {
  if (typeof a.depth_signal_modifier === 'number' && Number.isFinite(a.depth_signal_modifier)) {
    return a.depth_signal_modifier;
  }
  if (typeof a.score_modifier === 'number' && Number.isFinite(a.score_modifier)) {
    return a.score_modifier;
  }
  return null;
}

function printDist(label: string, arr: AnalyticsAttempt[]): void {
  const vals = arr.map(depthModifier).filter((v): v is number => v != null);
  const pos = vals.filter((v) => v > 0).length;
  const zero = vals.filter((v) => v === 0).length;
  const neg = vals.filter((v) => v < 0).length;
  const nulls = arr.length - vals.length;
  console.log(`${label} n=${arr.length} withModifier=${vals.length} null=${nulls}`);
  if (vals.length === 0) return;
  console.log(`  pos  ${pos} (${((pos / vals.length) * 100).toFixed(1)}%)`);
  console.log(`  zero ${zero} (${((zero / vals.length) * 100).toFixed(1)}%)`);
  console.log(`  neg  ${neg} (${((neg / vals.length) * 100).toFixed(1)}%)`);
  console.log(`  avg  ${(vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(3)}`);
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const supabase = createAdminClient();
  const raw = await fetchCompletedAttempts(supabase);

  const prevLog = console.log;
  console.log = () => {};
  let all: AnalyticsAttempt[];
  try {
    all = raw.map((row) => recomputeAttemptForAnalytics(row, null));
  } finally {
    console.log = prevLog;
  }

  const scorable = all.filter((a) => a.recomputeStatus === 'success');
  const incomplete = all.filter((a) => a.recomputeStatus !== 'success');

  console.log('DEPTH SIGNAL MODIFIER — SCORABLE VS INCOMPLETE');
  console.log('==============================================');
  printDist('ALL completed', all);
  printDist('SCORABLE (recompute success)', scorable);
  printDist('EXCLUDED incomplete', incomplete);
  console.log('');
  console.log(
    'Incomplete attempts:',
    incomplete.map((a) => ({
      id: a.id.slice(0, 8),
      dm: depthModifier(a),
      status: a.recomputeStatus,
      note: a.recomputeNotes?.[0],
    })),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
