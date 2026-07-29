import type { QueryClient } from '@tanstack/react-query';
import type { MutableRefObject } from 'react';

import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewLifecycleDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewLifecycleDepSyncWiring';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { InterviewFirstNameProfile } from '@features/aria/interviewerFrameworkPrompt';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewLifecycleDepSyncWiringParamsFromScreenInput = {
  syncContexts: {
    coreCtx: AriaInterviewDepsSyncContext;
    coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
    coreGateServicesFullSyncCtx: AriaInterviewDepsSyncContext;
    servicesBaseCtx: AriaInterviewDepsSyncContext;
  };
  session: AriaInterviewScreenSessionState;
  route: { name?: string };
  navigation: unknown;
  user: { email?: string | null } | null | undefined;
  userId: string;
  fromValidationTrack: boolean;
  typologyContext: string;
  queryClient: QueryClient;
  profile: InterviewFirstNameProfile | undefined;
  interview: ReturnType<typeof useAriaInterviewSession>;
  interviewSession: {
    recognitionRef: MutableRefObject<unknown>;
    onboardingAutoStartRef: MutableRefObject<boolean>;
    startInterviewInFlightRef: MutableRefObject<boolean>;
    setInterviewStartInFlight: (value: boolean) => void;
  };
  boot: {
    ensureValidSession: AriaInterviewLifecycleDepSyncWiringParams['completionScoring']['actions']['ensureValidSession'];
    resetInterviewProgressRefs: AriaInterviewLifecycleDepSyncWiringParams['sessionLifecycle']['status']['resetInterviewProgressRefs'];
  };
  emotion: {
    awaitEmotionModalForIndex: AriaInterviewLifecycleDepSyncWiringParams['sessionLifecycle']['status']['awaitEmotionModalForIndex'];
    loadEmotionResponsesForCompletion: AriaInterviewLifecycleDepSyncWiringParams['completionScoring']['actions']['loadEmotionResponsesForCompletion'];
    applyEmotionResponsesToSession: AriaInterviewLifecycleDepSyncWiringParams['completionScoring']['actions']['applyEmotionResponsesToSession'];
  };
  turnCluster: {
    notifyScenarioStarted: AriaInterviewLifecycleDepSyncWiringParams['sessionLifecycle']['status']['notifyScenarioStarted'];
    scoreScenario: AriaInterviewLifecycleDepSyncWiringParams['completionScoring']['actions']['scoreScenario'];
    audioRecorder: AriaInterviewLifecycleDepSyncWiringParams['sessionLifecycle']['status']['audioRecorder'];
  };
  setHighestScenarioReached: (value: number | ((prev: number) => number)) => void;
};

