import { supabase } from '@data/supabase/client';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateSuccess,
} from '@features/aria/adminRecalculateAttemptScores';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist';
import { isPsychometricGateFailFloorCode } from './psychometricFloorBreaches';
import { LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG } from './legacyPsychometricReview';
import type { ApplyPsychometricModifierOptions } from './applyPsychometricModifier';

export type FinalizeInterviewOnlyGateResult = {
  applied: boolean;
  skipReason?: string;
  rollupPersisted?: boolean;
};

const ATTEMPT_SELECT_ROLLUP = `
  id,
  user_id,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  skip_count,
  ego_development_level,
  language_markers,
  defense_patterns,
  disclosure_calibration,
  mentalizing_overcertainty_count,
  skip_penalty_total,
  auto_failed,
  moment_4_concreteness,
  moment_5_concreteness,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  weighted_score,
  modified_weighted_score,
  depth_signal_modifier,
  score_modifier,
  passed,
  gate_fail_reasons,
  gate_fail_detail,
  review_flags,
  final_gate_pass,
  psychometric_modifier_applied,
  modified_weighted_score_with_psychometrics,
  gate_result_finalized_at
`;

const ATTEMPT_SELECT_GATE_ONLY = `
  user_id,
  weighted_score,
  modified_weighted_score,
  passed,
  gate_fail_reasons,
  gate_fail_detail,
  review_flags,
  final_gate_pass,
  psychometric_modifier_applied,
  gate_result_finalized_at
`;

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function rollupPayloadFromSuccess(result: AdminRecalculateSuccess): Record<string, unknown> {
  return {
    pillar_scores: result.pillar_scores,
    weighted_score: result.gate.weightedScore,
    passed: result.gate.pass,
    gate_fail_reasons: result.gate.failReasonCodes ?? [],
    gate_fail_detail: normalizeGateFailDetailForPersist(result.gate.failReasonDetail),
    scenario_composites: result.scenarioCompositesJson,
    review_flags: result.gate.reviewFlags ?? [],
    mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
    defense_patterns: result.defense_patterns,
    moment_4_concreteness: result.moment_4_concreteness ?? result.gate.moment4Concreteness ?? null,
    moment_5_concreteness: result.moment_5_concreteness ?? result.gate.moment5Concreteness ?? null,
    personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
    depth_signal_modifier: result.gate.depthSignalModifier ?? result.gate.scoreModifier ?? null,
    score_modifier: result.gate.scoreModifier ?? result.gate.depthSignalModifier ?? null,
    modified_weighted_score: result.gate.modifiedWeightedScore ?? null,
    disclosure_calibration: result.disclosure_calibration,
    ego_development_level: result.ego_development_level,
    incomplete_reason: null,
  };
}

/**
 * Recompute weighted_score / pillar_scores from stored scenario+moment slices when missing.
 * Psychometric modifier fields are intentionally untouched.
 */
async function persistInterviewRollupFromStoredSlicesIfNeeded(
  attemptId: string,
): Promise<{ rollupPersisted: boolean; weighted_score: number | null; modified_weighted_score: number | null }> {
  const { data: row, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_ROLLUP)
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !row) {
    return { rollupPersisted: false, weighted_score: null, modified_weighted_score: null };
  }

  const attempt = row as Record<string, unknown>;
  const existingWeighted = finiteNumber(attempt.weighted_score);
  const existingModified = finiteNumber(attempt.modified_weighted_score);

  if (existingWeighted != null && existingModified != null) {
    return {
      rollupPersisted: false,
      weighted_score: existingWeighted,
      modified_weighted_score: existingModified,
    };
  }

  const result = recalculateAttemptScoresFromStoredSlices(
    {
      transcript: attempt.transcript,
      scenario_1_scores: attempt.scenario_1_scores,
      scenario_2_scores: attempt.scenario_2_scores,
      scenario_3_scores: attempt.scenario_3_scores,
      scenario_specific_patterns: attempt.scenario_specific_patterns,
      skip_count: attempt.skip_count as number | string | null | undefined,
      ego_development_level: attempt.ego_development_level,
      language_markers: attempt.language_markers,
      defense_patterns: attempt.defense_patterns,
      disclosure_calibration: attempt.disclosure_calibration,
      mentalizing_overcertainty_count: attempt.mentalizing_overcertainty_count as number | null,
      skip_penalty_total: attempt.skip_penalty_total as number | null,
      auto_failed: attempt.auto_failed as boolean | null,
      moment_4_concreteness: attempt.moment_4_concreteness,
      moment_5_concreteness: attempt.moment_5_concreteness,
      personal_moment_emotional_vocab_density: attempt.personal_moment_emotional_vocab_density as number | null,
      personal_moment_emotional_vocab_low: attempt.personal_moment_emotional_vocab_low as boolean | null,
      persisted_weighted_score: existingWeighted,
    },
    { skipScenarioTranscriptMutations: true, usePersistedGateContext: true },
  );

  if (result.kind !== 'success') {
    return { rollupPersisted: false, weighted_score: existingWeighted, modified_weighted_score: existingModified };
  }

  const { error: upErr } = await supabase
    .from('interview_attempts')
    .update(rollupPayloadFromSuccess(result))
    .eq('id', attemptId);

  if (upErr) {
    console.warn('[InterviewOnlyGate] rollup persist failed:', upErr.message);
    return { rollupPersisted: false, weighted_score: existingWeighted, modified_weighted_score: existingModified };
  }

  return {
    rollupPersisted: true,
    weighted_score: finiteNumber(result.gate.weightedScore),
    modified_weighted_score: finiteNumber(result.gate.modifiedWeightedScore),
  };
}

