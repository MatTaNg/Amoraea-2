import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchInterviewPassAdminOverride,
  interviewPassWhileScoringPending,
} from '@utilities/interviewPassEffective';

export type CommitStandardOnboardingUsersAfterAttemptParams = {
  userId: string;
  attemptIdForUserRow: string;
  gateOkForInterviewPassed: boolean;
  /** When omitted, read `attempt_number` from `interview_attempts`. */
  interviewAttemptCount?: number;
};

export async function commitStandardOnboardingUsersAfterAttempt(
  supabase: SupabaseClient,
  params: CommitStandardOnboardingUsersAfterAttemptParams,
): Promise<void> {
  const { userId, attemptIdForUserRow, gateOkForInterviewPassed } = params;
  let attemptCount = params.interviewAttemptCount;
  if (attemptCount == null) {
    const { data: attMeta } = await supabase
      .from('interview_attempts')
      .select('attempt_number')
      .eq('id', attemptIdForUserRow)
      .eq('user_id', userId)
      .maybeSingle();
    attemptCount =
      typeof attMeta?.attempt_number === 'number' && Number.isFinite(attMeta.attempt_number)
        ? attMeta.attempt_number
        : 1;
  }
  const passOverride = await fetchInterviewPassAdminOverride(supabase, userId);
  const { error: userUpErr } = await supabase
    .from('users')
    .update({
      interview_completed: true,
      interview_passed: gateOkForInterviewPassed ? interviewPassWhileScoringPending(passOverride) : false,
      interview_passed_computed: null,
      interview_completed_at: new Date().toISOString(),
      interview_attempt_count: attemptCount,
      latest_attempt_id: attemptIdForUserRow,
    })
    .eq('id', userId);
  if (userUpErr) throw new Error(userUpErr.message);
}
