import { supabase } from '@data/supabase/client';
import {
  interviewAiReasoningIsSubstantive,
  kickClientInterviewNarrativeIfPending,
} from '@utilities/kickClientInterviewNarrativeIfPending';
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
    const { data: existing } = await supabase
      .from('interview_attempts')
      .select('ai_reasoning, reasoning_pending, completed_at, attempt_number')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();

    const existingReasoning = (existing?.ai_reasoning ?? null) as Record<string, unknown> | null;
    if (interviewAiReasoningIsSubstantive(existingReasoning)) {
      if (existing?.reasoning_pending === true) {
        await supabase
          .from('interview_attempts')
          .update({ reasoning_pending: false })
          .eq('id', attemptId)
          .eq('user_id', userId);
      }
      await kickClientInterviewNarrativeIfPending(userId, attemptId, 'async_psychometrics_path_substantive');
      return;
    }

    const alreadyQueued =
      existing?.reasoning_pending === true && existingReasoning?._reasoningPending === true;
    if (!alreadyQueued) {
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
    }

    const completedAt = new Date().toISOString();
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
      const resolvedCompletedAt =
        typeof existing?.completed_at === 'string' && existing.completed_at.length > 0
          ? existing.completed_at
          : completedAt;
      const attemptNumber =
        typeof existing?.attempt_number === 'number' && Number.isFinite(existing.attempt_number)
          ? existing.attempt_number
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
