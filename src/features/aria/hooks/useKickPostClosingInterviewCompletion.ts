import { useCallback } from 'react';

import { markPreparingResultsSession, saveInterviewProgress } from '@features/aria/interviewLocalPersistence';
import { transcriptHasInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { persistInterviewAttemptSessionLifecycle } from '@utilities/interviewAttemptLifecycle';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';
import { remoteLog } from '@utilities/remoteLog';

export type KickPostClosingInterviewCompletionDeps = {
  userId: string;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  status: string;
  setVoiceState: (state: VoiceState) => void;
  setInterviewStatus: (status: 'preparing_results') => void;
  setPendingCompletion: (pending: boolean) => void;
  setIsWaiting: (waiting: boolean) => void;
  setPendingScoringSyncAttemptId: (id: string | null) => void;
  isInterviewCompleteRef: React.MutableRefObject<boolean>;
  interviewMomentsCompleteRef: React.MutableRefObject<Record<number, boolean>>;
  currentInterviewMomentRef: React.MutableRefObject<number>;
  pendingCompletionTranscriptRef: React.MutableRefObject<
    Array<{ role: string; content: string; interviewMoment?: number; scenarioNumber?: number }> | null
  >;
  scoredScenariosRef: React.MutableRefObject<Set<number>>;
  scenarioScoresRef: React.MutableRefObject<
    Record<
      number,
      {
        pillarScores: Record<string, number | null>;
        pillarConfidence: Record<string, string>;
        keyEvidence: Record<string, string>;
        scenarioName?: string;
      }
    >
  >;
  resumeActiveScenarioRef: React.MutableRefObject<1 | 2 | 3 | null>;
  emotionItemResponsesRef: React.MutableRefObject<string[]>;
  interviewSessionAttemptIdRef: React.MutableRefObject<string | null>;
  interviewSessionIdRef: React.MutableRefObject<string>;
  interviewStatusRef: React.MutableRefObject<string>;
  kickCompletionScoring: (
    source: string,
    transcript: Array<{ role: string; content: string; interviewMoment?: number; scenarioNumber?: number }>,
  ) => void;
  awaitEmotionModalForIndex: (itemIndex: number) => Promise<void>;
  listUnansweredEmotionModalIndices: (
    responses: string[],
    throughScenario: 1 | 2 | 3,
  ) => number[];
};

export function useKickPostClosingInterviewCompletion(
  depsRef: React.MutableRefObject<KickPostClosingInterviewCompletionDeps>,
) {
  const kickPostClosingInterviewCompletionIfReady = useCallback(
    async (
      source: string,
      transcriptMessages: ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>,
    ): Promise<boolean> => {
      const deps = depsRef.current;
      if (
        deps.isInterviewCompleteRef.current ||
        !deps.isInterviewAppRoute ||
        deps.isAdmin ||
        deps.status !== 'active'
      ) {
        return false;
      }
      if (!transcriptHasInterviewClosingAssistantMessage(transcriptMessages)) {
        return false;
      }
      void remoteLog('[M5_CLOSING_RESUME_HANDOFF_EVAL]', {
        source,
        interviewSessionId: deps.interviewSessionIdRef.current,
        transcriptLen: transcriptMessages.length,
      });
      void persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
      deps.interviewMomentsCompleteRef.current[4] = true;
      deps.interviewMomentsCompleteRef.current[5] = true;
      deps.currentInterviewMomentRef.current = 5;
      deps.isInterviewCompleteRef.current = true;
      deps.setVoiceState('idle');
      const transcriptForScoring = transcriptMessages
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => {
          const row = m as {
            role: string;
            content?: string;
            interviewMoment?: number;
            scenarioNumber?: number;
          };
          return {
            role: row.role,
            content: row.content ?? '',
            ...(typeof row.interviewMoment === 'number' ? { interviewMoment: row.interviewMoment } : {}),
            ...(typeof row.scenarioNumber === 'number' ? { scenarioNumber: row.scenarioNumber } : {}),
          };
        });
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
          const s = deps.scenarioScoresRef.current[n];
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
          });
        } catch (persistErr) {
          void remoteLog('[WARN] saveInterviewProgress_failed_before_pending_completion', {
            message: persistErr instanceof Error ? persistErr.message : String(persistErr),
          });
        }
      }
      void remoteLog('[M5_CLOSING_RESUME_HANDOFF]', {
        source,
        interviewSessionId: deps.interviewSessionIdRef.current,
      });
      deps.kickCompletionScoring(source, transcriptForScoring);
      deps.interviewStatusRef.current = 'preparing_results';
      deps.setInterviewStatus('preparing_results');
      if (deps.userId) markPreparingResultsSession(deps.userId);
      deps.setPendingCompletion(true);
      deps.setIsWaiting(false);
      const attemptForPoll = deps.interviewSessionAttemptIdRef.current;
      if (deps.userId && typeof attemptForPoll === 'string' && attemptForPoll.length > 0) {
        deps.setPendingScoringSyncAttemptId(attemptForPoll);
      }
      return true;
    },
    [depsRef],
  );

  return { kickPostClosingInterviewCompletionIfReady };
}
