/**
 * Export transcripts + AI reasoning for all scorable interview-pass flips
 * (persisted DB vs current recompute from export-rescore-all-users).
 *
 * Usage:
 *   npm run export-rescore-flip-review
 *   npx tsx --env-file=.env scripts/exportRescoreFlipReview.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import {
  extractScoringEvidence,
  formatDate,
  formatScore,
  hasNarrativeContent,
  parseAiReasoning,
  parseJsonObject,
  parseTranscript,
  renderAiReasoningSection,
  renderTranscript,
  type FlipReviewContent,
} from './flipReviewExportCore';
import {
  ANALYTICS_RECOMPUTE_ALGORITHM,
  recomputeAttemptForAnalytics,
  type AnalyticsAttempt,
  type RawAttemptForAnalytics,
} from './recomputeAttemptForAnalytics';
import { fetchUsersByIds } from './thresholdFlipAuditCore';

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
  ai_reasoning,
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
  ai_reasoning: unknown;
  reasoning_pending: boolean | null;
};

type RescoreFlipRow = {
  userId: string;
  attemptId: string;
  completedAt: string;
  flipDirection: 'pass_to_fail' | 'fail_to_pass';
  persistedInterviewPass: boolean | null;
  recomputedInterviewPass: boolean | null;
  persistedFinalPass: boolean | null;
  recomputedFinalPass: boolean | null;
  persistedGateFailReasons: string[];
  recomputedGateFailReasons: string[];
  recomputeNotes: string[];
  persisted: {
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    modifiedWithPsychometrics: number | null;
    disclosureCalibration: string | null;
    pillarScores: Record<string, number> | null;
  };
  recomputed: {
    weightedScore: number | null;
    modifiedWeightedScore: number | null;
    modifiedWithPsychometrics: number | null;
    disclosureCalibration: string | null;
    pillarScores: Record<string, number> | null;
    scenarioComposites: Record<string, number> | null;
    depthSignalModifier: number | null;
  };
  review: FlipReviewContent;
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

function boolFlipped(
  persisted: boolean | null | undefined,
  recomputed: boolean | null | undefined,
): boolean {
  if (persisted == null || recomputed == null) return false;
  return persisted !== recomputed;
}

function flipDirection(
  persisted: boolean | null,
  recomputed: boolean | null,
): 'pass_to_fail' | 'fail_to_pass' | null {
  if (persisted === true && recomputed === false) return 'pass_to_fail';
  if (persisted === false && recomputed === true) return 'fail_to_pass';
  return null;
}

function formatScenarioComposites(composites: Record<string, number> | null): string {
  if (!composites) return '—';
  const parts = Object.entries(composites)
    .filter(([, v]) => v != null && Number.isFinite(v))
    .map(([k, v]) => `${k.replace('scenario_', 'S')}=${v.toFixed(2)}`);
  return parts.length ? parts.join(', ') : '—';
}

function renderFlipUserBlock(row: RescoreFlipRow): string[] {
  const dirLabel = row.flipDirection === 'pass_to_fail' ? 'PASS → FAIL' : 'FAIL → PASS';
  const pillars = row.recomputed.pillarScores ?? row.persisted.pillarScores ?? {};
  const pillarLine = [
    `mentalizing=${pillars.mentalizing ?? '—'}`,
    `accountability=${pillars.accountability ?? '—'}`,
    `repair=${pillars.repair ?? '—'}`,
    `regulation=${pillars.regulation ?? '—'}`,
    `contempt=${pillars.contempt ?? '—'}`,
  ].join(', ');

  return [
    `# ${dirLabel} (persisted DB → current recompute)`,
    '',
    `**User:** ${row.userId} | **Attempt:** ${row.attemptId} | **Completed:** ${formatDate(row.completedAt)}`,
    `**Interview gate:** persisted **${row.persistedInterviewPass === true ? 'PASS' : row.persistedInterviewPass === false ? 'FAIL' : '—'}** → recomputed **${row.recomputedInterviewPass === true ? 'PASS' : 'FAIL'}** (threshold ${GATE_PASS_WEIGHTED_MIN})`,
    `**Final gate:** persisted **${row.persistedFinalPass === true ? 'PASS' : row.persistedFinalPass === false ? 'FAIL' : '—'}** → recomputed **${row.recomputedFinalPass === true ? 'PASS' : row.recomputedFinalPass === false ? 'FAIL' : '—'}**`,
    `**Persisted fail codes:** ${row.persistedGateFailReasons.length ? row.persistedGateFailReasons.join(', ') : 'none'}`,
    `**Recomputed fail codes:** ${row.recomputedGateFailReasons.length ? row.recomputedGateFailReasons.join(', ') : 'none'}`,
    `**Recompute notes:** ${row.recomputeNotes.length ? row.recomputeNotes.join('; ') : '—'}`,
    '',
    '### Scores',
    '',
    `| | Persisted | Recomputed |`,
    `|---|---:|---:|`,
    `| weighted_score | ${formatScore(row.persisted.weightedScore)} | ${formatScore(row.recomputed.weightedScore)} |`,
    `| modified_weighted_score | ${formatScore(row.persisted.modifiedWeightedScore)} | ${formatScore(row.recomputed.modifiedWeightedScore)} |`,
    `| psych-modified | ${formatScore(row.persisted.modifiedWithPsychometrics)} | ${formatScore(row.recomputed.modifiedWithPsychometrics)} |`,
    `| disclosure | ${row.persisted.disclosureCalibration ?? '—'} | ${row.recomputed.disclosureCalibration ?? '—'} |`,
    `| depth modifier | — | ${formatScore(row.recomputed.depthSignalModifier)} |`,
    `| scenario composites | — | ${formatScenarioComposites(row.recomputed.scenarioComposites)} |`,
    '',
    `**Pillar scores (recomputed):** ${pillarLine}`,
    '',
    '## Full transcript',
    '',
    ...renderTranscript(row.review.transcript),
    ...renderAiReasoningSection(row.review),
    '---',
    '',
  ];
}

function sortFlips(a: RescoreFlipRow, b: RescoreFlipRow): number {
  if (a.flipDirection !== b.flipDirection) {
    return a.flipDirection === 'pass_to_fail' ? -1 : 1;
  }
  const modA = a.recomputed.modifiedWeightedScore ?? a.recomputed.weightedScore ?? 0;
  const modB = b.recomputed.modifiedWeightedScore ?? b.recomputed.weightedScore ?? 0;
  if (a.flipDirection === 'pass_to_fail') {
    return Math.abs(modB - GATE_PASS_WEIGHTED_MIN) - Math.abs(modA - GATE_PASS_WEIGHTED_MIN);
  }
  return modB - modA;
}

function renderReport(rows: RescoreFlipRow[], summary: Record<string, unknown>): string {
  const passToFail = rows.filter((r) => r.flipDirection === 'pass_to_fail').length;
  const failToPass = rows.filter((r) => r.flipDirection === 'fail_to_pass').length;

  const lines = [
    '# RESCORE INTERVIEW-PASS FLIP REVIEW',
    '',
    `Generated from persisted DB vs current recompute (${ANALYTICS_RECOMPUTE_ALGORITHM}, threshold ${GATE_PASS_WEIGHTED_MIN}).`,
    '',
    `**Total scorable interview flips:** ${rows.length}`,
    `- pass → fail: ${passToFail}`,
    `- fail → pass: ${failToPass}`,
    '',
    `**Narrative coverage:** ${summary.withFullNarrative} full narrative, ${summary.withScoringEvidenceOnly} scoring-evidence only, ${summary.withNeither} neither`,
    '',
    '---',
    '',
  ];

  for (const row of rows) lines.push(...renderFlipUserBlock(row));
  return lines.join('\n');
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

function buildFlipRow(row: PersistedAttemptRow, recomputed: AnalyticsAttempt): RescoreFlipRow | null {
  if (recomputed.recomputeStatus !== 'success') return null;
  if (!boolFlipped(row.passed, recomputed.passed)) return null;

  const direction = flipDirection(row.passed ?? null, recomputed.passed ?? null);
  if (!direction) return null;

  const review: FlipReviewContent = {
    transcript: parseTranscript(row.transcript),
    aiReasoning: parseAiReasoning(row.ai_reasoning),
    aiReasoningRaw: parseJsonObject(row.ai_reasoning),
    reasoningPending: row.reasoning_pending === true,
    scoringEvidence: extractScoringEvidence(row),
  };

  return {
    userId: row.user_id,
    attemptId: row.id,
    completedAt: row.completed_at,
    flipDirection: direction,
    persistedInterviewPass: row.passed ?? null,
    recomputedInterviewPass: recomputed.passed ?? null,
    persistedFinalPass: row.final_gate_pass ?? null,
    recomputedFinalPass: recomputed.final_gate_pass ?? null,
    persistedGateFailReasons: gateReasonsArray(row.gate_fail_reasons),
    recomputedGateFailReasons: gateReasonsArray(recomputed.gate_fail_reasons),
    recomputeNotes: recomputed.recomputeNotes,
    persisted: {
      weightedScore: row.weighted_score,
      modifiedWeightedScore: row.modified_weighted_score,
      modifiedWithPsychometrics: row.modified_weighted_score_with_psychometrics,
      disclosureCalibration: row.disclosure_calibration ?? null,
      pillarScores: row.pillar_scores,
    },
    recomputed: {
      weightedScore: recomputed.weighted_score,
      modifiedWeightedScore: recomputed.modified_weighted_score,
      modifiedWithPsychometrics: recomputed.modified_weighted_score_with_psychometrics,
      disclosureCalibration: recomputed.disclosure_calibration ?? null,
      pillarScores: recomputed.pillar_scores,
      scenarioComposites: recomputed.scenario_composites,
      depthSignalModifier:
        recomputed.depth_signal_modifier ?? recomputed.score_modifier ?? null,
    },
    review,
  };
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
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
  const flipRows = raw
    .map((row) =>
      buildFlipRow(row, recomputeAttemptForAnalytics(row, usersById.get(row.user_id) ?? null)),
    )
    .filter((r): r is RescoreFlipRow => r != null)
    .sort(sortFlips);
  console.log = prevLog;

  const summary = {
    scorableFlipCount: flipRows.length,
    passToFailCount: flipRows.filter((r) => r.flipDirection === 'pass_to_fail').length,
    failToPassCount: flipRows.filter((r) => r.flipDirection === 'fail_to_pass').length,
    withFullNarrative: flipRows.filter((r) => hasNarrativeContent(r.review.aiReasoning)).length,
    withScoringEvidenceOnly: flipRows.filter(
      (r) => !hasNarrativeContent(r.review.aiReasoning) && r.review.scoringEvidence.length > 0,
    ).length,
    withNeither: flipRows.filter(
      (r) => !hasNarrativeContent(r.review.aiReasoning) && r.review.scoringEvidence.length === 0,
    ).length,
    attempts: flipRows.map((r) => ({
      userId: r.userId,
      attemptId: r.attemptId,
      flipDirection: r.flipDirection,
      persistedInterviewPass: r.persistedInterviewPass,
      recomputedInterviewPass: r.recomputedInterviewPass,
      recomputedModifiedScore: r.recomputed.modifiedWeightedScore,
      recomputedFailReasons: r.recomputedGateFailReasons,
      hasFullNarrative: hasNarrativeContent(r.review.aiReasoning),
    })),
  };

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'rescore-flip-review.md');
  const jsonPath = join(outDir, 'rescore-flip-review-summary.json');

  writeFileSync(mdPath, renderReport(flipRows, summary), 'utf8');
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`Wrote ${flipRows.length} flip reviews to ${mdPath}`);
  console.log(`Summary: ${jsonPath}`);
  console.log(
    `Narrative coverage: ${summary.withFullNarrative} full, ${summary.withScoringEvidenceOnly} scoring-evidence only, ${summary.withNeither} neither`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
