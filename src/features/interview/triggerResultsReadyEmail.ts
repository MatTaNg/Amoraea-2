import { supabase } from '@data/supabase/client';

/**
 * Fire-and-forget results-ready email via edge function (Resend runs server-side).
 * Sends only after pass/fail reveal (admin override or 48h processing window).
 * Duplicate sends are prevented by `interview_attempts.results_email_sent_at`.
 */
export async function triggerResultsReadyEmail(
  userId: string,
  attemptId: string,
): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { error } = await supabase.functions.invoke('send-results-email', {
      body: { userId, attemptId },
      headers: session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : undefined,
    });

    if (error) {
      console.error('[ResultsEmail] client trigger failed — reveal unaffected:', error);
    }
  } catch (emailError) {
    console.error('[ResultsEmail] client trigger failed — reveal unaffected:', emailError);
  }
}
