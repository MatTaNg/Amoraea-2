import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GATE_PASS_WEIGHTED_MIN } from './computeGateResultCore.ts';
import {
  attemptRowMissingRollupArtifacts,
  evaluateScoringStagesReadyForRollup,
  tryRunInterviewRollupWhenStagesComplete,
} from './ensureInterviewRollupArtifacts.ts';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist.ts';
import { ensureGateFailReasonsForFailedInterviewGate } from './gateFailReasonsNormalize.ts';
import { isPsychometricGateFailFloorCode } from './psychometricFloorBreaches.ts';
import { LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG } from './legacyPsychometricReview.ts';
import type { ApplyPsychometricModifierOptions } from './applyPsychometricModifier.ts';

export type FinalizeInterviewOnlyGateResult = {
  applied: boolean;
  skipReason?: string;
  rollupArtifactsBackfilled?: boolean;
};

const ATTEMPT_SELECT_GATE_ONLY = `
  user_id,
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
  gate_result_finalized_at,
  scenario_composites,
  defense_cross_reference,
  defense_patterns,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  transcript
`;

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function attemptRowMissingInterviewModifiers(row: {
  score_modifier?: unknown;
  depth_signal_modifier?: unknown;
  modified_weighted_score?: unknown;
}): boolean {
  return (
    finiteNumber(row.depth_signal_modifier) == null ||
    finiteNumber(row.score_modifier) == null ||
    finiteNumber(row.modified_weighted_score) == null
  );
}

async function persistMissingRollupArtifactsIfNeeded(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
  attempt: Record<string, unknown>,
): Promise<{ rollupArtifactsBackfilled: boolean; attempt: Record<string, unknown> }> {
  if (!attemptRowMissingRollupArtifacts(attempt)) {
    return { rollupArtifactsBackfilled: false, attempt };
  }

  const stages = evaluateScoringStagesReadyForRollup(attempt);
  if (!stages.ready) {
    console.log('[gate] interview-only gate deferred rollup backfill', {
      attemptId,
      missing: stages.missing,
    });
    return { rollupArtifactsBackfilled: false, attempt };
  }

  console.log('[rollup] Backfilling missing artifacts via gated full rollup', { attemptId });
  const result = await tryRunInterviewRollupWhenStagesComplete(supabase, attemptId, userId, {
    force: true,
    trigger: 'edge_finalizeInterviewOnlyGate:backfill',
  });
  if (!result.ok) {
    console.warn('[rollup] Gated backfill did not complete', {
      attemptId,
      skipped: result.skipped ?? null,
      error: result.error ?? null,
    });
    return { rollupArtifactsBackfilled: false, attempt };
  }

  const { data: refreshed } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_GATE_ONLY)
    .eq('id', attemptId)
    .single();
  return {
    rollupArtifactsBackfilled: true,
    attempt: (refreshed as Record<string, unknown> | null) ?? attempt,
  };
}

/** Interview-only gate when standard psychometrics are not complete (edge). */
export async function finalizeInterviewOnlyGateForAttempt(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<FinalizeInterviewOnlyGateResult> {
  console.log(`[rollup] Starting interview-only gate for attempt ${attemptId}`);

  let attemptRes = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_GATE_ONLY)
    .eq('id', attemptId)
    .single();
  let attempt = attemptRes.data as Record<string, unknown> | null;
  if (!attempt) {
    console.warn('[InterviewOnlyGate] no attempt found', attemptId);
    return { applied: false, skipReason: 'attempt_not_found' };
  }

  const backfill = await persistMissingRollupArtifactsIfNeeded(supabase, userId, attemptId, attempt);
  attempt = backfill.attempt;

  if (attempt.gate_result_finalized_at != null) {
    return { applied: false, skipReason: 'psychometric_gate_already_finalized' };
  }

  const psychModifier = finiteNumber(attempt.psychometric_modifier_applied);
  if (psychModifier != null && psychModifier !== 0) {
    return { applied: false, skipReason: 'psychometric_modifier_already_applied' };
  }

  const weightedScore = finiteNumber(attempt.weighted_score);
  let depthSignalModifiedScore =
    finiteNumber(attempt.modified_weighted_score) ?? weightedScore;

  if (depthSignalModifiedScore == null) {
    return { applied: false, skipReason: 'interview_scores_not_ready' };
  }

  const modifierFieldsForPersist = {
    depth_signal_modifier: finiteNumber(attempt.depth_signal_modifier) ?? 0,
    score_modifier: finiteNumber(attempt.score_modifier) ?? 0,
    modified_weighted_score: depthSignalModifiedScore,
  };

  if (attemptRowMissingInterviewModifiers(attempt) && weightedScore != null) {
    modifierFieldsForPersist.depth_signal_modifier = 0;
    modifierFieldsForPersist.score_modifier = 0;
    modifierFieldsForPersist.modified_weighted_score = weightedScore;
    depthSignalModifiedScore = weightedScore;
    console.warn('[InterviewOnlyGate] interview modifiers missing — defaulting to 0 before gate', {
      attemptId,
      weightedScore,
    });
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
  const normalizedGate = ensureGateFailReasonsForFailedInterviewGate({
    gateFailReasons: interviewFailReasons,
    depthSignalModifiedScore,
    finalGatePass: computedFinalPass,
    gateFailDetail,
  });
  const gateFailReasonsForPersist = normalizedGate.gateFailReasons;
  const gateFailDetailForPersist = normalizeGateFailDetailForPersist(normalizedGate.gateFailDetail);

  console.log('[rollup] Evaluating interview-only gate', {
    attemptId,
    depthSignalModifiedScore,
    finalGatePass: computedFinalPass,
    gateFailReasons: gateFailReasonsForPersist,
  });

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
    ...modifierFieldsForPersist,
    final_gate_pass: finalPass,
    gate_fail_reasons: gateFailReasonsForPersist,
    gate_fail_detail: gateFailDetailForPersist,
    passed: finalPass,
    review_flags: reviewFlagsForPersist,
  };

  const { error } = await supabase.from('interview_attempts').update(attemptUpdate).eq('id', attemptId);

  if (error) {
    console.error('[InterviewOnlyGate] persist failed:', error);
    return { applied: false, skipReason: `persist_failed: ${error.message}` };
  }

  const rollupAfterGate = await tryRunInterviewRollupWhenStagesComplete(supabase, attemptId, userId, {
    trigger: 'edge_finalizeInterviewOnlyGate:after_gate_write',
  });

  console.log('[rollup] Interview-only gate complete', {
    attemptId,
    finalPass,
    gateFailReasons: gateFailReasonsForPersist,
    rollupArtifactsBackfilled: backfill.rollupArtifactsBackfilled,
    rollupOk: rollupAfterGate.ok,
    rollupVerified: rollupAfterGate.verified,
    rollupSkipped: rollupAfterGate.skipped ?? null,
  });

  return {
    applied: true,
    skipReason: 'psychometrics_pending',
    rollupArtifactsBackfilled: backfill.rollupArtifactsBackfilled,
  };
}
