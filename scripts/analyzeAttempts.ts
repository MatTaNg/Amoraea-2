/**
 * Comprehensive analytics report for completed interview attempts.
 *
 * Recomputes interview scores from stored scenario/moment slices using the current
 * aggregate + gate algorithm, then applies the current psychometric modifier and floors.
 * Does not re-run LLM scoring — uses persisted slice JSON like `rescoreUsers --mode aggregate`.
 *
 * Usage:
 *   npx tsx scripts/analyzeAttempts.ts
 *   npx tsx scripts/analyzeAttempts.ts --json
 *   npx tsx scripts/analyzeAttempts.ts --stored   # legacy: use DB-persisted scores only
 *
 * Loads `.env` from the repo root when Supabase env vars are unset.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  ANALYTICS_RECOMPUTE_ALGORITHM,
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

const SCORE_BUCKETS = [
  { label: '< 5.0', min: -Infinity, max: 5.0, exclusiveMax: true },
  { label: '5.0-5.5', min: 5.0, max: 5.5, exclusiveMax: true },
  { label: '5.5-6.0', min: 5.5, max: 6.0, exclusiveMax: true },
  { label: '6.0-6.5', min: 6.0, max: 6.5, exclusiveMax: true },
  { label: '6.5-7.0', min: 6.5, max: 7.0, exclusiveMax: true },
  { label: '7.0-7.5', min: 7.0, max: 7.5, exclusiveMax: true },
  { label: '7.5-8.0', min: 7.5, max: 8.0, exclusiveMax: true },
  { label: '8.0+', min: 8.0, max: Infinity, exclusiveMax: false },
] as const;

const CONCRETENESS_LEVELS = ['absent', 'low', 'moderate', 'high', 'valid_non_applicable'] as const;
const DISCLOSURE_LEVELS = ['overdisclosure', 'calibrated', 'underdisclosure'] as const;

type AttemptRow = AnalyticsAttempt;

type StoredAttemptRow = {
  id: string;
  user_id: string;
  completed_at: string;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  modified_weighted_score_with_psychometrics: number | null;
  passed: boolean | null;
  final_gate_pass: boolean | null;
  pillar_scores: Record<string, number> | null;
  probe_log: unknown;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  depth_signal_modifier: number | null;
  score_modifier: number | null;
  gate_fail_reasons: string[] | null;
  scenario_composites: Record<string, number> | null;
  disclosure_calibration: string | null;
  ego_development_level: number | null;
  is_phantom: boolean | null;
};

type ProbeLogEntry = {
  probe_fired?: boolean;
  trigger_reason?: string | null;
};

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
  probe_log,
  weighted_score,
  modified_weighted_score,
  modified_weighted_score_with_psychometrics,
  passed,
  final_gate_pass,
  pillar_scores,
  moment_4_concreteness,
  moment_5_concreteness,
  depth_signal_modifier,
  score_modifier,
  gate_fail_reasons,
  scenario_composites,
  disclosure_calibration
`;

const STORED_ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  weighted_score,
  modified_weighted_score,
  modified_weighted_score_with_psychometrics,
  passed,
  final_gate_pass,
  pillar_scores,
  probe_log,
  moment_4_concreteness,
  moment_5_concreteness,
  depth_signal_modifier,
  score_modifier,
  gate_fail_reasons,
  scenario_composites,
  disclosure_calibration,
  ego_development_level,
  is_phantom
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
      const cur = process.env[k];
      if (cur == null || cur === '') process.env[k] = v;
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
    console.error(
      'Missing Supabase env. Set in .env:\n' +
        '  - SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL\n' +
        '  - SUPABASE_SERVICE_ROLE_KEY',
    );
    process.exit(1);
  }
  return createClient(supabaseUrl, serviceKey);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function pct(count: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((count / total) * 100).toFixed(1)}%`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function depthModifier(row: AttemptRow): number | null {
  return finiteNumber(row.depth_signal_modifier) ?? finiteNumber(row.score_modifier);
}

function scenarioComposite(row: AttemptRow, key: '1' | '2' | '3'): number | null {
  const composites = row.scenario_composites;
  if (!composites || typeof composites !== 'object') return null;
  const v = composites[key] ?? composites[`scenario_${key}`];
  return finiteNumber(v);
}

function scoreBucketLabel(score: number | null): string | null {
  if (score == null) return null;
  for (const bucket of SCORE_BUCKETS) {
    if (bucket.exclusiveMax) {
      if (score >= bucket.min && score < bucket.max) return bucket.label;
    } else if (score >= bucket.min) {
      return bucket.label;
    }
  }
  return null;
}

function padRight(text: string, width: number): string {
  return text.length >= width ? text : text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  return text.length >= width ? text : ' '.repeat(width - text.length) + text;
}

async function fetchCompletedAttempts(
  supabase: SupabaseClient,
  storedOnly: boolean,
): Promise<RawAttemptForAnalytics[] | StoredAttemptRow[]> {
  const pageSize = 1000;
  const all: RawAttemptForAnalytics[] | StoredAttemptRow[] = [];
  let from = 0;
  const select = storedOnly ? STORED_ATTEMPT_SELECT : ATTEMPT_SELECT;

  while (true) {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(select)
      .not('completed_at', 'is', null)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('completed_at', { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) throw error;
    const batch = (data ?? []) as RawAttemptForAnalytics[] | StoredAttemptRow[];
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
  const chunkSize = 100;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase.from('users').select(USER_PSYCH_SELECT).in('id', chunk);
    if (error) throw error;
    for (const row of data ?? []) {
      map.set(String((row as { id: string }).id), row as Record<string, unknown>);
    }
  }

  return map;
}

function recomputeAllAttempts(
  rawAttempts: RawAttemptForAnalytics[],
  usersById: Map<string, Record<string, unknown>>,
): AnalyticsAttempt[] {
  return rawAttempts.map((row) =>
    recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null),
  );
}

function parseProbeLog(raw: unknown): ProbeLogEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((entry): entry is ProbeLogEntry => entry != null && typeof entry === 'object');
}

function buildReport(attempts: AttemptRow[]) {
  const total = attempts.length;

  const passCount = attempts.filter((a) => a.final_gate_pass === true).length;
  const scoreBucketCounts = Object.fromEntries(SCORE_BUCKETS.map((b) => [b.label, 0]));
  let scoredCount = 0;
  for (const a of attempts) {
    const bucket = scoreBucketLabel(finiteNumber(a.weighted_score));
    if (!bucket) continue;
    scoredCount++;
    scoreBucketCounts[bucket] = (scoreBucketCounts[bucket] ?? 0) + 1;
  }
  const dangerZoneCount = scoreBucketCounts['6.0-6.5'] ?? 0;

  const pillarStats: Record<
    string,
    { mean: number; stdDev: number; min: number; max: number; count: number }
  > = {};
  for (const pillar of PILLAR_NAMES) {
    const values = attempts
      .map((a) => finiteNumber(a.pillar_scores?.[pillar]))
      .filter((v): v is number => v != null);
    if (values.length === 0) continue;
    pillarStats[pillar] = {
      mean: round2(mean(values)),
      stdDev: round2(stdDev(values)),
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  const probeFireCounts = new Map<string, number>();
  const probeAttemptSets = new Map<string, Set<string>>();
  for (const a of attempts) {
    for (const entry of parseProbeLog(a.probe_log)) {
      if (entry.probe_fired !== true) continue;
      const reason = entry.trigger_reason?.trim() || '(no trigger_reason)';
      probeFireCounts.set(reason, (probeFireCounts.get(reason) ?? 0) + 1);
      if (!probeAttemptSets.has(reason)) probeAttemptSets.set(reason, new Set());
      probeAttemptSets.get(reason)!.add(a.id);
    }
  }
  const probeRates = [...probeFireCounts.entries()]
    .map(([reason, fired]) => ({
      reason,
      fired,
      attemptsWithProbe: probeAttemptSets.get(reason)?.size ?? 0,
      attemptPct: total > 0 ? ((probeAttemptSets.get(reason)?.size ?? 0) / total) * 100 : 0,
    }))
    .sort((a, b) => b.fired - a.fired);

  const m4Counts = Object.fromEntries(CONCRETENESS_LEVELS.map((l) => [l, 0])) as Record<
    string,
    number
  >;
  const m5Counts = Object.fromEntries(CONCRETENESS_LEVELS.map((l) => [l, 0])) as Record<
    string,
    number
  >;
  let m4Total = 0;
  let m5Total = 0;
  for (const a of attempts) {
    if (a.moment_4_concreteness) {
      m4Total++;
      const key = a.moment_4_concreteness.toLowerCase();
      if (key in m4Counts) m4Counts[key]++;
    }
    if (a.moment_5_concreteness) {
      m5Total++;
      const key = a.moment_5_concreteness.toLowerCase();
      if (key in m5Counts) m5Counts[key]++;
    }
  }
  const m4LowAbsent =
    m4Total > 0 ? ((m4Counts.absent + m4Counts.low) / m4Total) * 100 : null;
  const m5LowAbsent =
    m5Total > 0 ? ((m5Counts.absent + m5Counts.low) / m5Total) * 100 : null;

  const depthValues = attempts.map(depthModifier).filter((v): v is number => v != null);
  const depthPositive = depthValues.filter((v) => v > 0).length;
  const depthZero = depthValues.filter((v) => v === 0).length;
  const depthNegative = depthValues.filter((v) => v < 0).length;
  const depthTotal = depthValues.length;

  const psychPairs = attempts.filter(
    (a) =>
      finiteNumber(a.modified_weighted_score) != null &&
      finiteNumber(a.modified_weighted_score_with_psychometrics) != null,
  );
  const psychDeltas = psychPairs.map(
    (a) =>
      finiteNumber(a.modified_weighted_score_with_psychometrics)! -
      finiteNumber(a.modified_weighted_score)!,
  );
  const psychCategories = {
    largePositive: 0,
    smallPositive: 0,
    neutral: 0,
    smallNegative: 0,
    largeNegative: 0,
  };
  for (const delta of psychDeltas) {
    if (delta > 0.3) psychCategories.largePositive++;
    else if (delta > 0) psychCategories.smallPositive++;
    else if (delta === 0) psychCategories.neutral++;
    else if (delta >= -0.3) psychCategories.smallNegative++;
    else psychCategories.largeNegative++;
  }
  const gateChanged = attempts.filter(
    (a) => a.passed != null && a.final_gate_pass != null && a.passed !== a.final_gate_pass,
  );
  const interviewPassPsychFail = gateChanged.filter(
    (a) => a.passed === true && a.final_gate_pass === false,
  ).length;
  const interviewFailPsychPass = gateChanged.filter(
    (a) => a.passed === false && a.final_gate_pass === true,
  ).length;

  const gateFailCounts = new Map<string, number>();
  for (const a of attempts) {
    const reasons = Array.isArray(a.gate_fail_reasons) ? a.gate_fail_reasons : [];
    for (const reason of reasons) {
      if (typeof reason !== 'string' || !reason.trim()) continue;
      gateFailCounts.set(reason, (gateFailCounts.get(reason) ?? 0) + 1);
    }
  }
  const gateFailRates = [...gateFailCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);

  const ranked = [...attempts]
    .filter((a) => finiteNumber(a.weighted_score) != null)
    .sort(
      (a, b) => finiteNumber(b.weighted_score)! - finiteNumber(a.weighted_score)!,
    );
  const top10 = ranked.slice(0, 10);
  const bottom10 = [...ranked].reverse().slice(0, 10);

  const scenarioStats: Record<
    '1' | '2' | '3',
    { mean: number | null; stdDev: number | null; count: number; label: string }
  > = {
    '1': { mean: null, stdDev: null, count: 0, label: 'Scenario 1 (Emma/Ryan)' },
    '2': { mean: null, stdDev: null, count: 0, label: 'Scenario 2 (Sarah/James)' },
    '3': { mean: null, stdDev: null, count: 0, label: 'Scenario 3 (Sophie/Daniel)' },
  };
  for (const key of ['1', '2', '3'] as const) {
    const values = attempts
      .map((a) => scenarioComposite(a, key))
      .filter((v): v is number => v != null);
    scenarioStats[key] = {
      ...scenarioStats[key],
      count: values.length,
      mean: values.length > 0 ? round2(mean(values)) : null,
      stdDev: values.length > 0 ? round2(stdDev(values)) : null,
    };
  }
  const s1s2Deltas: number[] = [];
  const s2s3Deltas: number[] = [];
  for (const a of attempts) {
    const s1 = scenarioComposite(a, '1');
    const s2 = scenarioComposite(a, '2');
    const s3 = scenarioComposite(a, '3');
    if (s1 != null && s2 != null) s1s2Deltas.push(s2 - s1);
    if (s2 != null && s3 != null) s2s3Deltas.push(s3 - s2);
  }

  const disclosureCounts = Object.fromEntries(DISCLOSURE_LEVELS.map((l) => [l, 0])) as Record<
    string,
    number
  >;
  let disclosureTotal = 0;
  for (const a of attempts) {
    if (!a.disclosure_calibration) continue;
    disclosureTotal++;
    const key = a.disclosure_calibration.toLowerCase();
    if (key in disclosureCounts) disclosureCounts[key]++;
  }

  return {
    total,
    passCount,
    scoreBucketCounts,
    scoredCount,
    dangerZoneCount,
    pillarStats,
    probeRates,
    m4Counts,
    m5Counts,
    m4Total,
    m5Total,
    m4LowAbsent,
    m5LowAbsent,
    depthPositive,
    depthZero,
    depthNegative,
    depthTotal,
    depthAvg: depthTotal > 0 ? round2(mean(depthValues)) : null,
    psychPairsCount: psychPairs.length,
    psychCategories,
    psychDeltas,
    gateChangedCount: gateChanged.length,
    interviewPassPsychFail,
    interviewFailPsychPass,
    gateFailRates,
    top10,
    bottom10,
    scenarioStats,
    s1s2AvgDelta: s1s2Deltas.length > 0 ? round2(mean(s1s2Deltas)) : null,
    s2s3AvgDelta: s2s3Deltas.length > 0 ? round2(mean(s2s3Deltas)) : null,
    disclosureCounts,
    disclosureTotal,
  };
}

function printReport(report: ReturnType<typeof buildReport>): void {
  const { total } = report;

  console.log('SCORE DISTRIBUTION');
  console.log('==================');
  console.log(`Fully scorable interview attempts: ${total}`);
  console.log(`Pass rate: ${pct(report.passCount, total)} (${report.passCount} passed / ${total} total)`);
  console.log('');
  console.log('Weighted score distribution:');
  if (report.scoredCount === 0) {
    console.log('  No data available');
  } else {
    for (const bucket of SCORE_BUCKETS) {
      const count = report.scoreBucketCounts[bucket.label] ?? 0;
      console.log(
        `  ${padRight(bucket.label + ':', 10)} ${padLeft(String(count), 4)} users (${pct(count, report.scoredCount)})`,
      );
    }
  }
  console.log('');
  console.log(
    `Danger zone (6.0-6.5): ${report.dangerZoneCount} users — these are borderline cases worth reviewing`,
  );
  console.log('');

  console.log('PILLAR SCORE AVERAGES');
  console.log('=====================');
  if (Object.keys(report.pillarStats).length === 0) {
    console.log('No data available');
  } else {
    console.log(`${padRight('Pillar', 24)}${padLeft('Mean', 8)}${padLeft('StdDev', 8)}${padLeft('Min', 6)}${padLeft('Max', 6)}`);
    for (const pillar of PILLAR_NAMES) {
      const stats = report.pillarStats[pillar];
      if (!stats) continue;
      console.log(
        `${padRight(pillar, 24)}${padLeft(stats.mean.toFixed(2), 8)}${padLeft(stats.stdDev.toFixed(2), 8)}${padLeft(String(stats.min), 6)}${padLeft(String(stats.max), 6)}`,
      );
    }
    const lowVariance = PILLAR_NAMES.filter((p) => (report.pillarStats[p]?.stdDev ?? 99) < 1.0);
    const lowMean = PILLAR_NAMES.filter((p) => (report.pillarStats[p]?.mean ?? 99) < 6.0);
    console.log('');
    console.log(
      `Low variance pillars (StdDev < 1.0): ${lowVariance.length ? lowVariance.join(', ') : '(none)'} — may not be discriminating well`,
    );
    console.log(
      `Low mean pillars (Mean < 6.0): ${lowMean.length ? lowMean.join(', ') : '(none)'} — may indicate question design issues`,
    );
  }
  console.log('');

  console.log('PROBE FIRING RATES');
  console.log('==================');
  if (report.probeRates.length === 0) {
    console.log('No data available');
  } else {
    console.log(`${padRight('Probe', 40)}${padLeft('Fired', 8)}${padLeft('% attempts', 14)}`);
    for (const row of report.probeRates) {
      console.log(
        `${padRight(row.reason.slice(0, 40), 40)}${padLeft(String(row.fired), 8)}${padLeft(`${row.attemptPct.toFixed(1)}%`, 14)}`,
      );
    }
    const highFiring = report.probeRates.filter((r) => r.attemptPct > 50).map((r) => r.reason);
    console.log('');
    console.log(
      `High firing rate probes (> 50%): ${highFiring.length ? highFiring.join(', ') : '(none)'} — question design may need review`,
    );
  }
  console.log('');

  console.log('PERSONAL MOMENT CONCRETENESS');
  console.log('=============================');
  console.log('M4 concreteness:');
  if (report.m4Total === 0) {
    console.log('  No data available');
  } else {
    for (const level of CONCRETENESS_LEVELS) {
      const count = report.m4Counts[level] ?? 0;
      console.log(`  ${padRight(level + ':', 10)} ${count} (${pct(count, report.m4Total)})`);
    }
  }
  console.log('');
  console.log('M5 concreteness:');
  if (report.m5Total === 0) {
    console.log('  No data available');
  } else {
    for (const level of CONCRETENESS_LEVELS) {
      const count = report.m5Counts[level] ?? 0;
      console.log(`  ${padRight(level + ':', 10)} ${count} (${pct(count, report.m5Total)})`);
    }
  }
  console.log('');
  console.log(
    `M4 low/absent rate: ${report.m4LowAbsent != null ? `${report.m4LowAbsent.toFixed(1)}%` : 'No data available'} — if > 40% the M4 question may need review`,
  );
  console.log(
    `M5 low/absent rate: ${report.m5LowAbsent != null ? `${report.m5LowAbsent.toFixed(1)}%` : 'No data available'} — if > 40% the M5 question may need review`,
  );
  console.log('');

  console.log('DEPTH SIGNAL MODIFIER DISTRIBUTION');
  console.log('====================================');
  console.log('(Scorable interviews only — incomplete attempts are excluded; they always contribute modifier 0 when included.)');
  if (report.depthTotal === 0) {
    console.log('No data available');
  } else {
    console.log(`Positive modifier (> 0):  ${report.depthPositive} (${pct(report.depthPositive, report.depthTotal)})`);
    console.log(`Zero modifier (= 0):      ${report.depthZero} (${pct(report.depthZero, report.depthTotal)})`);
    console.log(`Negative modifier (< 0):  ${report.depthNegative} (${pct(report.depthNegative, report.depthTotal)})`);
    console.log(`Average modifier value:   ${report.depthAvg?.toFixed(2) ?? '—'}`);
    console.log('');
    const negPct = (report.depthNegative / report.depthTotal) * 100;
    const posPct = (report.depthPositive / report.depthTotal) * 100;
    if (negPct > 60) console.log('If > 60% negative: depth signal thresholds may be too strict');
    if (posPct > 60) console.log('If > 60% positive: depth signal thresholds may be too generous');
  }
  console.log('');

  console.log('PSYCHOMETRIC MODIFIER IMPACT');
  console.log('==============================');
  if (report.psychPairsCount === 0) {
    console.log('No data available');
  } else {
    const p = report.psychPairsCount;
    const c = report.psychCategories;
    console.log(`Large positive impact (> +0.3):  ${c.largePositive} (${pct(c.largePositive, p)})`);
    console.log(`Small positive impact (0 to +0.3): ${c.smallPositive} (${pct(c.smallPositive, p)})`);
    console.log(`Neutral (0):                     ${c.neutral} (${pct(c.neutral, p)})`);
    console.log(`Small negative (-0.3 to 0):      ${c.smallNegative} (${pct(c.smallNegative, p)})`);
    console.log(`Large negative (< -0.3):         ${c.largeNegative} (${pct(c.largeNegative, p)})`);
    console.log(
      `Average psychometric delta:      ${report.psychDeltas.length > 0 ? round2(mean(report.psychDeltas)).toFixed(2) : '—'}`,
    );
    console.log('');
    console.log(`Users where psychometrics changed gate result: ${report.gateChangedCount}`);
    console.log(`  Interview passed but psychometrics failed: ${report.interviewPassPsychFail}`);
    console.log(`  Interview failed but psychometrics passed: ${report.interviewFailPsychPass}`);
  }
  console.log('');

  console.log('GATE FAIL REASONS');
  console.log('=================');
  if (report.gateFailRates.length === 0) {
    console.log('No data available');
  } else {
    console.log(`${padRight('Reason', 32)}${padLeft('Count', 8)}${padLeft('% attempts', 14)}`);
    for (const row of report.gateFailRates) {
      console.log(
        `${padRight(row.reason.slice(0, 32), 32)}${padLeft(String(row.count), 8)}${padLeft(pct(row.count, total), 14)}`,
      );
    }
    const top = report.gateFailRates[0];
    console.log('');
    console.log(`Most common fail reason: ${top.reason} — ${top.count} occurrences`);
  }
  console.log('');

  console.log('TOP 10 PERFORMERS');
  console.log('=================');
  if (report.top10.length === 0) {
    console.log('No data available');
  } else {
    console.log(`${padRight('User', 12)}${padLeft('Weighted', 10)}${padLeft('Modified', 10)}${padLeft('Pass', 8)}${padLeft('Ego', 6)}`);
    for (const a of report.top10) {
      console.log(formatPerformerRow(a));
    }
  }
  console.log('');
  console.log('BOTTOM 10 PERFORMERS');
  console.log('====================');
  if (report.bottom10.length === 0) {
    console.log('No data available');
  } else {
    console.log(`${padRight('User', 12)}${padLeft('Weighted', 10)}${padLeft('Modified', 10)}${padLeft('Pass', 8)}${padLeft('Ego', 6)}`);
    for (const a of report.bottom10) {
      console.log(formatPerformerRow(a));
    }
  }
  console.log('');

  console.log('SCENARIO COMPOSITE AVERAGES');
  console.log('============================');
  for (const key of ['1', '2', '3'] as const) {
    const s = report.scenarioStats[key];
    if (s.count === 0 || s.mean == null) {
      console.log(`${s.label}:     No data available`);
    } else {
      console.log(
        `${s.label}:     ${s.mean.toFixed(2)} avg (StdDev ${s.stdDev?.toFixed(2) ?? '—'})`,
      );
    }
  }
  console.log('');
  console.log('Scenario score improvement pattern:');
  console.log(
    `  S1 → S2 average delta: ${report.s1s2AvgDelta != null ? (report.s1s2AvgDelta >= 0 ? '+' : '') + report.s1s2AvgDelta.toFixed(2) : 'No data available'} (warmup effect)`,
  );
  console.log(
    `  S2 → S3 average delta: ${report.s2s3AvgDelta != null ? (report.s2s3AvgDelta >= 0 ? '+' : '') + report.s2s3AvgDelta.toFixed(2) : 'No data available'}`,
  );
  console.log('');

  console.log('DISCLOSURE CALIBRATION');
  console.log('=======================');
  if (report.disclosureTotal === 0) {
    console.log('No data available');
  } else {
    for (const level of DISCLOSURE_LEVELS) {
      const count = report.disclosureCounts[level] ?? 0;
      const label = level.charAt(0).toUpperCase() + level.slice(1);
      console.log(`${padRight(label + ':', 16)} ${count} (${pct(count, report.disclosureTotal)})`);
    }
  }
}

function formatPerformerRow(a: AttemptRow): string {
  const user = (a.user_id.split('-')[0] ?? a.user_id).slice(0, 8);
  const weighted = finiteNumber(a.weighted_score)?.toFixed(2) ?? '—';
  const modified = finiteNumber(a.modified_weighted_score)?.toFixed(2) ?? '—';
  const pass =
    a.final_gate_pass === true ? 'PASS' : a.final_gate_pass === false ? 'FAIL' : '—';
  const ego = a.ego_development_level != null ? String(a.ego_development_level) : '—';
  return `${padRight(user, 12)}${padLeft(weighted, 10)}${padLeft(modified, 10)}${padLeft(pass, 8)}${padLeft(ego, 6)}`;
}

async function main(): Promise<void> {
  const started = Date.now();
  mergeEnvFromDotenvFile();
  const writeJson = process.argv.includes('--json');
  const storedOnly = process.argv.includes('--stored');

  const supabase = createAdminClient();
  console.log('Loading completed interview attempts…');
  const raw = await fetchCompletedAttempts(supabase, storedOnly);

  let attempts: AttemptRow[];
  let recomputeMeta: {
    mode: 'recomputed' | 'stored';
    algorithm: string | null;
    successCount: number;
    incompleteCount: number;
  };

  if (storedOnly) {
    attempts = raw as StoredAttemptRow[] as AttemptRow[];
    recomputeMeta = {
      mode: 'stored',
      algorithm: null,
      successCount: 0,
      incompleteCount: 0,
    };
    console.log(`Using ${attempts.length} persisted DB scores (--stored).`);
  } else {
    const rawAttempts = raw as RawAttemptForAnalytics[];
    console.log(`Recomputing scores for ${rawAttempts.length} attempts (current algorithm)…`);
    const usersById = await fetchUsersByIds(
      supabase,
      rawAttempts.map((a) => a.user_id),
    );
    attempts = recomputeAllAttempts(rawAttempts, usersById);
    const successCount = attempts.filter((a) => a.recomputeStatus === 'success').length;
    const incompleteCount = attempts.length - successCount;
    recomputeMeta = {
      mode: 'recomputed',
      algorithm: ANALYTICS_RECOMPUTE_ALGORITHM,
      successCount,
      incompleteCount,
    };
    console.log(
      `Recomputed ${successCount} scorable / ${incompleteCount} excluded incomplete (rollup ${ANALYTICS_RECOMPUTE_ALGORITHM}).`,
    );
    attempts = attempts.filter((a) => a.recomputeStatus === 'success');
    if (incompleteCount > 0) {
      console.log(
        `Auditing ${attempts.length} fully scorable interviews only (${incompleteCount} rows with completed_at but missing scenario/M4 slices excluded).`,
      );
    }
  }

  const report = buildReport(attempts);
  printReport(report);

  const finished = new Date().toISOString();
  const runtimeSec = ((Date.now() - started) / 1000).toFixed(1);
  console.log('');
  console.log(`Report generated at ${finished}`);
  console.log(`Total runtime: ${runtimeSec}s`);

  if (writeJson) {
    const outDir = join(process.cwd(), 'scripts', 'output');
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'attempt-analytics.json');
    writeFileSync(
      outPath,
      JSON.stringify({ generatedAt: finished, runtimeSec, recomputeMeta, report }, null, 2),
    );
    console.log(`JSON written to ${outPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
