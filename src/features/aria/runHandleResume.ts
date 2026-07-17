import { supabase } from '@data/supabase/client';
import { applyResumeWelcomeMessagesAndPlayback } from '@features/aria/applyResumeWelcomeMessagesAndPlayback';
import {
  fetchResumeScoringIntegritySnapshot,
  mergeLocalAndDbScenarioScores,
} from '@features/aria/fetchResumeScoringIntegritySnapshot';
import { hydrateResumeEmotionCatchUp } from '@features/aria/hydrateResumeEmotionCatchUp';
import { hydrateResumeProbeFlagsFromTranscript } from '@features/aria/hydrateResumeProbeFlagsFromTranscript';
import { syncInterviewMomentsFromTranscript } from '@features/aria/interviewProgressSync';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { getScenarioResumeIntroAssistantBody } from '@features/aria/interviewScenarioVignetteCopy';
import {
  reconcileResumeAttemptRow,
  syncResumeAttemptIdForSessionLogs,
} from '@features/aria/reconcileResumeAttemptRow';
import {
  restoreResumeScenarioDisplayState,
  restoreResumeScoredScenariosRef,
} from '@features/aria/restoreResumeScenarioDisplayState';
import { runHydratePostClosingFromSaved } from '@features/aria/runHydratePostClosingFromSaved';
import type { HandleResumeDeps, HandleResumeParams } from '@features/aria/sessionLifecycleTypes';
import { clearResumeWelcomePlaybackLock } from '@features/aria/interviewLocalPersistence';
import { remoteLog } from '@utilities/remoteLog';
import {
  assignScenarioNumbersToTranscript,
  clearScenarioScoresFromCorruptRewind,
  computeInterviewResumePlan,
  firstAssistantIndexForScenarioIntro,
  savedInterviewReachedClosingState,
  sliceMessagesBeforeMoment4Intro,
  sliceMessagesBeforeScenarioIntro,
  stripEphemeralWelcomeBackMessages,
  transcriptHasInScenarioProgressPastOpening,
} from '@utilities/interviewResumeCursor';
import { isScenarioABoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioAContemptProbeTextMatch';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { isScenarioBBoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioBProbeLogic';
import { isScenarioCQ1Prompt } from '@features/aria/scenarioCPromptDetection';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { saveInterviewToStorage } from '@utilities/storage/InterviewStorage';
import type { StoredScenarioScores } from '@utilities/storage/InterviewStorage';

export async function runHandleResume(
  deps: HandleResumeDeps,
  params: HandleResumeParams,
): Promise<void> {
  const { saved } = params;
  const {
    userId,
    awaitScreenReadySignal,
    logSessionResumeState,
    resumeLoadingFlowActiveRef,
    setResumeLoadingVisible,
    interviewSessionAttemptIdRef,
    interviewMomentsCompleteRef,
    currentInterviewMomentRef,
    personalHandoffInjectedRef,
    scoredScenariosRef,
    setHighestScenarioReached,
    currentScenarioRef,
    resumeActiveScenarioRef,
    setInterviewStatus,
    setStatus,
    hasResumedRef,
    interviewStatusRef,
    interruptAllInterviewTtsOutput,
    moment5QuestionDeliveryInFlightRef,
    interviewUserTurnEpochRef,
  } = deps;

  interruptAllInterviewTtsOutput();
  moment5QuestionDeliveryInFlightRef.current = false;
  interviewUserTurnEpochRef.current += 1;
  clearResumeWelcomePlaybackLock();
  resumeLoadingFlowActiveRef.current = true;
  setResumeLoadingVisible(true);
  logSessionResumeState('loading');

  const bootstrapAttemptId = interviewSessionAttemptIdRef.current;
  const savedAttemptId = saved.sessionAttemptId ?? null;
  const attemptMismatch = Boolean(
    savedAttemptId && bootstrapAttemptId && savedAttemptId !== bootstrapAttemptId,
  );

  const attemptReconcile = await reconcileResumeAttemptRow({
    userId,
    saved,
    bootstrapAttemptId,
    interviewSessionAttemptIdRef,
  });
  if (attemptReconcile.kind === 'abort_stale') {
    resumeLoadingFlowActiveRef.current = false;
    setResumeLoadingVisible(false);
    setInterviewStatus('not_started');
    hasResumedRef.current = false;
    return;
  }

  const {
    planAttemptMismatch,
    resumeAttemptResumeScenario,
    resumeAttemptEmotionResponses,
    didOrphanAttemptRebind,
  } = attemptReconcile;

  const restoredForPlan = assignScenarioNumbersToTranscript(
    stripEphemeralWelcomeBackMessages(saved.messages ?? []),
  );
  if (savedInterviewReachedClosingState({ pendingCompletion: saved.pendingCompletion, messages: restoredForPlan })) {
    await runHydratePostClosingFromSaved(deps, { saved, source: 'handle_resume_post_closing' });
    return;
  }

  const syncedForPlan = syncInterviewMomentsFromTranscript(restoredForPlan, saved.scenariosCompleted ?? []);
  const resumeActiveFromLocal =
    saved.resumeActiveScenario ??
    (saved.currentScenario === 1 || saved.currentScenario === 2 || saved.currentScenario === 3
      ? saved.currentScenario
      : null);

  const attemptIdForIntegrity =
    interviewSessionAttemptIdRef.current ?? saved.sessionAttemptId ?? null;
  const integrity = await fetchResumeScoringIntegritySnapshot(
    supabase,
    attemptIdForIntegrity,
    userId,
  );
  const scoresForPlan = mergeLocalAndDbScenarioScores({
    local: saved.scenarioScores,
    dbCells: {
      scenario_1_scores: integrity.dbScenarioScores[1] ?? null,
      scenario_2_scores: integrity.dbScenarioScores[2] ?? null,
      scenario_3_scores: integrity.dbScenarioScores[3] ?? null,
    },
  });

  const resumePlan = computeInterviewResumePlan({
    scenariosCompleted: saved.scenariosCompleted ?? [],
    scenarioScores: scoresForPlan,
    resumeActiveFromStorage: resumeActiveFromLocal,
    resumeActiveFromAttempt: planAttemptMismatch
      ? resumeAttemptResumeScenario ?? resumeActiveFromLocal
      : resumeAttemptResumeScenario,
    transcriptMessages: restoredForPlan,
    syncedMoments: syncedForPlan,
    scoringFailed: saved.scoringFailed ?? null,
    moment4ScoresIntact: integrity.moment4ScoresIntact,
  });

  const missingIntroAnchor =
    resumePlan.mode !== 'resume_post_scenarios' &&
    !resumePlan.rewindToMoment4DueToCorruptScoring &&
    firstAssistantIndexForScenarioIntro(restoredForPlan, resumePlan.resumeScenario) < 0;
  const hasInScenarioProgress = transcriptHasInScenarioProgressPastOpening(
    restoredForPlan,
    resumePlan.resumeScenario,
  );
  // Missing vignette + mid-scenario progress (Q1 / probes / user turns) must not replay the
  // full scenario opening — welcome-back + current question is enough.
  const shouldRestartIncompleteScenario =
    resumePlan.rewindDueToCorruptScoring ||
    (missingIntroAnchor &&
      !hasInScenarioProgress &&
      (resumePlan.partialScenarioDataWritten ||
        (planAttemptMismatch && !didOrphanAttemptRebind)));

  let transcriptMessages = restoredForPlan as MessageWithScenario[];
  let scoresAfterRewind: StoredScenarioScores = scoresForPlan;
  let completedAfterRewind = saved.scenariosCompleted ?? [];
  let scenarioIntroBody: string | null = null;

  if (shouldRestartIncompleteScenario) {
    if (resumePlan.rewindToMoment4DueToCorruptScoring) {
      transcriptMessages = sliceMessagesBeforeMoment4Intro(restoredForPlan) as MessageWithScenario[];
      scenarioIntroBody = MOMENT_4_GRUDGE_QUESTION_TEXT;
    } else {
      transcriptMessages = sliceMessagesBeforeScenarioIntro(
        restoredForPlan,
        resumePlan.resumeScenario,
      ) as MessageWithScenario[];
      scenarioIntroBody = getScenarioResumeIntroAssistantBody(resumePlan.resumeScenario);
      const cleared = clearScenarioScoresFromCorruptRewind(
        scoresForPlan,
        saved.scenariosCompleted ?? [],
        resumePlan.resumeScenario,
      );
      scoresAfterRewind = cleared.scenarioScores;
      completedAfterRewind = cleared.scenariosCompleted;
    }
  }

  void remoteLog('[REENTRY_RESUME]', {
    lastCompletedScenario: resumePlan.lastCompletedScenario,
    resumeScenario: resumePlan.resumeScenario,
    mode: resumePlan.mode,
    partialScenarioDataWritten: resumePlan.partialScenarioDataWritten,
    rewindDueToCorruptScoring: resumePlan.rewindDueToCorruptScoring,
    rewindToMoment4DueToCorruptScoring: resumePlan.rewindToMoment4DueToCorruptScoring,
    resumeActiveFromAttempt: resumeAttemptResumeScenario,
    resumeActiveFromStorage: saved.resumeActiveScenario ?? null,
    resumeActiveFromLocal: resumeActiveFromLocal ?? null,
    attemptMismatch: planAttemptMismatch,
    didOrphanAttemptRebind,
    missingIntroAnchor,
    hasInScenarioProgress,
    shouldRestartIncompleteScenario,
    transcriptLenBefore: restoredForPlan.length,
    transcriptLenAfter: transcriptMessages.length,
  });

  syncResumeAttemptIdForSessionLogs({
    didOrphanAttemptRebind,
    attemptMismatch,
    savedAttemptId,
    bootstrapAttemptId,
    interviewSessionAttemptIdRef,
  });

  interviewMomentsCompleteRef.current = resumePlan.momentsComplete;
  currentInterviewMomentRef.current = resumePlan.effectiveMoment;
  personalHandoffInjectedRef.current = resumePlan.rewindToMoment4DueToCorruptScoring
    ? false
    : resumePlan.personalHandoffInjected;

  const savedForRestore = {
    ...saved,
    scenarioScores: scoresAfterRewind,
    scenariosCompleted: completedAfterRewind,
    scoringFailed: resumePlan.rewindDueToCorruptScoring
      ? (saved.scoringFailed ?? []).filter(
          (f) =>
            resumePlan.rewindToMoment4DueToCorruptScoring ||
            f.scenario < resumePlan.resumeScenario,
        )
      : saved.scoringFailed,
  };

  const moment5ClarificationFired = hydrateResumeProbeFlagsFromTranscript(
    deps,
    savedForRestore,
    transcriptMessages,
  );
  const maxCompleted = restoreResumeScoredScenariosRef(savedForRestore, scoredScenariosRef);
  setHighestScenarioReached((prev) => Math.max(prev, maxCompleted));

  currentScenarioRef.current = resumePlan.resumeScenario;
  resumeActiveScenarioRef.current =
    resumePlan.mode === 'resume_post_scenarios' && !resumePlan.rewindToMoment4DueToCorruptScoring
      ? null
      : resumePlan.resumeScenario;

  hydrateResumeEmotionCatchUp({
    deps,
    saved: savedForRestore,
    resumePlan,
    transcriptMessages,
    resumeAttemptEmotionResponses,
  });

  const persistenceAttemptId = interviewSessionAttemptIdRef.current ?? savedAttemptId;
  if (persistenceAttemptId && userId) {
    await supabase
      .from('interview_attempts')
      .update({ resume_active_scenario: resumeActiveScenarioRef.current })
      .eq('id', persistenceAttemptId)
      .eq('user_id', userId);
    await saveInterviewToStorage(userId, {
      ...savedForRestore,
      sessionAttemptId: persistenceAttemptId,
      messages: transcriptMessages,
      resumeActiveScenario: resumeActiveScenarioRef.current,
      moment_5_clarification_fired: moment5ClarificationFired,
    });
  }

  const scoreCards = restoreResumeScenarioDisplayState(deps, savedForRestore, transcriptMessages);
  if (!scenarioIntroBody && shouldRestartIncompleteScenario) {
    scenarioIntroBody = resumePlan.rewindToMoment4DueToCorruptScoring
      ? MOMENT_4_GRUDGE_QUESTION_TEXT
      : getScenarioResumeIntroAssistantBody(resumePlan.resumeScenario);
  }

  const lastAssistantContent = [...transcriptMessages]
    .reverse()
    .find((m) => m.role === 'assistant' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack)
    ?.content;
  const truncatedScenarioOneBoundary =
    !resumePlan.rewindDueToCorruptScoring &&
    typeof lastAssistantContent === 'string' &&
    isScenarioABoundaryReflectionWithoutNextVignette(lastAssistantContent) &&
    !transcriptMessages.some(
      (m) => m.role === 'assistant' && textContainsScenarioBVignetteBody(m.content ?? ''),
    );
  if (truncatedScenarioOneBoundary) {
    currentScenarioRef.current = 2;
    resumeActiveScenarioRef.current = 2;
    currentInterviewMomentRef.current = Math.max(currentInterviewMomentRef.current, 2) as 1 | 2 | 3 | 4 | 5;
    scenarioIntroBody = getScenarioResumeIntroAssistantBody(2);
  }

  const truncatedScenarioTwoBoundary =
    !resumePlan.rewindDueToCorruptScoring &&
    typeof lastAssistantContent === 'string' &&
    (isScenarioBBoundaryReflectionWithoutNextVignette(lastAssistantContent) ||
      isScenarioCQ1Prompt(lastAssistantContent)) &&
    !transcriptMessages.some(
      (m) => m.role === 'assistant' && textContainsScenarioCVignetteBody(m.content ?? ''),
    );
  if (truncatedScenarioTwoBoundary) {
    currentScenarioRef.current = 3;
    resumeActiveScenarioRef.current = 3;
    currentInterviewMomentRef.current = Math.max(currentInterviewMomentRef.current, 3) as 1 | 2 | 3 | 4 | 5;
    scenarioIntroBody = getScenarioResumeIntroAssistantBody(3);
  }

  const fullMessages = [...transcriptMessages, ...scoreCards] as MessageWithScenario[];

  await applyResumeWelcomeMessagesAndPlayback({
    deps,
    resumePlan,
    transcriptMessages,
    fullMessages,
    scenarioIntroBody,
    persistenceAttemptId,
  });

  setInterviewStatus('in_progress');
  interviewStatusRef.current = 'in_progress';
  setStatus('active');
  hasResumedRef.current = true;
  void (async () => {
    await awaitScreenReadySignal();
    if (!resumeLoadingFlowActiveRef.current) return;
    resumeLoadingFlowActiveRef.current = false;
    setResumeLoadingVisible(false);
    logSessionResumeState('ready');
  })();
}
