import type { SupabaseClient } from '@supabase/supabase-js';
import { USER_INTERVIEW_ROUTING_TABLE } from '@data/supabase/userInterviewRoutingSelect';
import { buildUsersRowInterviewPassFromGate } from '@utilities/interviewPassEffective';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from './moment4ScoringParse';
import { evidenceAbsentForResponseDepthModifier, isIntentionallyRecoveredScoreEvidence } from './probeEvidenceUtils';

/** Review flag when LLM rescore would replace substantive keyEvidence with salvage placeholders. */
export const RESCORE_EVIDENCE_DEGRADED_REVIEW_FLAG = 'rescore_evidence_degraded';

/** Review flag when ai_reasoning verdict fields disagreed with top-level rollup at recalc time. */
export const AI_REASONING_VERDICT_MISMATCH_REVIEW_FLAG = 'ai_reasoning_verdict_mismatch';

/** Review flag when admin/bulk recalculation changed pass/fail or final_gate_pass. */
export const SCORE_RECOMPUTE_GATE_FLIP_REVIEW_FLAG = 'score_recompute_gate_flip';

export type ScoreBundleLike = {
  keyEvidence?: unknown;
  pillarScores?: unknown;
  pillar_scores?: unknown;
};

function parseKeyEvidence(bundle: unknown): Record<string, string> {
  if (bundle == null || typeof bundle !== 'object' || Array.isArray(bundle)) return {};
  const raw = (bundle as ScoreBundleLike).keyEvidence;
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v;
  }
  return out;
}

/** True when the evidence line is the salvage placeholder, not substantive transcript grounding. */
export function keyEvidenceLineIsRecoveredPlaceholder(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  return (
    isIntentionallyRecoveredScoreEvidence(t) ||
    t === MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE ||
    /score\s+recovered\s+from\s+model\s+output/i.test(t)
  );
}

/** True when keyEvidence carries assessable transcript grounding (not empty / salvage / insufficient). */
export function keyEvidenceLineIsSubstantive(text: unknown): boolean {
  if (typeof text !== 'string') return false;
  const t = text.trim();
  if (!t) return false;
  if (keyEvidenceLineIsRecoveredPlaceholder(t)) return false;
  return !evidenceAbsentForResponseDepthModifier(t);
}

export function countSubstantiveKeyEvidenceMarkers(bundle: unknown): number {
  const ke = parseKeyEvidence(bundle);
  return Object.values(ke).filter((line) => keyEvidenceLineIsSubstantive(line)).length;
}

export function countRecoveredPlaceholderMarkers(bundle: unknown): number {
  const ke = parseKeyEvidence(bundle);
  return Object.values(ke).filter((line) => keyEvidenceLineIsRecoveredPlaceholder(line)).length;
}

export function detectSliceEvidenceDegradation(
  label: string,
  priorBundle: unknown,
  nextBundle: unknown,
): { degraded: boolean; reason?: string } {
  const priorSubstantive = countSubstantiveKeyEvidenceMarkers(priorBundle);
  const nextSubstantive = countSubstantiveKeyEvidenceMarkers(nextBundle);
  const nextRecovered = countRecoveredPlaceholderMarkers(nextBundle);
  const priorKe = parseKeyEvidence(priorBundle);
  const nextKe = parseKeyEvidence(nextBundle);
  const priorHadKe = Object.keys(priorKe).length > 0;
  const nextEmptyKe = Object.keys(nextKe).length === 0;

  if (priorSubstantive >= 2 && nextRecovered >= priorSubstantive && nextSubstantive === 0) {
    return {
      degraded: true,
      reason: `${label}: substantive keyEvidence (${priorSubstantive} markers) replaced with salvage placeholders (${nextRecovered})`,
    };
  }
  if (priorSubstantive >= 1 && nextEmptyKe && priorHadKe) {
    return {
      degraded: true,
      reason: `${label}: substantive keyEvidence cleared to empty object`,
    };
  }
  if (priorSubstantive >= 3 && nextSubstantive < priorSubstantive / 2 && nextRecovered > 0) {
    return {
      degraded: true,
      reason: `${label}: substantive keyEvidence dropped ${priorSubstantive}→${nextSubstantive} with ${nextRecovered} salvage placeholders`,
    };
  }
  return { degraded: false };
}

