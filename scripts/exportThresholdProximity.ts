/**
 * Users closest to the 6.5 pass threshold (latest recompute).
 *
 * Usage: npx tsx --env-file=.env scripts/exportThresholdProximity.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import {
  recomputeAttemptForAnalytics,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

const THRESHOLD = GATE_PASS_WEIGHTED_MIN;
const BELOW_MIN = 5.8;
const ABOVE_MAX = 7.0;
const TOP_N = 5;

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

const USER_PSYCH_SELECT = `
  id,
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_score,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_sd3_narcissism_score,
  psychometrics_sd3_narcissism_responses,
  psychometrics_npi_entitlement_score,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`;

type Row = {
  userId: string;
  attemptId: string;
  completedAt: string;
  weighted: number;
  modified: number;
  modifiedPsych: number | null;
  interviewPass: boolean;
  finalPass: boolean;
  distFromThreshold: number;
  gateFailReasons: string[];
};

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
    console.error('Missing Supabase env');
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<RawAttemptForAnalytics[]> {
  const pageSize = 1000;
  const all: RawAttemptForAnalytics[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(ATTEMPT_SELECT)
      .not('completed_at', 'is', null)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as RawAttemptForAnalytics[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function fetchUsersByIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(userIds)];
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }
  return map;
}

function toRow(a: ReturnType<typeof recomputeAttemptForAnalytics>): Row | null {
  const modified = a.modified_weighted_score;
  if (modified == null || !Number.isFinite(modified)) return null;
  const weighted = a.weighted_score ?? modified;
  return {
    userId: a.user_id,
    attemptId: a.id,
    completedAt: a.completed_at,
    weighted,
    modified,
    modifiedPsych: a.modified_weighted_score_with_psychometrics,
    interviewPass: a.passed === true,
    finalPass: a.final_gate_pass === true,
    distFromThreshold: Math.abs(modified - THRESHOLD),
    gateFailReasons: a.gate_fail_reasons ?? [],
  };
}

function printTable(title: string, rows: Row[]): void {
  console.log(title);
  console.log('='.repeat(title.length));
  if (rows.length === 0) {
    console.log('(none)\n');
    return;
  }
  console.log(
    'user_id     attempt_id  modified  weighted  psych_mod  Δ6.5   interview  final  gate_fail_reasons',
  );
  for (const r of rows) {
    const psych =
      r.modifiedPsych != null && Number.isFinite(r.modifiedPsych)
        ? r.modifiedPsych.toFixed(2)
        : '—';
    const delta = (r.modified - THRESHOLD).toFixed(2);
    const reasons = r.gateFailReasons.length ? r.gateFailReasons.join(',') : '—';
    console.log(
      `${r.userId.slice(0, 8)}  ${r.attemptId.slice(0, 8)}  ${r.modified.toFixed(2).padStart(8)}  ${r.weighted.toFixed(2).padStart(8)}  ${psych.padStart(9)}  ${delta.padStart(5)}  ${r.interviewPass ? 'PASS' : 'FAIL '}     ${r.finalPass ? 'PASS' : 'FAIL '}  ${reasons}`,
    );
  }
  console.log('');
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const supabase = createAdminClient();
  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((r) => r.user_id),
  );

  const prevLog = console.log;
  console.log = () => {};
  const scorable = raw
    .map((row) => recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null))
    .filter((a) => a.recomputeStatus === 'success')
    .map(toRow)
    .filter((r): r is Row => r != null);
  console.log = prevLog;

  const below = scorable
    .filter((r) => r.modified >= BELOW_MIN && r.modified < THRESHOLD)
    .sort((a, b) => b.modified - a.modified)
    .slice(0, TOP_N);

  const above = scorable
    .filter(
      (r) =>
        r.modified >= THRESHOLD &&
        r.modified <= ABOVE_MAX &&
        r.finalPass,
    )
    .sort((a, b) => a.modified - b.modified)
    .slice(0, TOP_N);

  console.log(`THRESHOLD PROXIMITY (scorable N=${scorable.length}, threshold=${THRESHOLD})`);
  console.log(`Score field: modified_weighted_score (latest algorithm recompute)\n`);

  printTable(`CLOSEST ${TOP_N} FROM BELOW (${BELOW_MIN}–${THRESHOLD})`, below);
  printTable(`CLOSEST ${TOP_N} FROM ABOVE AMONG PASSERS (${THRESHOLD}–${ABOVE_MAX})`, above);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
