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
import {
  hydrateShowScenarioCardPlaybackConfirmedFromStorage,
  resolveScenarioResumeIntroBodyForReplay,
  transcriptHasScenarioOpeningQuestionDelivered,
} from '@features/aria/scenarioDeliveryResumeCheckpoint';
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
import { clearResumeWelcomePlaybackLock, bumpResumeWelcomePlaybackGeneration } from '@features/aria/interviewLocalPersistence';
import { remoteLog } from '@utilities/remoteLog';
import {
  assignScenarioNumbersToTranscript,
  clearScenarioScoresFromCorruptRewind,
  computeInterviewResumePlan,
  firstAssistantIndexForScenarioIntro,
  inferLatestScenarioIntroFromTranscript,
  resumeTranscriptAlreadyDeliveredMoment4Question,
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
import { awaitInterviewScreenReadyWithTimeout } from '@features/aria/awaitInterviewScreenReadyWithTimeout';
import { hydrateScenarioSkipConfirmedCount } from '@features/aria/scenarioSkipCountHydration';
import { startResumeLoadingFailsafe } from '@features/aria/runResumeLoadingFailsafe';
import { saveInterviewToStorage } from '@utilities/storage/InterviewStorage';
import type { StoredScenarioScores } from '@utilities/storage/InterviewStorage';

export async function runHandleResume(
  deps: HandleResumeDeps,
  params: HandleResumeParams,
): Promise<void> {
  return runCoalescedInterviewResume(deps.userId, () => runHandleResumeInner(deps, params));
}

async function runHandleResumeInner(
  deps: HandleResumeDeps,
  params: HandleResumeParams,
): Promise<void> {
  if (deps.resumeHandleInFlightRef) {
    deps.resumeHandleInFlightRef.current = true;
  }

  const releaseResumeHandleInFlight = (): void => {
    if (deps.resumeHandleInFlightRef) {
      deps.resumeHandleInFlightRef.current = false;
    }
  };

  const { saved } = params;
  const {
    userId,
    awaitScreenReadySignal,
    logSessionResumeState,
    resumeLoadingFlowActiveRef,
    setResumeLoadingVisible,
    setResumeHydrationPending,
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

  let clearResumeLoadingFailsafe: (() => void) | undefined;

  try {
  bumpResumeWelcomePlaybackGeneration();
  interruptAllInterviewTtsOutput();
  moment5QuestionDeliveryInFlightRef.current = false;
  interviewUserTurnEpochRef.current += 1;
  clearResumeWelcomePlaybackLock();
  resumeLoadingFlowActiveRef.current = true;
  setResumeLoadingVisible(true);
  logSessionResumeState('loading');
  clearResumeLoadingFailsafe = startResumeLoadingFailsafe({
    userId: userId ?? undefined,
    resumeLoadingFlowActiveRef,
    resumeHandleInFlightRef: deps.resumeHandleInFlightRef,
    setResumeLoadingVisible,
    logSessionResumeState,
  });

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
    clearResumeLoadingFailsafe();
    resumeLoadingFlowActiveRef.current = false;
    setResumeLoadingVisible(false);
    setResumeHydrationPending?.(false);
    setInterviewStatus('not_started');
    interviewStatusRef.current = 'not_started';
    hasResumedRef.current = false;
    releaseResumeHandleInFlight();
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
    clearResumeLoadingFailsafe();
    await runHydratePostClosingFromSaved(deps, { saved, source: 'handle_resume_post_closing' });
    releaseResumeHandleInFlight();
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

  const resumeProgressScenario = Math.max(
    resumePlan.resumeScenario,
    resumeActiveFromLocal ?? 0,
    inferLatestScenarioIntroFromTranscript(restoredForPlan) ?? 0,
  ) as 1 | 2 | 3;

  const missingIntroAnchor =
    resumePlan.mode !== 'resume_post_scenarios' &&
    !resumePlan.rewindToMoment4DueToCorruptScoring &&
    firstAssistantIndexForScenarioIntro(restoredForPlan, resumeProgressScenario) < 0;
  const hasInScenarioProgress = transcriptHasInScenarioProgressPastOpening(
    restoredForPlan,
    resumeProgressScenario,
  );
  // Missing vignette + mid-scenario progress (Q1 / probes / user turns) must not replay the
  // full scenario opening — welcome-back + current question is enough.
  const openingQuestionDelivered = transcriptHasScenarioOpeningQuestionDelivered(
    restoredForPlan,
    resumeProgressScenario,
    saved.scenarioOpeningDeliveredFor,
  );
  const shouldRestartIncompleteScenario =
    resumeProgressScenario <= resumePlan.resumeScenario &&
    !openingQuestionDelivered &&
    ((resumePlan.rewindDueToCorruptScoring && !hasInScenarioProgress) ||
      (missingIntroAnchor &&
        !hasInScenarioProgress &&
        (resumePlan.partialScenarioDataWritten ||
          (planAttemptMismatch && !didOrphanAttemptRebind))));
  const resolvedResumeScenario = (
    shouldRestartIncompleteScenario
      ? resumePlan.resumeScenario
      : Math.max(resumePlan.resumeScenario, resumeProgressScenario)
  ) as 1 | 2 | 3;

  if (saved.lastQuestionText?.trim()) {
    deps.lastQuestionTextRef.current = saved.lastQuestionText.trim();
  }
  if (saved.scenarioOpeningDeliveredFor?.length) {
    deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current =
      hydrateShowScenarioCardPlaybackConfirmedFromStorage(saved.scenarioOpeningDeliveredFor);
  }

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
    openingQuestionDelivered,
    resumeProgressScenario,
    shouldRestartIncompleteScenario,
    resolvedResumeScenario,
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
    scoringFailed:
      resumePlan.rewindDueToCorruptScoring && shouldRestartIncompleteScenario
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
  const hydratedSkipCount = await hydrateScenarioSkipConfirmedCount({
    scenarioSkipConfirmedCountRef: deps.scenarioSkipConfirmedCountRef,
    scenarioSkipPenaltySumRef: deps.scenarioSkipPenaltySumRef,
    transcriptMessages,
    storedCount: saved.scenarioSkipConfirmedCount ?? savedForRestore.scenarioSkipConfirmedCount,
    attemptId: interviewSessionAttemptIdRef.current ?? saved.sessionAttemptId ?? null,
    userId,
  });
  const maxCompleted = restoreResumeScoredScenariosRef(savedForRestore, scoredScenariosRef);
  setHighestScenarioReached((prev) => Math.max(prev, maxCompleted));

  currentScenarioRef.current = resolvedResumeScenario;
  resumeActiveScenarioRef.current =
    resumePlan.mode === 'resume_post_scenarios' && !resumePlan.rewindToMoment4DueToCorruptScoring
      ? null
      : resolvedResumeScenario;

  const situation2VignetteInTranscript = transcriptMessages.some(
    (m) => m.role === 'assistant' && textContainsScenarioBVignetteBody(m.content ?? ''),
  );
  const situation2OpeningPlaybackConfirmed =
    saved.scenarioOpeningDeliveredFor?.includes(2) === true ||
    deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current?.situation_2 === true;
  const interruptedSituation2Handoff =
    !resumePlan.rewindDueToCorruptScoring &&
    situation2VignetteInTranscript &&
    !situation2OpeningPlaybackConfirmed &&
    resumePlan.mode !== 'resume_post_scenarios';
  if (interruptedSituation2Handoff) {
    currentScenarioRef.current = 2;
    resumeActiveScenarioRef.current = 2;
    currentInterviewMomentRef.current = Math.max(currentInterviewMomentRef.current, 2) as 1 | 2 | 3 | 4 | 5;
    (interviewMomentsCompleteRef.current as Record<number, boolean>)[1] = true;
    void remoteLog('[REENTRY_RESUME] interrupted_s2_handoff_recovery', {
      hasInScenarioProgress,
      transcriptLen: transcriptMessages.length,
    });
  }

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
      scenarioSkipConfirmedCount: hydratedSkipCount,
    });
  }

  const scoreCards = restoreResumeScenarioDisplayState(deps, savedForRestore, transcriptMessages);
  if (!scenarioIntroBody && shouldRestartIncompleteScenario) {
    scenarioIntroBody = resumePlan.rewindToMoment4DueToCorruptScoring
      ? MOMENT_4_GRUDGE_QUESTION_TEXT
      : getScenarioResumeIntroAssistantBody(resumePlan.resumeScenario);
  } else if (
    !scenarioIntroBody &&
    !shouldRestartIncompleteScenario &&
    resumePlan.mode !== 'resume_post_scenarios'
  ) {
    scenarioIntroBody = resolveScenarioResumeIntroBodyForReplay({
      scenario: resolvedResumeScenario,
      transcriptMessages,
      persistedOpeningDeliveredFor: saved.scenarioOpeningDeliveredFor,
    });
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
  if (truncatedScenarioOneBoundary && resumePlan.mode !== 'resume_post_scenarios') {
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
  if (truncatedScenarioTwoBoundary && resumePlan.mode !== 'resume_post_scenarios') {
    currentScenarioRef.current = 3;
    resumeActiveScenarioRef.current = 3;
    currentInterviewMomentRef.current = Math.max(currentInterviewMomentRef.current, 3) as 1 | 2 | 3 | 4 | 5;
    scenarioIntroBody = getScenarioResumeIntroAssistantBody(3);
  }

  /** S3 repair satisfied but M4 grudge not persisted before app close — deliver grudge, not S3 repair replay. */
  if (
    !scenarioIntroBody &&
    resumePlan.mode === 'resume_post_scenarios' &&
    !resumePlan.rewindToMoment4DueToCorruptScoring &&
    !resumeTranscriptAlreadyDeliveredMoment4Question(transcriptMessages)
  ) {
    scenarioIntroBody = MOMENT_4_GRUDGE_QUESTION_TEXT;
  }

  const fullMessages = [...transcriptMessages, ...scoreCards] as MessageWithScenario[];

  await deps.prepareInterviewAudioForResumePlayback?.();

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
    try {
      await awaitInterviewScreenReadyWithTimeout(awaitScreenReadySignal);
      if (!resumeLoadingFlowActiveRef.current) return;
      resumeLoadingFlowActiveRef.current = false;
      setResumeLoadingVisible(false);
      setResumeHydrationPending?.(false);
      logSessionResumeState('ready');
    } finally {
      clearResumeLoadingFailsafe?.();
      releaseResumeHandleInFlight();
    }
  })();
  } catch (err) {
    clearResumeLoadingFailsafe?.();
    resumeLoadingFlowActiveRef.current = false;
    setResumeLoadingVisible(false);
    setResumeHydrationPending?.(false);
    hasResumedRef.current = false;
    releaseResumeHandleInFlight();
    void remoteLog('[REENTRY_RESUME] failed', {
      message: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
