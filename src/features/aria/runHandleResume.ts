import { Platform } from 'react-native';

import { supabase } from '@data/supabase/client';
import { applyResumeWelcomeMessagesAndPlayback } from '@features/aria/applyResumeWelcomeMessagesAndPlayback';
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
import { clearWebInterviewHtmlTabRestoreState } from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import { remoteLog } from '@utilities/remoteLog';
import {
  assignScenarioNumbersToTranscript,
  computeInterviewResumePlan,
  firstAssistantIndexForScenarioIntro,
  inferLatestScenarioIntroFromTranscript,
  savedInterviewReachedClosingState,
  sliceMessagesBeforeScenarioIntro,
  stripEphemeralWelcomeBackMessages,
} from '@utilities/interviewResumeCursor';
import { isScenarioABoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioAContemptProbeTextMatch';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { isScenarioBBoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioBProbeLogic';
import { isScenarioCQ1Prompt } from '@features/aria/scenarioCPromptDetection';
import { saveInterviewToStorage } from '@utilities/storage/InterviewStorage';

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
    interruptAllWebInterviewTtsOutput,
    moment5QuestionDeliveryInFlightRef,
    interviewUserTurnEpochRef,
  } = deps;

  interruptAllWebInterviewTtsOutput();
  moment5QuestionDeliveryInFlightRef.current = false;
  interviewUserTurnEpochRef.current += 1;
  clearResumeWelcomePlaybackLock();
  resumeLoadingFlowActiveRef.current = true;
  setResumeLoadingVisible(true);
  logSessionResumeState('loading');
  if (Platform.OS === 'web') {
    clearWebInterviewHtmlTabRestoreState();
  }

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
  const resumePlan = computeInterviewResumePlan({
    scenariosCompleted: saved.scenariosCompleted ?? [],
    scenarioScores: saved.scenarioScores,
    resumeActiveFromStorage: resumeActiveFromLocal,
    resumeActiveFromAttempt: planAttemptMismatch
      ? resumeAttemptResumeScenario ?? resumeActiveFromLocal
      : resumeAttemptResumeScenario,
    transcriptMessages: restoredForPlan,
    syncedMoments: syncedForPlan,
  });

  const missingIntroAnchor =
    resumePlan.mode !== 'resume_post_scenarios' &&
    firstAssistantIndexForScenarioIntro(restoredForPlan, resumePlan.resumeScenario) < 0;
  const shouldRestartIncompleteScenario =
    missingIntroAnchor &&
    (resumePlan.partialScenarioDataWritten ||
      (planAttemptMismatch && !didOrphanAttemptRebind));
  const transcriptMessages = (shouldRestartIncompleteScenario
    ? sliceMessagesBeforeScenarioIntro(restoredForPlan, resumePlan.resumeScenario)
    : restoredForPlan) as MessageWithScenario[];

  void remoteLog('[REENTRY_RESUME]', {
    lastCompletedScenario: resumePlan.lastCompletedScenario,
    resumeScenario: resumePlan.resumeScenario,
    mode: resumePlan.mode,
    partialScenarioDataWritten: resumePlan.partialScenarioDataWritten,
    resumeActiveFromAttempt: resumeAttemptResumeScenario,
    resumeActiveFromStorage: saved.resumeActiveScenario ?? null,
    resumeActiveFromLocal: resumeActiveFromLocal ?? null,
    attemptMismatch: planAttemptMismatch,
    didOrphanAttemptRebind,
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
  personalHandoffInjectedRef.current = resumePlan.personalHandoffInjected;

  const moment5ClarificationFired = hydrateResumeProbeFlagsFromTranscript(deps, saved, transcriptMessages);
  const maxCompleted = restoreResumeScoredScenariosRef(saved, scoredScenariosRef);
  setHighestScenarioReached((prev) => Math.max(prev, maxCompleted));

  currentScenarioRef.current = resumePlan.resumeScenario;
  resumeActiveScenarioRef.current =
    resumePlan.mode === 'resume_post_scenarios' ? null : resumePlan.resumeScenario;

  hydrateResumeEmotionCatchUp({
    deps,
    saved,
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
      ...saved,
      sessionAttemptId: persistenceAttemptId,
      messages: transcriptMessages,
      resumeActiveScenario: resumeActiveScenarioRef.current,
      moment_5_clarification_fired: moment5ClarificationFired,
    });
  }

  const scoreCards = restoreResumeScenarioDisplayState(deps, saved, transcriptMessages);
  let scenarioIntroBody = shouldRestartIncompleteScenario
    ? getScenarioResumeIntroAssistantBody(resumePlan.resumeScenario)
    : null;

  const lastAssistantContent = [...transcriptMessages]
    .reverse()
    .find((m) => m.role === 'assistant' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack)
    ?.content;
  const truncatedScenarioOneBoundary =
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