/** Assemble lifecycle dep-sync params from session state + upstream hook outputs. */
export function buildAriaInterviewLifecycleDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewLifecycleDepSyncWiringParamsFromScreenInput,
): AriaInterviewLifecycleDepSyncWiringParams {
  const {
    syncContexts,
    session,
    route,
    navigation,
    user,
    userId,
    fromValidationTrack,
    typologyContext,
    queryClient,
    profile,
    interview,
    interviewSession,
    boot,
    emotion,
    turnCluster,
    setHighestScenarioReached,
  } = input;
  const { status, voiceState, awaitScreenReadySignal, logSessionResumeState } = interview;
  const {
    setStatus,
    setMicError,
    setMicPermission,
    setMicWarning,
    setExchangeCount,
    setCurrentTranscript,
    transcriptAtReleaseRef,
    isSpeakingRef,
  } = interview;
  const { closingQuestion, gate, shell, routing } = session;
  const {
    isInterviewAppRoute,
    resumeLoadingFlowActiveRef,
    resumeHandleInFlightRef,
    setResumeLoadingVisible,
    setResumeHydrationPending,
  } = routing;
  const { currentInterviewMomentRef, responseTimingsRef } = gate.moments;
  const { scoreInterviewAttemptedRef } = gate.progressReset;
  const {
    isAdmin,
    interviewStatus,
    interviewAttemptBootstrap,
    pendingCompletion,
    postInterviewFeedback,
    resumeEmotionCatchUpIndicesRef,
    interviewStatusRef,
    isInterviewCompleteRef,
    pendingCompletionTranscriptRef,
    hasResumedRef,
    interviewUserTurnEpochRef,
    setEmotionItemResponses,
    setEmotionItemsComplete,
    setPendingCompletion,
    setInterviewStatus,
    setStageResults,
    setTouchedConstructs,
    setReferenceCardScenario,
    setReferenceCardPrompt,
    setInterviewUiPhase,
    setSessionAudioHealthNotice,
    setPreInterviewConsentAge,
    setPreInterviewConsentData,
    setResults,
    setAnalysisAttemptId,
    setPendingScoringSyncAttemptId,
    setIsWaiting,
    setTypedAnswer,
    setUsedPersonalExamples,
    analysisAttemptId,
    timingRef,
    waitingMessageIdRef,
  } = shell;
  const {
    recognitionRef,
    onboardingAutoStartRef,
    startInterviewInFlightRef,
    setInterviewStartInFlight,
  } = interviewSession;

  return {
    ...syncContexts,
    showSimpleAlert: wiring.showSimpleAlert,
    showConfirmDialog: wiring.showConfirmDialog,
    sessionLifecycle: {
      status: {
        interviewStatus,
        interviewAttemptBootstrap,
        onboardingAutoStartRef,
        awaitScreenReadySignal,
        logSessionResumeState,
        awaitEmotionModalForIndex: emotion.awaitEmotionModalForIndex,
        notifyScenarioStarted: turnCluster.notifyScenarioStarted,
        resetInterviewProgressRefs: boot.resetInterviewProgressRefs,
        audioRecorder: turnCluster.audioRecorder,
        profile,
        hasResumedRef,
    interviewUserTurnEpochRef,
        resumeLoadingFlowActiveRef,
        resumeHandleInFlightRef,
        setResumeLoadingVisible,
        setResumeHydrationPending,
        startInterviewInFlightRef,
        setInterviewStartInFlight,
      },
      setters: {
        setHighestScenarioReached,
        setEmotionItemResponses,
        setEmotionItemsComplete,
        resumeEmotionCatchUpIndicesRef,
        setPendingCompletion,
        setInterviewStatus,
        setStageResults,
        setTouchedConstructs,
        setStatus,
        setReferenceCardScenario,
        setReferenceCardPrompt,
        setInterviewUiPhase,
        setMicError,
        setMicPermission,
      },
      audioDevice: {
        setAudioRouteKind: wiring.setAudioRouteKind,
        setSessionLogPlatform: wiring.setSessionLogPlatform,
        setAudioSessionDeviceSnapshot: wiring.setAudioSessionDeviceSnapshot,
        setLastInterviewDeviceEnvironment: wiring.setLastInterviewDeviceEnvironment,
        setSessionAudioRoutes: wiring.setSessionAudioRoutes,
        setSessionAudioHealthNotice,
      },
    },
    sessionLifecycleEffects: {
      userId,
      isAdmin,
      isInterviewAppRoute,
      status,
      interviewStatus,
      interviewAttemptBootstrap,
    },
    completionScoring: {
      identity: {
        userId,
        isAdmin,
        typologyContext,
        routeName: route.name,
        userEmail: user?.email,
        profile,
        fromValidationTrack,
        navigation,
        queryClient,
      },
      actions: {
        ensureValidSession: boot.ensureValidSession,
        scoreScenario: turnCluster.scoreScenario,
        setResults,
        setStageResults,
        setInterviewStatus,
        setStatus,
        setPendingScoringSyncAttemptId,
        loadEmotionResponsesForCompletion: emotion.loadEmotionResponsesForCompletion,
        applyEmotionResponsesToSession: emotion.applyEmotionResponsesToSession,
        markCompletionScoringInFlight: wiring.markCompletionScoringInFlight,
        replaceWithStandardApplicantPostInterviewHandoffForUser:
          preamble.replaceWithStandardApplicantPostInterviewHandoffForUser,
        setInterviewLastCommittedAttemptId: wiring.setInterviewLastCommittedAttemptId,
      },
    },
    completionScoringEffects: {
      fromValidationTrack,
      pendingCompletion,
      status,
      voiceState,
      interviewStatus,
      userId,
      isAdmin,
      isInterviewAppRoute,
      userEmail: user?.email,
      navigation,
    },
    completionRefs: {
      isInterviewCompleteRef,
      pendingCompletionTranscriptRef,
      scoreInterviewAttemptedRef,
      interviewStatusRef,
      setInterviewStatus,
      setPendingCompletion,
    },
    performRetake: {
      closingQuestion,
      interviewReset: {
        currentInterviewMomentRef,
        onboardingAutoStartRef,
        responseTimingsRef,
        setMicError,
        setPreInterviewConsentAge,
        setPreInterviewConsentData,
        setStatus,
        setResults,
        setAnalysisAttemptId,
        setPendingScoringSyncAttemptId,
        setInterviewLastCommittedAttemptId: wiring.setInterviewLastCommittedAttemptId,
        setInterviewStatus,
      },
    },
    performAdminInterviewReset: {
      media: {
        audioRecorder: turnCluster.audioRecorder,
        recognitionRef,
        stopElevenLabsPlayback: wiring.stopElevenLabsPlayback,
        stopElevenLabsSpeech: wiring.stopElevenLabsSpeech,
      },
      storage: {
        clearInterviewFromStorage: wiring.clearInterviewFromStorage,
        setInterviewJustCompletedInSession: wiring.setInterviewJustCompletedInSession,
        hasResumedRef,
      },
      closingQuestion,
      sessionRefs: {
        onboardingAutoStartRef,
        timingRef,
        transcriptAtReleaseRef,
        waitingMessageIdRef,
        isSpeakingRef,
      },
      interviewReset: {
        setMicError,
        setMicWarning,
        setResults,
        setAnalysisAttemptId,
        setPendingScoringSyncAttemptId,
        setInterviewLastCommittedAttemptId: wiring.setInterviewLastCommittedAttemptId,
        setHighestScenarioReached,
        setStageResults,
        setTouchedConstructs,
        setExchangeCount,
        setIsWaiting,
        setCurrentTranscript,
        setTypedAnswer,
        setUsedPersonalExamples,
        setPendingCompletion,
        setInterviewUiPhase,
        setReferenceCardScenario,
        setReferenceCardPrompt,
        resetInterviewProgressRefs: boot.resetInterviewProgressRefs,
      },
    },
    postInterviewFeedback,
    submitPostInterviewFeedback: {
      feedbackState: postInterviewFeedback,
      feedbackSetters: postInterviewFeedback,
      analysisAttemptId,
    },
    loadPostInterviewFeedback: {
      interviewStatus,
      analysisAttemptId,
      feedbackSetters: postInterviewFeedback,
    },
    loadPostInterviewFeedbackEffects: {
      userId,
      interviewStatus,
      analysisAttemptId,
    },
  };
}
