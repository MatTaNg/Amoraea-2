/**
 * Export transcripts + AI reasoning for all pass→fail flips (old 6.0 → new 6.5/floors).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/exportThresholdFlipReview.ts
 *   npm run export-threshold-flip-review
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
import type { RawAttemptForAnalytics } from './recomputeAttemptForAnalytics';
import {
  computeThresholdFlipAudits,
  fetchUsersByIds,
  formatFloorList,
  NEW_CONFIG,
  NEW_WEIGHTED_PASS_MIN,
  OLD_CONFIG,
  OLD_WEIGHTED_PASS_MIN,
  type AttemptAudit,
  type FlipReason,
  type ThresholdFlipAttemptRow,
} from './thresholdFlipAuditCore';

const FLIP_REASON_ORDER: FlipReason[] = [
  'score_threshold_only',
  'floor_change_only',
  'both',
  'unrelated',
];

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
  pillar_scores,
  weighted_score,
  modified_weighted_score,
  final_gate_pass,
  passed,
  gate_fail_reasons,
  scenario_composites
`;

type FlipExportRow = {
  audit: AttemptAudit;
  completedAt: string;
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

function renderFlipUserBlock(row: FlipExportRow): string[] {
  const { audit: a } = row;
  const pillars = a.pillarScores;
  const pillarLine = [
    `mentalizing=${pillars.mentalizing ?? '—'}`,
    `accountability=${pillars.accountability ?? '—'}`,
    `repair=${pillars.repair ?? '—'}`,
    `regulation=${pillars.regulation ?? '—'}`,
    `contempt=${pillars.contempt ?? '—'}`,
  ].join(', ');

  const newBreaches = a.newBreaches
    .filter((b) => b.score < b.floor)
    .map((b) => `${b.label} ${b.score.toFixed(2)} < floor ${b.floor.toFixed(1)}`)
    .join('; ');

  return [
    `# PASS → FAIL (${a.flipReason ?? 'unknown'})`,
    '',
    `**User:** ${a.userId} | **Attempt:** ${a.attemptId} | **Completed:** ${formatDate(row.completedAt)}`,
    `**Flip reason:** ${a.flipReason ?? '—'} — ${a.flipDetail}`,
    `**Old interview gate:** PASS (threshold ${OLD_WEIGHTED_PASS_MIN}) → **New interview gate:** FAIL (threshold ${NEW_WEIGHTED_PASS_MIN})`,
    `**Old fail codes:** ${a.oldFailCodes.length ? a.oldFailCodes.join(', ') : 'none'}`,
    `**New fail codes:** ${a.newFailCodes.length ? a.newFailCodes.join(', ') : 'none'}`,
    `**New floor breaches:** ${newBreaches || 'none'}`,
    `**weighted_score:** ${formatScore(a.weightedScore)} | **modified_weighted_score:** ${formatScore(a.modifiedScore)} | **psych-modified:** ${formatScore(a.finalModifiedScore)}`,
    `**Stored DB passed:** ${a.storedPassed} | **Stored final_gate_pass:** ${a.storedFinalGatePass}`,
    `**Old final gate (6.0+psych):** ${a.oldFinalGateResult} | **New final gate (6.5+psych):** ${a.newFinalGateResult}`,
    `**Pillar scores:** ${pillarLine}`,
    '',
    '## Full transcript',
    '',
    ...renderTranscript(row.review.transcript),
    ...renderAiReasoningSection(row.review),
    '---',
    '',
  ];
}

function sortFlips(a: FlipExportRow, b: FlipExportRow): number {
  const ra = FLIP_REASON_ORDER.indexOf(a.audit.flipReason ?? 'unrelated');
  const rb = FLIP_REASON_ORDER.indexOf(b.audit.flipReason ?? 'unrelated');
  if (ra !== rb) return ra - rb;
  if (a.audit.flipReason === 'score_threshold_only' || a.audit.flipReason === 'both') {
    return (
      Math.abs(b.audit.modifiedScore - NEW_WEIGHTED_PASS_MIN) -
      Math.abs(a.audit.modifiedScore - NEW_WEIGHTED_PASS_MIN)
    );
  }
  return b.audit.modifiedScore - a.audit.modifiedScore;
}

function renderReport(rows: FlipExportRow[], summary: Record<string, unknown>): string {
  const byReason = (reason: FlipReason) =>
    rows.filter((r) => r.audit.flipReason === reason).length;

  const lines = [
    '# THRESHOLD / FLOOR FLIP REVIEW (PASS → FAIL)',
    '',
    `Generated from recomputed scores: old config (threshold ${OLD_WEIGHTED_PASS_MIN}, floors [${formatFloorList(OLD_CONFIG)}]) vs new config (threshold ${NEW_WEIGHTED_PASS_MIN}, floors [${formatFloorList(NEW_CONFIG)}]).`,
    '',
    `**Total pass→fail flips:** ${rows.length}`,
    `- score_threshold_only: ${byReason('score_threshold_only')}`,
    `- floor_change_only: ${byReason('floor_change_only')}`,
    `- both: ${byReason('both')}`,
    `- unrelated: ${byReason('unrelated')}`,
    '',
    `**Scorable attempts:** ${summary.scorableCount}`,
    `**Old interview pass count:** ${summary.oldPassCount}`,
    `**New interview pass count:** ${summary.newPassCount}`,
    `**Fail→pass (should be 0):** ${summary.failToPassCount}`,
    '',
    '---',
    '',
  ];

  for (const row of rows) lines.push(...renderFlipUserBlock(row));
  return lines.join('\n');
}

async function fetchCompletedAttempts(supabase: SupabaseClient): Promise<
  Array<
    ThresholdFlipAttemptRow &
      RawAttemptForAnalytics & {
        ai_reasoning: unknown;
        reasoning_pending: boolean | null;
      }
  >
> {
  const pageSize = 1000;
  const all: Array<
    ThresholdFlipAttemptRow &
      RawAttemptForAnalytics & {
        ai_reasoning: unknown;
        reasoning_pending: boolean | null;
      }
  > = [];
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
    const batch = (data ?? []) as typeof all;
    all.push(...batch);
    if (batch.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

async function main(): Promise<void> {
  mergeEnvFromDotenvFile();
  const supabase = createAdminClient();
  const raw = await fetchCompletedAttempts(supabase);
  const usersById = await fetchUsersByIds(
    supabase,
    raw.map((r) => r.user_id),
  );

  const { audits, scorableCount, productionNewPassCount } = computeThresholdFlipAudits(
    raw,
    usersById,
  );

  const passToFail = audits.filter((a) => a.flipDirection === 'pass_to_fail');
  const failToPass = audits.filter((a) => a.flipDirection === 'fail_to_pass');
  const rowByAttemptId = new Map(raw.map((r) => [r.id, r]));

  const exportRows: FlipExportRow[] = passToFail
    .map((audit) => {
      const row = rowByAttemptId.get(audit.attemptId);
      if (!row) return null;
      return {
        audit,
        completedAt: row.completed_at,
        review: {
          transcript: parseTranscript(row.transcript),
          aiReasoning: parseAiReasoning(row.ai_reasoning),
          aiReasoningRaw: parseJsonObject(row.ai_reasoning),
          reasoningPending: row.reasoning_pending === true,
          scoringEvidence: extractScoringEvidence(row),
        },
      };
    })
    .filter((r): r is FlipExportRow => r != null)
    .sort(sortFlips);

  const summary = {
    scorableCount,
    oldPassCount: audits.filter((a) => a.oldGateResult).length,
    newPassCount: audits.filter((a) => a.newGateResult).length,
    productionNewPassCount,
    passToFailCount: passToFail.length,
    failToPassCount: failToPass.length,
    withFullNarrative: exportRows.filter((r) => hasNarrativeContent(r.review.aiReasoning)).length,
    withScoringEvidenceOnly: exportRows.filter(
      (r) => !hasNarrativeContent(r.review.aiReasoning) && r.review.scoringEvidence.length > 0,
    ).length,
    withNeither: exportRows.filter(
      (r) => !hasNarrativeContent(r.review.aiReasoning) && r.review.scoringEvidence.length === 0,
    ).length,
    attempts: exportRows.map((r) => ({
      userId: r.audit.userId,
      attemptId: r.audit.attemptId,
      flipReason: r.audit.flipReason,
      modifiedScore: r.audit.modifiedScore,
      hasFullNarrative: hasNarrativeContent(r.review.aiReasoning),
    })),
  };

  const outDir = join(process.cwd(), 'scripts', 'output');
  mkdirSync(outDir, { recursive: true });
  const mdPath = join(outDir, 'threshold-flip-review.md');
  const jsonPath = join(outDir, 'threshold-flip-review-summary.json');

  writeFileSync(mdPath, renderReport(exportRows, summary), 'utf8');
  writeFileSync(jsonPath, JSON.stringify(summary, null, 2), 'utf8');

  console.log(`Wrote ${exportRows.length} pass→fail flip reviews to ${mdPath}`);
  console.log(`Summary: ${jsonPath}`);
  console.log(
    `Narrative coverage: ${summary.withFullNarrative} full, ${summary.withScoringEvidenceOnly} scoring-evidence only, ${summary.withNeither} neither`,
  );
  if (failToPass.length > 0) {
    console.warn(`Warning: ${failToPass.length} fail→pass flip(s) detected — config may have loosened.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