/**
 * Persist interview-only gate result when standard psychometrics are not yet complete.
 * Leaves psychometric_modifier_applied / modified_weighted_score_with_psychometrics / gate_result_finalized_at null.
 */
export async function finalizeInterviewOnlyGateForAttempt(
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<FinalizeInterviewOnlyGateResult> {
  const rollup = await persistInterviewRollupFromStoredSlicesIfNeeded(attemptId);

  const attemptRes = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_GATE_ONLY)
    .eq('id', attemptId)
    .single();
  const attempt = attemptRes.data as Record<string, unknown> | null;
  if (!attempt) {
    console.warn('[InterviewOnlyGate] no attempt found', attemptId);
    return { applied: false, skipReason: 'attempt_not_found' };
  }

  if (attempt.gate_result_finalized_at != null) {
    return { applied: false, skipReason: 'psychometric_gate_already_finalized' };
  }

  if (attempt.psychometric_modifier_applied != null && finiteNumber(attempt.psychometric_modifier_applied) !== 0) {
    return { applied: false, skipReason: 'psychometric_modifier_already_applied' };
  }

  const depthSignalModifiedScore =
    finiteNumber(attempt.modified_weighted_score) ??
    rollup.modified_weighted_score ??
    finiteNumber(attempt.weighted_score) ??
    rollup.weighted_score;

  if (depthSignalModifiedScore == null) {
    return { applied: false, skipReason: 'interview_scores_not_ready', rollupPersisted: rollup.rollupPersisted };
  }

  const existingFailReasons = Array.isArray(attempt.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as string[])
    : [];
  const interviewFailReasons = existingFailReasons.filter((code) => !isPsychometricGateFailFloorCode(code));

  const existingDetail =
    attempt.gate_fail_detail != null &&
    typeof attempt.gate_fail_detail === 'object' &&
    !Array.isArray(attempt.gate_fail_detail)
      ? (attempt.gate_fail_detail as Record<string, unknown>)
      : null;
  const normalizedDetail = normalizeGateFailDetailForPersist(existingDetail);
  const { psychometric_floors: _ignoredPsychFloors, ...detailWithoutPsychFloors } = normalizedDetail;
  const gateFailDetail = normalizeGateFailDetailForPersist({
    ...detailWithoutPsychFloors,
    psychometric_floors: {},
  });

  const interviewGatePass =
    interviewFailReasons.length === 0 && depthSignalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
  const computedFinalPass = interviewGatePass;
  const wasPreviouslyPassing = attempt.passed === true;
  const wouldFlipPassToFail =
    options?.preservePassIfPreviouslyPassing === true &&
    wasPreviouslyPassing &&
    !computedFinalPass;

  const existingReviewFlags = Array.isArray(attempt.review_flags)
    ? (attempt.review_flags as string[])
    : [];
  const reviewFlagsForPersist = wouldFlipPassToFail
    ? [...new Set([...existingReviewFlags, LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG])]
    : existingReviewFlags;

  const finalPass = wouldFlipPassToFail ? true : computedFinalPass;

  const attemptUpdate: Record<string, unknown> = {
    final_gate_pass: finalPass,
    gate_fail_reasons: interviewFailReasons,
    gate_fail_detail: gateFailDetail,
    passed: finalPass,
    review_flags: reviewFlagsForPersist,
  };

  const { error } = await supabase.from('interview_attempts').update(attemptUpdate).eq('id', attemptId);

  if (error) {
    console.error('[InterviewOnlyGate] persist failed:', error);
    return { applied: false, skipReason: `persist_failed: ${error.message}`, rollupPersisted: rollup.rollupPersisted };
  }

  console.log('[InterviewOnlyGate] interview-only gate persisted (psychometrics pending)', {
    userId,
    attemptId,
    depthSignalModifiedScore,
    finalPass,
    interviewFailReasons,
    rollupPersisted: rollup.rollupPersisted,
  });

  return { applied: true, skipReason: 'psychometrics_pending', rollupPersisted: rollup.rollupPersisted };
}
