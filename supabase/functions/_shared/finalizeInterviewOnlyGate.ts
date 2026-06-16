import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GATE_PASS_WEIGHTED_MIN } from './computeGateResultCore.ts';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist.ts';
import { isPsychometricGateFailFloorCode } from './psychometricFloorBreaches.ts';
import { LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG } from './legacyPsychometricReview.ts';
import type { ApplyPsychometricModifierOptions } from './applyPsychometricModifier.ts';

export type FinalizeInterviewOnlyGateResult = {
  applied: boolean;
  skipReason?: string;
};

const ATTEMPT_SELECT_GATE_ONLY =
  'user_id, weighted_score, modified_weighted_score, passed, gate_fail_reasons, gate_fail_detail, review_flags, final_gate_pass, psychometric_modifier_applied, gate_result_finalized_at';

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Interview-only gate when standard psychometrics are not complete (edge). */
export async function finalizeInterviewOnlyGateForAttempt(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<FinalizeInterviewOnlyGateResult> {
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

  const psychModifier = finiteNumber(attempt.psychometric_modifier_applied);
  if (psychModifier != null && psychModifier !== 0) {
    return { applied: false, skipReason: 'psychometric_modifier_already_applied' };
  }

  const depthSignalModifiedScore =
    finiteNumber(attempt.modified_weighted_score) ?? finiteNumber(attempt.weighted_score);

  if (depthSignalModifiedScore == null) {
    return { applied: false, skipReason: 'interview_scores_not_ready' };
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

  const { error } = await supabase
    .from('interview_attempts')
    .update({
      final_gate_pass: finalPass,
      gate_fail_reasons: interviewFailReasons,
      gate_fail_detail: gateFailDetail,
      passed: finalPass,
      review_flags: reviewFlagsForPersist,
    })
    .eq('id', attemptId);

  if (error) {
    console.error('[InterviewOnlyGate] persist failed:', error);
    return { applied: false, skipReason: `persist_failed: ${error.message}` };
  }

  console.log('[InterviewOnlyGate] interview-only gate persisted (psychometrics pending)', {
    userId,
    attemptId,
    depthSignalModifiedScore,
    finalPass,
    interviewFailReasons,
  });

  return { applied: true, skipReason: 'psychometrics_pending' };
}