export type LlmRescorePersistSlices = {
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
};

export function detectLlmRescoreEvidenceDegradation(
  attempt: {
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
    scenario_specific_patterns?: unknown;
  },
  llmPersist: LlmRescorePersistSlices | undefined,
): { blocked: boolean; reasons: string[] } {
  if (!llmPersist) return { blocked: false, reasons: [] };
  const patterns =
    typeof attempt.scenario_specific_patterns === 'object' &&
    attempt.scenario_specific_patterns != null &&
    !Array.isArray(attempt.scenario_specific_patterns)
      ? (attempt.scenario_specific_patterns as Record<string, unknown>)
      : {};
  const nextPatterns =
    typeof llmPersist.scenario_specific_patterns === 'object' &&
    llmPersist.scenario_specific_patterns != null &&
    !Array.isArray(llmPersist.scenario_specific_patterns)
      ? (llmPersist.scenario_specific_patterns as Record<string, unknown>)
      : {};

  const checks: Array<{ label: string; prior: unknown; next: unknown }> = [
    { label: 'scenario_1', prior: attempt.scenario_1_scores, next: llmPersist.scenario_1_scores },
    { label: 'scenario_2', prior: attempt.scenario_2_scores, next: llmPersist.scenario_2_scores },
    { label: 'scenario_3', prior: attempt.scenario_3_scores, next: llmPersist.scenario_3_scores },
    { label: 'moment_4', prior: patterns.moment_4_scores, next: nextPatterns.moment_4_scores },
    { label: 'moment_5', prior: patterns.moment_5_scores, next: nextPatterns.moment_5_scores },
  ];

  const reasons: string[] = [];
  for (const { label, prior, next } of checks) {
    if (next == null) continue;
    const { degraded, reason } = detectSliceEvidenceDegradation(label, prior, next);
    if (degraded && reason) reasons.push(reason);
  }
  return { blocked: reasons.length > 0, reasons };
}

