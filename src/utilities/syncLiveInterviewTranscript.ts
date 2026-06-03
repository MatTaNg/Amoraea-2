import type { SupabaseClient } from '@supabase/supabase-js';

/** Persist live interview messages on the active attempt row (canonical; replaces `users.interview_transcript`). */
export async function syncLiveInterviewTranscriptToAttempt(
  supabase: SupabaseClient,
  params: {
    attemptId: string;
    userId: string;
    transcript: unknown;
    resumeActiveScenario?: number | null;
  },
): Promise<void> {
  const update: Record<string, unknown> = { transcript: params.transcript };
  if (params.resumeActiveScenario !== undefined) {
    update.resume_active_scenario = params.resumeActiveScenario;
  }
  const { error } = await supabase
    .from('interview_attempts')
    .update(update)
    .eq('id', params.attemptId)
    .eq('user_id', params.userId);
  if (error && __DEV__) {
    console.warn('[syncLiveInterviewTranscriptToAttempt]', error.message);
  }
}
