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

    await kickClientInterviewNarrativeIfPending(userId, attemptId, 'async_psychometrics_path');
  })();
}
