import { supabase } from '@data/supabase/client';
import { applyReferralCompletionEffects } from '@features/referrals/referralInterview';
import { markReferralCompletionCongratsPending } from '@features/referrals/referralCompletionCongratsStorage';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';

export type FinalizeGateResultOutcome = {
  ok: boolean;
  attemptId: string | null;
  message?: string;
};

/** Computes and persists final gate fields after psychometrics are complete. */
export async function finalizeGateResultAfterPsychometrics(
  userId: string,
  attemptId?: string | null,
): Promise<FinalizeGateResultOutcome> {
  const resolvedAttemptId =
    attemptId ?? (await fetchMostRecentCompletedInterviewAttemptId(userId));
  if (!resolvedAttemptId) {
    return { ok: false, attemptId: null, message: 'No completed interview attempt found.' };
  }

  const result = await applyPsychometricModifierToAttempt(userId, resolvedAttemptId, {
    forceApply: true,
  });

  if (!result.applied) {
    return {
      ok: false,
      attemptId: resolvedAttemptId,
      message: result.skipReason ?? 'Gate finalization did not apply.',
    };
  }

  const { error } = await supabase
    .from('interview_attempts')
    .update({ gate_result_finalized_at: new Date().toISOString() })
    .eq('id', resolvedAttemptId)
    .eq('user_id', userId);

  if (error) {
    return { ok: false, attemptId: resolvedAttemptId, message: error.message };
  }

  await applyReferralCompletionEffects(userId);
  await markReferralCompletionCongratsPending(userId);

  return { ok: true, attemptId: resolvedAttemptId };
}
