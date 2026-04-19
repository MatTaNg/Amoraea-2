import { supabase } from '@data/supabase/client';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';

/** Signup invite code that unlocks post-interview retake for QA (scores stay on the server). */
export const QA_RETAKE_SIGNUP_CODE = 'ABC-QA';

export function isQaRetakeSignupCode(raw: string | null | undefined): boolean {
  if (raw == null || typeof raw !== 'string') return false;
  return raw.trim().toUpperCase() === QA_RETAKE_SIGNUP_CODE.toUpperCase();
}

/**
 * Reset interview progress so the user can run the interview again, without clearing
 * stored scores on `users` (weighted, pillar, pass, completion time) — for QA accounts.
 */
export async function resetInterviewForQaRetake(userId: string): Promise<void> {
  const { data: userData } = await supabase
    .from('users')
    .select('interview_attempt_count')
    .eq('id', userId)
    .single();
  const nextAttemptNumber = (userData?.interview_attempt_count ?? 0) + 1;
  const { error } = await supabase
    .from('users')
    .update({
      interview_completed: false,
      interview_last_checkpoint: 0,
      interview_attempt_count: nextAttemptNumber,
      latest_attempt_id: null,
    })
    .eq('id', userId);
  if (error) throw error;
  await clearInterviewFromStorage(userId);
}
