/**
 * Exact descriptive statistics for recomputed scorable interview attempts.
 *
 * Usage: npx tsx --env-file=.env scripts/scoreStatistics.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import {
  recomputeAttemptForAnalytics,
  type AnalyticsAttempt,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';

const PILLAR_NAMES = [
  'repair',
  'contempt',
  'attunement',
  'regulation',
  'mentalizing',
  'appreciation',
  'accountability',
  'commitment_threshold',
] as const;

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

type ScoreStats = {
  n: number;
  mean: number;
  median: number;
  stdDev: number;
  min: number;
  max: number;
  p25: number;
  p75: number;
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
    console.error('Missing Supabase env (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
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

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0]!;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const w = idx - lo;
  return sorted[lo]! * (1 - w) + sorted[hi]! * w;
}

function describe(values: number[]): ScoreStats | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const median = percentile(sorted, 0.5);
  const variance =
    n > 1 ? sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (n - 1) : 0;
  return {
    n,
    mean: round2(mean),
    median: round2(median),
    stdDev: round2(Math.sqrt(variance)),
    min: round2(sorted[0]!),
    max: round2(sorted[n - 1]!),
    p25: round2(percentile(sorted, 0.25)),
    p75: round2(percentile(sorted, 0.75)),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

function fmtStat(v: number): string {
  return v.toFixed(2);
}

function printScoreRow(label: string, stats: ScoreStats | null, suffix = ''): void {
  if (!stats) {
    console.log(`${padRight(label, 38)} (no data)${suffix}`);
    return;
  }
  console.log(
    `${padRight(label, 38)}${padLeft(fmtStat(stats.mean), 8)}${padLeft(fmtStat(stats.median), 9)}${padLeft(fmtStat(stats.stdDev), 9)}${padLeft(fmtStat(stats.min), 7)}${padLeft(fmtStat(stats.max), 7)}${padLeft(fmtStat(stats.p25), 7)}${padLeft(fmtStat(stats.p75), 7)}${suffix}`,
  );
}

function printPillarRow(pillar: string, stats: ScoreStats | null): void {
  if (!stats) {
    console.log(`${padRight(pillar, 22)} (no data)`);
    return;
  }
  console.log(
    `${padRight(pillar, 22)}${padLeft(fmtStat(stats.mean), 8)}${padLeft(fmtStat(stats.median), 9)}${padLeft(fmtStat(stats.stdDev), 9)}${padLeft(fmtStat(stats.p25), 7)}${padLeft(fmtStat(stats.p75), 7)}`,
  );
}

function percentileRankBelow(values: number[], threshold: number): number {
  if (values.length === 0) return NaN;
  const below = values.filter((v) => v < threshold).length;
  return round2((below / values.length) * 100);
}

function recomputeAllSilently(
  rows: RawAttemptForAnalytics[],
  usersById: Map<string, Record<string, unknown>>,
): AnalyticsAttempt[] {
  const prevLog = console.log;
  console.log = () => {};
  try {
    return rows.map((row) =>
      recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null),
    );
  } finally {
    console.log = prevLog;
  }
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const supabase = createAdminClient();

  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((a) => a.user_id),
  );

  const recomputed = recomputeAllSilently(raw, usersById);
  const scorable = recomputed.filter((a) => a.recomputeStatus === 'success');
  const excluded = recomputed.length - scorable.length;

  const weighted = scorable
    .map((a) => finiteNumber(a.weighted_score))
    .filter((v): v is number => v != null);
  const modified = scorable
    .map((a) => finiteNumber(a.modified_weighted_score))
    .filter((v): v is number => v != null);
  const modifiedPsych = scorable
    .map((a) => finiteNumber(a.modified_weighted_score_with_psychometrics))
    .filter((v): v is number => v != null);

  const passCount = scorable.filter((a) => a.final_gate_pass === true).length;
  const passRate = scorable.length > 0 ? (passCount / scorable.length) * 100 : 0;

  const threshold = GATE_PASS_WEIGHTED_MIN;
  const modStats = describe(modified);
  const distFromMeanStd =
    modStats && modStats.stdDev > 0 ? round2((threshold - modStats.mean) / modStats.stdDev) : NaN;
  const pctBelowThreshold = percentileRankBelow(modified, threshold);

  console.log(`EXACT SCORE STATISTICS (scorable attempts only, N=${scorable.length})`);
  if (excluded > 0) {
    console.log(`(${excluded} rows with completed_at excluded — incomplete interview slices)`);
  }
  console.log('========================================================');
  console.log(
    `${padRight('Field', 38)}${padLeft('Mean', 8)}${padLeft('Median', 9)}${padLeft('StdDev', 9)}${padLeft('Min', 7)}${padLeft('Max', 7)}${padLeft('P25', 7)}${padLeft('P75', 7)}`,
  );
  printScoreRow('weighted_score', describe(weighted));
  printScoreRow('modified_weighted_score', describe(modified));
  printScoreRow(
    'modified_weighted_score_with_psych',
    describe(modifiedPsych),
    `  (N=${modifiedPsych.length}, excludes incomplete psychometrics)`,
  );
  console.log('');

  console.log('PILLAR STATISTICS');
  console.log('==================');
  console.log(
    `${padRight('Pillar', 22)}${padLeft('Mean', 8)}${padLeft('Median', 9)}${padLeft('StdDev', 9)}${padLeft('P25', 7)}${padLeft('P75', 7)}`,
  );
  for (const pillar of PILLAR_NAMES) {
    const vals = scorable
      .map((a) => finiteNumber(a.pillar_scores?.[pillar]))
      .filter((v): v is number => v != null);
    printPillarRow(pillar, describe(vals));
  }
  console.log('');

  console.log('THRESHOLD POSITION RELATIVE TO DISTRIBUTION');
  console.log('==============================================');
  console.log(`Current pass threshold: ${threshold}`);
  console.log(
    `Distance from mean (in StdDev units): ${Number.isFinite(distFromMeanStd) ? distFromMeanStd.toFixed(2) : 'n/a'} (modified_weighted_score)`,
  );
  console.log(
    `Percentile rank of ${threshold} (share strictly below): ${Number.isFinite(pctBelowThreshold) ? `${pctBelowThreshold.toFixed(1)}%` : 'n/a'} (modified_weighted_score)`,
  );
  console.log(
    `Cross-check — final_gate_pass rate: ${passRate.toFixed(1)}% (${passCount}/${scorable.length}); 1 − pass rate = ${(100 - passRate).toFixed(1)}%`,
  );
  console.log(
    'Note: % below threshold uses score only; final_gate_pass also fails on scenario/pillar floors above threshold.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
