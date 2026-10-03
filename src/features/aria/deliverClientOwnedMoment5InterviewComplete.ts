import { supabase } from '@data/supabase/client';

import { deriveClosingPillarContextFromScenarioScores } from '@features/aria/closingReflectionGrounding';
import { markPreparingResultsSession, saveInterviewProgress } from '@features/aria/interviewLocalPersistence';
import { compactInterviewTranscriptTurns, commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { enrichPersonalMomentClosingForTts } from '@features/aria/personalMomentClosingEnrichment';
import { buildMoment5UserSkippedScoresAggregate } from '@features/aria/moment5ScoringParse';
import { sanitizeMoment5PersonalScoresForAggregate } from '@features/aria/personalMomentSliceSanitize';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { fetchAttemptScoringBaseline, persistMoment5ScoresImmediate } from '@utilities/persistPersonalMomentScoresIncremental';
import { remoteLog } from '@utilities/remoteLog';
import { markQuestionDelivered } from '@utilities/sessionLogging';
import { persistInterviewAttemptSessionLifecycle } from '@utilities/interviewAttemptLifecycle';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';

export type ClientOwnedMoment5InterviewCompleteTrigger =
  | 'm5_skip_accepted'
  | 'm5_substantive_close';

/** Client-owned closing TTS + preparing_results — no Claude ad-hoc follow-ups. */
export async function deliverClientOwnedMoment5InterviewComplete(
  deps: PreClaudeTurnGateDeps,
  messagesToUse: MessageWithScenario[],
  trigger: ClientOwnedMoment5InterviewCompleteTrigger,
): Promise<void> {
  deps.interviewMomentsCompleteRef.current[4] = true;
  deps.interviewMomentsCompleteRef.current[5] = true;
  deps.isInterviewCompleteRef.current = true;
  deps.skipContinuationSystemSuffixRef.current = '';

  const participantFirstName = (deps.interviewNameRef.current ?? '').trim();
  const closing = enrichPersonalMomentClosingForTts(
    '',
    participantFirstName,
    null,
    deriveClosingPillarContextFromScenarioScores(deps.scenarioScoresRef.current),
  );
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    closing,
    {
      scenarioNumber: 3,
      interviewMoment: 5,
    },
    (next) => deps.setMessages(next),
  );
  void remoteLog(
    trigger === 'm5_skip_accepted'
      ? '[SKIP_ACCEPTED_M5_INTERVIEW_COMPLETE_CLIENT]'
      : '[M5_SUBSTANTIVE_CLOSE_CLIENT]',
    {
      interviewSessionId: deps.interviewSessionIdRef.current,
      trigger,
      preview: closing.slice(0, 220),
    },
  );
  await deps.speakTextSafe(closing, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    skipLastQuestionRef: true,
    allowDuplicateConsecutiveTts: true,
    skipClosingSessionDedup: true,
  });
  markQuestionDelivered(new Date().toISOString());

  if (trigger === 'm5_skip_accepted') {
    const attemptId = deps.interviewSessionAttemptIdRef.current;
    if (attemptId && deps.userId) {
      const skippedM5 = sanitizeMoment5PersonalScoresForAggregate(buildMoment5UserSkippedScoresAggregate());
      if (skippedM5) {
        try {
          const baseline = await fetchAttemptScoringBaseline(supabase, attemptId, deps.userId);
          await persistMoment5ScoresImmediate(
            supabase,
            attemptId,
            deps.userId,
            skippedM5,
            baseline,
            { skipped_by_user: true, skip_trigger: 'm5_skip_request_confirmed' },
          );
        } catch (persistErr) {
          void remoteLog('[WARN] persistMoment5ScoresImmediate_failed_m5_skip', {
            message: persistErr instanceof Error ? persistErr.message : String(persistErr),
          });
        }
      }
    }
  }

  void persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
  const transcriptForScoring = compactInterviewTranscriptTurns(
    [...messagesToUse, { role: 'assistant', content: closing, scenarioNumber: 3, interviewMoment: 5 }].filter(
      (m) => m.role === 'user' || m.role === 'assistant',
    ),
  );
  deps.pendingCompletionTranscriptRef.current = transcriptForScoring;
  if (deps.userId) {
    const completed = Array.from(deps.scoredScenariosRef.current);
    const scenarioScoresPayload: Record<
      number,
      {
        pillarScores: Record<string, number | null>;
        pillarConfidence: Record<string, string>;
        keyEvidence: Record<string, string>;
        scenarioName?: string;
      }
    > = {};
    [1, 2, 3].forEach((n) => {
      const s = deps.scenarioScoresRef.current[n] as
        | {
            pillarScores: Record<string, number | null>;
            pillarConfidence: Record<string, string>;
            keyEvidence: Record<string, string>;
            scenarioName?: string;
          }
        | undefined;
      if (s) {
        scenarioScoresPayload[n] = {
          pillarScores: s.pillarScores,
          pillarConfidence: s.pillarConfidence,
          keyEvidence: s.keyEvidence,
          scenarioName: s.scenarioName,
        };
      }
    });
    try {
      await saveInterviewProgress(deps.userId, {
        messages: transcriptForScoring,
        scenariosCompleted: completed,
        scenarioScores: scenarioScoresPayload,
        currentScenario: getCurrentScenario(deps.scoredScenariosRef.current),
        resumeActiveScenario: deps.resumeActiveScenarioRef.current,
        emotionItemResponses: [...deps.emotionItemResponsesRef.current],
        pendingCompletion: true,
        scenarioSkipConfirmedCount: deps.scenarioSkipConfirmedCountRef.current,
      });
    } catch (persistErr) {
      void remoteLog('[WARN] saveInterviewProgress_failed_before_m5_completion', {
        trigger,
        message: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }
  }
  deps.kickCompletionScoring(trigger, transcriptForScoring);
  deps.interviewStatusRef.current = 'preparing_results';
  deps.setInterviewStatus('preparing_results');
  if (deps.userId) markPreparingResultsSession(deps.userId);
  deps.setPendingCompletion(true);
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
}
