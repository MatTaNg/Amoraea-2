/**
 * Rescore all completed interview attempts with the current algorithm (aggregate + gate +
 * psychometric overlay) and write per-attempt results to scripts/output/.
 *
 * Does not re-run LLM scoring — uses stored scenario/moment slices like rescoreUsers --mode aggregate.
 *
 * Usage:
 *   npm run export-rescore-all-users
 *   npx tsx --env-file=.env scripts/exportRescoreAllUsers.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import {
  ANALYTICS_RECOMPUTE_ALGORITHM,
  recomputeAttemptForAnalytics,
  type AnalyticsAttempt,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';
import { fetchUsersByIds, USER_PSYCH_SELECT } from './thresholdFlipAuditCore';

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

type PersistedAttemptRow = RawAttemptForAnalytics & {
  weighted_score: number | null;
  modified_weighted_score: number | null;
  modified_weighted_score_with_psychometrics: number | null;
  passed: boolean | null;
  final_gate_pass: boolean | null;
  pillar_scores: Record<string, number> | null;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  depth_signal_modifier: number | null;
  score_modifier: number | null;
  gate_fail_reasons: string[] | null;
  scenario_composites: Record<string, number> | null;
  disclosure_calibration: string | null;
};

type RescoreRow = {
  userId: string;
  attemptId: string;
  completedAt: string;
  recomputeStatus: AnalyticsAttempt['recomputeStatus'];
  recomputeNotes: string[];
  persisted: {
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    modifiedWithPsychometrics: number | null;
    interviewPass: boolean | null;
    finalGatePass: boolean | null;
    gateFailReasons: string[];
    disclosureCalibration: string | null;
    pillarScores: Record<string, number> | null;
  };
  recomputed: {
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    modifiedWithPsychometrics: number | null;
    interviewPass: boolean | null;
    finalGatePass: boolean | null;
    gateFailReasons: string[];
    disclosureCalibration: string | null;
    pillarScores: Record<string, number> | null;
    scenarioComposites: Record<string, number> | null;
    depthSignalModifier: number | null;
    moment4Concreteness: string | null;
    moment5Concreteness: string | null;
    egoDevelopmentLevel: number | null;
  };
  delta: {
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    modifiedWithPsychometrics: number | null;
    interviewPassFlipped: boolean;
    finalGatePassFlipped: boolean;
    disclosureCalibrationChanged: boolean;
  };
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

function gateReasonsArray(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

function roundDelta(a: number | null, b: number | null): number | null {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.round((b - a) * 100) / 100;
}

function boolFlipped(
  persisted: boolean | null | undefined,
  recomputed: boolean | null | undefined,
): boolean {
  if (persisted == null || recomputed == null) return false;
  return persisted !== recomputed;
}

function buildRescoreRow(row: PersistedAttemptRow, recomputed: AnalyticsAttempt): RescoreRow {
  const persistedReasons = gateReasonsArray(row.gate_fail_reasons);
  const recomputedReasons = gateReasonsArray(recomputed.gate_fail_reasons);

  return {
    userId: row.user_id,
    attemptId: row.id,
    completedAt: row.completed_at,
    recomputeStatus: recomputed.recomputeStatus,
    recomputeNotes: recomputed.recomputeNotes,
    persisted: {
      weightedScore: row.weighted_score,
      modifiedWeightedScore: row.modified_weighted_score,
      modifiedWithPsychometrics: row.modified_weighted_score_with_psychometrics,
      interviewPass: row.passed ?? null,
      finalGatePass: row.final_gate_pass ?? null,
      gateFailReasons: persistedReasons,
      disclosureCalibration: row.disclosure_calibration ?? null,
      pillarScores: row.pillar_scores,
    },
    recomputed: {
      weightedScore: recomputed.weighted_score,
      modifiedWeightedScore: recomputed.modified_weighted_score,
      modifiedWithPsychometrics: recomputed.modified_weighted_score_with_psychometrics,
      interviewPass: recomputed.passed ?? null,
      finalGatePass: recomputed.final_gate_pass ?? null,
      gateFailReasons: recomputedReasons,
      disclosureCalibration: recomputed.disclosure_calibration ?? null,
      pillarScores: recomputed.pillar_scores,
      scenarioComposites: recomputed.scenario_composites,
      depthSignalModifier:
        recomputed.depth_signal_modifier ?? recomputed.score_modifier ?? null,
      moment4Concreteness: recomputed.moment_4_concreteness,
      moment5Concreteness: recomputed.moment_5_concreteness,
      egoDevelopmentLevel: recomputed.ego_development_level,
    },
    delta: {
      weightedScore: roundDelta(row.weighted_score, recomputed.weighted_score),
      modifiedWeightedScore: roundDelta(
        row.modified_weighted_score,
        recomputed.modified_weighted_score,
      ),
      modifiedWithPsychometrics: roundDelta(
        row.modified_weighted_score_with_psychometrics,
        recomputed.modified_weighted_score_with_psychometrics,
      ),
      interviewPassFlipped: boolFlipped(row.passed, recomputed.passed),
      finalGatePassFlipped: boolFlipped(row.final_gate_pass, recomputed.final_gate_pass),
      disclosureCalibrationChanged:
        (row.disclosure_calibration ?? null) !== (recomputed.disclosure_calibration ?? null),
    },
  };
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<PersistedAttemptRow[]> {
  const pageSize = 1000;
  const all: PersistedAttemptRow[] = [];
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
    const batch = (data ?? []) as PersistedAttemptRow[];
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function formatScore(v: number | null | undefined): string {
  return v == null || !Number.isFinite(v) ? '' : v.toFixed(2);
}

function renderCsv(rows: RescoreRow[]): string {
  const header = [
    'user_id',
    'attempt_id',
    'completed_at',
    'recompute_status',
    'persisted_weighted',
    'recomputed_weighted',
    'delta_weighted',
    'persisted_modified',
    'recomputed_modified',
    'delta_modified',
    'persisted_psych_modified',
    'recomputed_psych_modified',
    'delta_psych_modified',
    'persisted_interview_pass',
    'recomputed_interview_pass',
    'interview_pass_flipped',
    'persisted_final_pass',
    'recomputed_final_pass',
    'final_pass_flipped',
    'persisted_disclosure',
    'recomputed_disclosure',
    'disclosure_changed',
    'persisted_gate_fail_reasons',
    'recomputed_gate_fail_reasons',
    'recompute_notes',
  ].join(',');

  const lines = [header];
  for (const r of rows) {
    lines.push(
      [
        r.userId,
        r.attemptId,
        r.completedAt,
        r.recomputeStatus,
        formatScore(r.persisted.weightedScore),
        formatScore(r.recomputed.weightedScore),
        formatScore(r.delta.weightedScore),
        formatScore(r.persisted.modifiedWeightedScore),
        formatScore(r.recomputed.modifiedWeightedScore),
        formatScore(r.delta.modifiedWeightedScore),
        formatScore(r.persisted.modifiedWithPsychometrics),
        formatScore(r.recomputed.modifiedWithPsychometrics),
        formatScore(r.delta.modifiedWithPsychometrics),
        String(r.persisted.interviewPass ?? ''),
        String(r.recomputed.interviewPass ?? ''),
        String(r.delta.interviewPassFlipped),
        String(r.persisted.finalGatePass ?? ''),
        String(r.recomputed.finalGatePass ?? ''),
        String(r.delta.finalGatePassFlipped),
        r.persisted.disclosureCalibration ?? '',
        r.recomputed.disclosureCalibration ?? '',
        String(r.delta.disclosureCalibrationChanged),
        r.persisted.gateFailReasons.join('|'),
        r.recomputed.gateFailReasons.join('|'),
        r.recomputeNotes.join('; '),
      ]
        .map((c) => csvEscape(String(c)))
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}

function buildSummary(rows: RescoreRow[]) {
  const scorable = rows.filter((r) => r.recomputeStatus === 'success');
  const incomplete = rows.filter((r) => r.recomputeStatus !== 'success');

  return {
    totalAttempts: rows.length,
    scorableCount: scorable.length,
    incompleteCount: incomplete.length,
    recomputedInterviewPass: scorable.filter((r) => r.recomputed.interviewPass === true).length,
    recomputedFinalPass: scorable.filter((r) => r.recomputed.finalGatePass === true).length,
    persistedInterviewPass: scorable.filter((r) => r.persisted.interviewPass === true).length,
    persistedFinalPass: scorable.filter((r) => r.persisted.finalGatePass === true).length,
    interviewPassFlipped: scorable.filter((r) => r.delta.interviewPassFlipped).length,
    finalPassFlipped: scorable.filter((r) => r.delta.finalGatePassFlipped).length,
    modifiedScoreChanged: scorable.filter(
      (r) => r.delta.modifiedWeightedScore != null && Math.abs(r.delta.modifiedWeightedScore) > 0.01,
    ).length,
    disclosureLabelChanged: scorable.filter((r) => r.delta.disclosureCalibrationChanged).length,
    passThreshold: GATE_PASS_WEIGHTED_MIN,
  };
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const started = Date.now();
  const supabase = createAdminClient();

  console.log('Loading completed interview attempts…');
  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((r) => r.user_id),
  );

  console.log(`Recomputing ${raw.length} attempts (${ANALYTICS_RECOMPUTE_ALGORITHM})…`);
  const prevLog = console.log;
  console.log = () => {};
  const rows = raw.map((row) =>
    buildRescoreRow(row, recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null)),
  );
  console.log = prevLog;

  rows.sort((a, b) => a.completedAt.localeCompare(b.completedAt));

  const summary = buildSummary(rows);
  const finished = new Date().toISOString();
  const runtimeSec = ((Date.now() - started) / 1000).toFixed(1);

  const payload = {
    generatedAt: finished,
    runtimeSec,
    algorithm: ANALYTICS_RECOMPUTE_ALGORITHM,
    passThreshold: GATE_PASS_WEIGHTED_MIN,
    summary,
    attempts: rows,
  };

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const jsonPath = join(outDir, 'rescore-all-users.json');
  const csvPath = join(outDir, 'rescore-all-users.csv');

  writeFileSync(jsonPath, JSON.stringify(payload, null, 2), 'utf8');
  writeFileSync(csvPath, renderCsv(rows), 'utf8');

  console.log(`Wrote ${rows.length} attempts to ${jsonPath}`);
  console.log(`Wrote CSV to ${csvPath}`);
  console.log('');
  console.log('Summary');
  console.log(`  Scorable: ${summary.scorableCount} / ${summary.totalAttempts}`);
  console.log(`  Recomputed interview pass: ${summary.recomputedInterviewPass} (persisted: ${summary.persistedInterviewPass})`);
  console.log(`  Recomputed final pass: ${summary.recomputedFinalPass} (persisted: ${summary.persistedFinalPass})`);
  console.log(`  Interview pass flipped: ${summary.interviewPassFlipped}`);
  console.log(`  Final pass flipped: ${summary.finalPassFlipped}`);
  console.log(`  Modified score changed: ${summary.modifiedScoreChanged}`);
  console.log(`  Runtime: ${runtimeSec}s`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
