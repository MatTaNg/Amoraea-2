import { supabase } from '@data/supabase/client';
import { kickClientInterviewNarrativeIfPending } from '@utilities/kickClientInterviewNarrativeIfPending';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

/** Fire-and-forget AI narrative generation after interview (psychometrics-enabled path). */
export function triggerAsyncAiReasoningPipeline(userId: string, attemptId: string): void {
  const triggeredAt = new Date().toISOString();
  void writeSessionLog({
    userId,
    attemptId,
    eventType: 'ai_pipeline_async_triggered',
    eventData: {
      interview_attempt_id: attemptId,
      triggered_at: triggeredAt,
    },
    platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
  });

  void (async () => {
    const completedAt = new Date().toISOString();
    await supabase
      .from('interview_attempts')
      .update({
        reasoning_pending: true,
        ai_reasoning: {
          _reasoningPending: true,
          note: 'Narrative generation queued (async psychometrics path).',
          _queuedAt: triggeredAt,
        },
      })
      .eq('id', attemptId)
      .eq('user_id', userId);

    await supabase
      .from('interview_attempts')
      .update({ completed_at: completedAt })
      .eq('id', attemptId)
      .eq('user_id', userId)
      .is('completed_at', null);

    const { data: userRow } = await supabase
      .from('users')
      .select('interview_completed')
      .eq('id', userId)
      .maybeSingle();

    if (userRow?.interview_completed !== true) {
      const { data: attemptMeta } = await supabase
        .from('interview_attempts')
        .select('attempt_number, completed_at')
        .eq('id', attemptId)
        .eq('user_id', userId)
        .maybeSingle();

      const resolvedCompletedAt =
        typeof attemptMeta?.completed_at === 'string' && attemptMeta.completed_at.length > 0
          ? attemptMeta.completed_at
          : completedAt;
      const attemptNumber =
        typeof attemptMeta?.attempt_number === 'number' && Number.isFinite(attemptMeta.attempt_number)
          ? attemptMeta.attempt_number
          : 1;

      await supabase
        .from('users')
        .update({
          interview_completed: true,
          interview_completed_at: resolvedCompletedAt,
          latest_attempt_id: attemptId,
          interview_attempt_count: attemptNumber,
        })
        .eq('id', userId);
    }

    await kickClientInterviewNarrativeIfPending(userId, attemptId, 'async_psychometrics_path');
  })();
}
