import { useCallback, useEffect } from 'react';

import { kickCompletionScoring, registerScoreInterviewForCompletion } from '@features/aria/completionScoringKick';
import type { InterviewSessionStatus, VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { PreparingResultsFailsafeDeps } from '@features/aria/preparingResultsFailsafeTypes';
import { runPreparingResultsFailsafePhase } from '@features/aria/runPreparingResultsFailsafePhase';
import { runSaveInterviewResults } from '@features/aria/runSaveInterviewResults';
import { runScoreInterview } from '@features/aria/runScoreInterview';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { syncPreparingResultsFailsafeDeps, syncScoreInterviewDeps } from '@features/aria/syncAriaInterviewDepsRefs';
import type { GateResult } from '@features/aria/computeGateResult';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';

export type InterviewCompletionScoringEffectInputs = {
  fromValidationTrack: boolean;
  pendingCompletion: boolean;
  status: InterviewSessionStatus;
  voiceState: VoiceState;
  interviewStatus:
    | 'loading'
    | 'not_started'
    | 'in_progress'
    | 'preparing_results'
    | 'under_review'
    | 'congratulations'
    | 'analysis';
  userId: string;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  userEmail: string | null | undefined;
  navigation: ScoreInterviewDeps['navigation'];
};

export function useInterviewCompletionScoring(
  scoreInterviewDepsRef: React.MutableRefObject<ScoreInterviewDeps>,
  failsafeDepsRef: React.MutableRefObject<PreparingResultsFailsafeDeps>,
  syncCtx: AriaInterviewDepsSyncContext,
  effectInputs: InterviewCompletionScoringEffectInputs,
  completionRefs: {
    isInterviewCompleteRef: React.MutableRefObject<boolean>;
    pendingCompletionTranscriptRef: React.MutableRefObject<
      Array<{ role: string; content: string; interviewMoment?: number; scenarioNumber?: number }> | null
    >;
    scoreInterviewAttemptedRef: React.MutableRefObject<boolean>;
    interviewStatusRef: React.MutableRefObject<string>;
    setInterviewStatus: ScoreInterviewDeps['setInterviewStatus'];
    setPendingCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  },
) {
  const {
    fromValidationTrack,
    pendingCompletion,
    status,
    voiceState,
    interviewStatus,
    userId,
    isAdmin,
    isInterviewAppRoute,
    userEmail,
    navigation,
  } = effectInputs;

  const {
    isInterviewCompleteRef,
    pendingCompletionTranscriptRef,
    scoreInterviewAttemptedRef,
    interviewStatusRef,
    setInterviewStatus,
    setPendingCompletion,
  } = completionRefs;

  const saveInterviewResults = useCallback(
    async (results: InterviewResults, gateResult: GateResult, uid: string) => {
      await runSaveInterviewResults({ results, gateResult, uid });
    },
    [],
  );

  syncScoreInterviewDeps(scoreInterviewDepsRef, {
    ...syncCtx,
    userId,
    isAdmin,
    isInterviewAppRoute,
    saveInterviewResults,
  });

  syncPreparingResultsFailsafeDeps(failsafeDepsRef, {
    ...syncCtx,
    scoreInterviewAttemptedRef,
    pendingCompletionTranscriptRef,
    kickCompletionScoring,
  });

  const scoreInterview = useCallback(
    async (finalMessages: { role: string; content: string }[]) => {
      await runScoreInterview(scoreInterviewDepsRef.current, { finalMessages });
    },
    [scoreInterviewDepsRef],
  );

  registerScoreInterviewForCompletion(scoreInterview);

  useEffect(() => {
    if (interviewStatus !== 'preparing_results' || !userId || isAdmin) return;
    let cancelled = false;
    const runPhase = async (phase: 'edge_retry' | 'force_standard_recovery') => {
      await runPreparingResultsFailsafePhase(failsafeDepsRef.current, phase, () => cancelled);
    };
    const tEdge = setTimeout(() => void runPhase('edge_retry'), 45_000);
    /** M4/M5 deferred scoring can take up to DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS each (×2 + retries) — avoid force recovery while client scoring may still be running. */
    const tForce = setTimeout(() => void runPhase('force_standard_recovery'), 360_000);
    return () => {
      cancelled = true;
      clearTimeout(tEdge);
      clearTimeout(tForce);
    };
  }, [interviewStatus, userId, isAdmin, failsafeDepsRef]);

  useEffect(() => {
    if (!fromValidationTrack || !pendingCompletion) return;
    interviewStatusRef.current = 'preparing_results';
    setInterviewStatus('preparing_results');
  }, [fromValidationTrack, pendingCompletion, interviewStatusRef, setInterviewStatus]);

  useEffect(() => {
    if (!fromValidationTrack || status !== 'scoring') return;
    interviewStatusRef.current = 'preparing_results';
    setInterviewStatus('preparing_results');
  }, [fromValidationTrack, status, interviewStatusRef, setInterviewStatus]);

  useEffect(() => {
    registerScoreInterviewForCompletion(scoreInterview);
    return () => registerScoreInterviewForCompletion(null);
  }, [scoreInterview]);

  useEffect(() => {
    if (!pendingCompletion) return;
    /** After `[INTERVIEW_COMPLETE]`, `isInterviewCompleteRef` is set before closing TTS — allow scoring start even if parallel streaming left `voiceState` stuck on speaking/processing. */
    const voiceOkForScoringStart = voiceState === 'idle' || isInterviewCompleteRef.current;
    if (!voiceOkForScoringStart) {
      return;
    }
    const transcript = pendingCompletionTranscriptRef.current;
    if (transcript?.length) {
      pendingCompletionTranscriptRef.current = null;
      setPendingCompletion(false);
      if (kickCompletionScoring('pending_completion_effect', transcript)) {
        scoreInterviewAttemptedRef.current = true;
      }
    }
  }, [
    pendingCompletion,
    voiceState,
    isInterviewCompleteRef,
    pendingCompletionTranscriptRef,
    scoreInterviewAttemptedRef,
    setPendingCompletion,
  ]);

  return { scoreInterview, saveInterviewResults };
}