function finiteScore(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function aiReasoningHasSubstantiveNarrative(ar: Record<string, unknown>): boolean {
  const overall = ar.overall_summary;
  if (typeof overall === 'string' && overall.trim().length > 0) return true;
  const interview = ar.interview_summary;
  if (typeof interview === 'string' && interview.trim().length > 0) return true;
  const strengths = ar.overall_strengths;
  if (Array.isArray(strengths) && strengths.some((x) => typeof x === 'string' && x.trim().length > 0)) {
    return true;
  }
  return false;
}

/** True when ai_reasoning embeds a pass/weight that disagrees with the authoritative rollup fields. */
export function aiReasoningContradictsAttemptVerdict(
  aiReasoning: unknown,
  passed: boolean | null | undefined,
  weightedScore: number | null | undefined,
): boolean {
  return aiReasoningHasDangerousVerdictMismatch(aiReasoning, passed, weightedScore);
}

/**
 * P0-grade mismatch: contradictory pass/fail, substantive narrative with stale weight,
 * or large weight drift on a backup stub that could be read as the verdict.
 */
export function aiReasoningHasDangerousVerdictMismatch(
  aiReasoning: unknown,
  passed: boolean | null | undefined,
  weightedScore: number | null | undefined,
): boolean {
  if (aiReasoning == null || typeof aiReasoning !== 'object' || Array.isArray(aiReasoning)) return false;
  const ar = aiReasoning as Record<string, unknown>;
  const arPassed = ar.passed;
  if (typeof arPassed === 'boolean' && typeof passed === 'boolean' && arPassed !== passed) return true;
  const arWeighted = finiteScore(ar.weighted_score);
  const topWeighted = finiteScore(weightedScore);
  if (arWeighted == null || topWeighted == null) return false;
  const delta = Math.abs(arWeighted - topWeighted);
  if (delta < 0.05) return false;
  if (aiReasoningHasSubstantiveNarrative(ar)) return true;
  return delta >= 0.25;
}

export function shouldInvalidateAiReasoningAfterRecalculation(input: {
  aiReasoning: unknown;
  oldPassed: boolean | null | undefined;
  oldWeightedScore: number | null | undefined;
  newPassed: boolean | null | undefined;
  newWeightedScore: number | null | undefined;
}): boolean {
  const { aiReasoning, oldPassed, oldWeightedScore, newPassed, newWeightedScore } = input;
  if (aiReasoning == null) return false;

  if (aiReasoningContradictsAttemptVerdict(aiReasoning, newPassed, newWeightedScore)) return true;

  const passFlipped =
    typeof oldPassed === 'boolean' &&
    typeof newPassed === 'boolean' &&
    oldPassed !== newPassed;
  if (passFlipped) return true;

  if (aiReasoningHasDangerousVerdictMismatch(aiReasoning, newPassed, newWeightedScore)) return true;

  const oldW = finiteScore(oldWeightedScore);
  const newW = finiteScore(newWeightedScore);
  if (oldW != null && newW != null && Math.abs(oldW - newW) >= 0.05 && priorHasVerdictFields(aiReasoning)) {
    return true;
  }

  return false;
}

function priorHasVerdictFields(aiReasoning: unknown): boolean {
  if (aiReasoning == null || typeof aiReasoning !== 'object' || Array.isArray(aiReasoning)) return false;
  const ar = aiReasoning as Record<string, unknown>;
  return typeof ar.passed === 'boolean' || finiteScore(ar.weighted_score) != null;
}

/**
 * When psychometrics have not finalized the gate, `final_gate_pass` should track interview-only `passed`.
 * After psychometric finalization, leave `final_gate_pass` unchanged (psych floors are authoritative).
 */
export function resolveFinalGatePassAfterInterviewRecalc(input: {
  passed: boolean | null | undefined;
  final_gate_pass: boolean | null | undefined;
  gate_result_finalized_at?: string | null;
  /** Admin recalculate: align final_gate_pass with interview rollup even when psych gate was finalized. */
  forceSync?: boolean;
}): boolean | null | 'unchanged' {
  if (!input.forceSync && input.gate_result_finalized_at != null) return 'unchanged';
  if (typeof input.passed !== 'boolean') return 'unchanged';
  if (input.final_gate_pass === input.passed) return 'unchanged';
  return input.passed;
}

/** Matches bulk recompute audit: treat non-true stored values as false for flip detection. */
export function gateVerdictFlippedStored(
  oldPassed: unknown,
  oldFinalGatePass: unknown,
  newPassed: unknown,
  newFinalGatePass: unknown,
): boolean {
  const oldPass = oldPassed === true;
  const newPass = newPassed === true;
  const oldFinal = oldFinalGatePass === true;
  const newFinal = newFinalGatePass === true;
  return oldPass !== newPass || oldFinal !== newFinal;
}

export function effectiveFinalGatePassFromAttempt(input: {
  passed?: unknown;
  final_gate_pass?: unknown;
}): boolean | null {
  if (input.final_gate_pass === true || input.final_gate_pass === false) {
    return input.final_gate_pass;
  }
  if (input.passed === true || input.passed === false) {
    return input.passed;
  }
  return null;
}

function mergeReviewFlags(existing: unknown, additions: string[]): string[] | undefined {
  if (additions.length === 0) return undefined;
  const flags = Array.isArray(existing) ? [...(existing as string[])] : [];
  for (const flag of additions) {
    if (!flags.includes(flag)) flags.push(flag);
  }
  return flags;
}

export function buildInvalidatedAiReasoningAfterRecalc(input: {
  priorAiReasoning: Record<string, unknown> | null | undefined;
  newPassed: boolean | null;
  newWeightedScore: number | null;
  newPillarScores: Record<string, number> | null | undefined;
  recalculatedAt: string;
  invalidationReason?: string;
}): Record<string, unknown> {
  const prior = input.priorAiReasoning ?? null;
  return {
    note: 'Prior AI reasoning invalidated after score recalculation; narrative regeneration queued.',
    passed: input.newPassed,
    weighted_score: input.newWeightedScore,
    pillar_scores: input.newPillarScores ?? null,
    _reasoningPending: true,
    _narrativeInvalidated: true,
    _supersededAt: input.recalculatedAt,
    _supersededReason: input.invalidationReason ?? 'recalculation_verdict_change',
    ...(prior ? { _supersededAiReasoning: prior } : {}),
  };
}

export type RecalculationConsistencyPatch = {
  ai_reasoning?: Record<string, unknown>;
  reasoning_pending?: boolean;
  final_gate_pass?: boolean | null;
  review_flags?: string[];
};

export function buildRecalculationConsistencyPatch(input: {
  attempt: {
    ai_reasoning?: unknown;
    passed?: boolean | null;
    weighted_score?: number | null;
    final_gate_pass?: boolean | null;
    gate_result_finalized_at?: string | null;
    review_flags?: unknown;
  };
  newPassed: boolean | null;
  newWeightedScore: number | null;
  newPillarScores: Record<string, number> | null | undefined;
  recalculatedAt: string;
  forceFinalGateSync?: boolean;
}): RecalculationConsistencyPatch {
  const patch: RecalculationConsistencyPatch = {};
  const priorAr =
    input.attempt.ai_reasoning != null &&
    typeof input.attempt.ai_reasoning === 'object' &&
    !Array.isArray(input.attempt.ai_reasoning)
      ? (input.attempt.ai_reasoning as Record<string, unknown>)
      : null;

  const invalidate = shouldInvalidateAiReasoningAfterRecalculation({
    aiReasoning: priorAr,
    oldPassed: input.attempt.passed,
    oldWeightedScore: input.attempt.weighted_score,
    newPassed: input.newPassed,
    newWeightedScore: input.newWeightedScore,
  });

  if (invalidate) {
    patch.ai_reasoning = buildInvalidatedAiReasoningAfterRecalc({
      priorAiReasoning: priorAr,
      newPassed: input.newPassed,
      newWeightedScore: input.newWeightedScore,
      newPillarScores: input.newPillarScores,
      recalculatedAt: input.recalculatedAt,
    });
    patch.reasoning_pending = true;
    const flags = Array.isArray(input.attempt.review_flags)
      ? [...(input.attempt.review_flags as string[])]
      : [];
    if (!flags.includes(AI_REASONING_VERDICT_MISMATCH_REVIEW_FLAG)) {
      flags.push(AI_REASONING_VERDICT_MISMATCH_REVIEW_FLAG);
    }
    patch.review_flags = flags;
  }

  const finalGate = resolveFinalGatePassAfterInterviewRecalc({
    passed: input.newPassed,
    final_gate_pass: input.attempt.final_gate_pass,
    gate_result_finalized_at: input.attempt.gate_result_finalized_at,
    forceSync: input.forceFinalGateSync === true,
  });
  if (finalGate !== 'unchanged') {
    patch.final_gate_pass = finalGate;
  }

  return patch;
}

export function buildPostRecalculationGateOutcomePatch(input: {
  attempt: {
    ai_reasoning?: unknown;
    passed?: unknown;
    final_gate_pass?: unknown;
    review_flags?: unknown;
    weighted_score?: unknown;
  };
  oldPassed: unknown;
  oldFinalGatePass: unknown;
  newPassed: unknown;
  newFinalGatePass: unknown;
  newWeightedScore: number | null;
  newPillarScores: Record<string, number> | null | undefined;
  recalculatedAt: string;
}): RecalculationConsistencyPatch | null {
  if (
    !gateVerdictFlippedStored(
      input.oldPassed,
      input.oldFinalGatePass,
      input.newPassed,
      input.newFinalGatePass,
    )
  ) {
    return null;
  }

  const patch: RecalculationConsistencyPatch = {};
  const reviewFlags = mergeReviewFlags(input.attempt.review_flags, [SCORE_RECOMPUTE_GATE_FLIP_REVIEW_FLAG]);
  if (reviewFlags) patch.review_flags = reviewFlags;

  const priorAr =
    input.attempt.ai_reasoning != null &&
    typeof input.attempt.ai_reasoning === 'object' &&
    !Array.isArray(input.attempt.ai_reasoning)
      ? (input.attempt.ai_reasoning as Record<string, unknown>)
      : null;

  const effectiveOldPassed = effectiveFinalGatePassFromAttempt({
    passed: input.oldPassed,
    final_gate_pass: input.oldFinalGatePass,
  });
  const effectiveNewPassed = effectiveFinalGatePassFromAttempt({
    passed: input.newPassed,
    final_gate_pass: input.newFinalGatePass,
  });
  const newWeightedScore =
    input.newWeightedScore ??
    (typeof input.attempt.weighted_score === 'number' && Number.isFinite(input.attempt.weighted_score)
      ? input.attempt.weighted_score
      : null);

  const invalidate = shouldInvalidateAiReasoningAfterRecalculation({
    aiReasoning: priorAr,
    oldPassed: effectiveOldPassed,
    oldWeightedScore: input.attempt.weighted_score,
    newPassed: effectiveNewPassed,
    newWeightedScore,
  });

  if (invalidate) {
    patch.ai_reasoning = buildInvalidatedAiReasoningAfterRecalc({
      priorAiReasoning: priorAr,
      newPassed: effectiveNewPassed,
      newWeightedScore,
      newPillarScores: input.newPillarScores,
      recalculatedAt: input.recalculatedAt,
      invalidationReason: 'recalculation_gate_flip',
    });
    patch.reasoning_pending = true;
    const flags = mergeReviewFlags(patch.review_flags ?? input.attempt.review_flags, [
      AI_REASONING_VERDICT_MISMATCH_REVIEW_FLAG,
    ]);
    if (flags) patch.review_flags = flags;
  }

  return patch;
}

/** After admin recalculate + psych apply, sync review flags, narrative, and user routing when gate flips. */
export async function applyPostRecalculationGateOutcomeSync(
  supabase: SupabaseClient,
  input: {
    attemptId: string;
    userId: string;
    oldPassed: unknown;
    oldFinalGatePass: unknown;
    recalculatedAt: string;
    afterAttempt: {
      passed?: unknown;
      final_gate_pass?: unknown;
      review_flags?: unknown;
      ai_reasoning?: unknown;
      weighted_score?: unknown;
    };
    newPillarScores?: Record<string, number> | null;
    newWeightedScore?: number | null;
  },
): Promise<{ gateFlipped: boolean; userPassSynced: boolean }> {
  const gateFlipped = gateVerdictFlippedStored(
    input.oldPassed,
    input.oldFinalGatePass,
    input.afterAttempt.passed,
    input.afterAttempt.final_gate_pass,
  );

  const outcomePatch = buildPostRecalculationGateOutcomePatch({
    attempt: input.afterAttempt,
    oldPassed: input.oldPassed,
    oldFinalGatePass: input.oldFinalGatePass,
    newPassed: input.afterAttempt.passed,
    newFinalGatePass: input.afterAttempt.final_gate_pass,
    newWeightedScore: input.newWeightedScore ?? null,
    newPillarScores: input.newPillarScores ?? null,
    recalculatedAt: input.recalculatedAt,
  });

  if (outcomePatch) {
    const { error } = await supabase
      .from('interview_attempts')
      .update({
        ...(outcomePatch.review_flags != null ? { review_flags: outcomePatch.review_flags } : {}),
        ...(outcomePatch.ai_reasoning != null ? { ai_reasoning: outcomePatch.ai_reasoning } : {}),
        ...(outcomePatch.reasoning_pending != null
          ? { reasoning_pending: outcomePatch.reasoning_pending }
          : {}),
      })
      .eq('id', input.attemptId)
      .eq('user_id', input.userId);
    if (error) {
      console.warn('[Recalculation] post-recalc gate outcome patch failed', error.message);
    }
  }

  const effectivePass = effectiveFinalGatePassFromAttempt(input.afterAttempt);
  if (effectivePass == null) {
    return { gateFlipped, userPassSynced: false };
  }

  if (!gateFlipped) {
    return { gateFlipped: false, userPassSynced: false };
  }

  const passFields = await buildUsersRowInterviewPassFromGate(supabase, input.userId, effectivePass);
  const { error: userErr } = await supabase
    .from(USER_INTERVIEW_ROUTING_TABLE)
    .update(passFields)
    .eq('id', input.userId);
  if (userErr) {
    console.warn('[Recalculation] user interview_pass sync failed', userErr.message);
    return { gateFlipped, userPassSynced: false };
  }

  return { gateFlipped, userPassSynced: true };
}
