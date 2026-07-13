import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewSessionLifecycleStatusSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewStatus: params.interviewStatus,
    interviewAttemptBootstrap: params.interviewAttemptBootstrap,
    onboardingAutoStartRef: params.onboardingAutoStartRef,
    webSpeechShouldDeferToUserGesture: params.webSpeechShouldDeferToUserGesture,
    setWebDesktopAwaitingStartOverlay: params.setWebDesktopAwaitingStartOverlay,
    awaitScreenReadySignal: params.awaitScreenReadySignal,
    logSessionResumeState: params.logSessionResumeState,
    awaitEmotionModalForIndex: params.awaitEmotionModalForIndex,
    notifyScenarioStarted: params.notifyScenarioStarted,
    resetInterviewProgressRefs: params.resetInterviewProgressRefs,
    audioRecorder: params.audioRecorder,
    profile: params.profile,
    hasResumedRef: params.hasResumedRef,
    interviewUserTurnEpochRef: params.interviewUserTurnEpochRef,
    resumeLoadingFlowActiveRef: params.resumeLoadingFlowActiveRef,
    setResumeLoadingVisible: params.setResumeLoadingVisible,
    startInterviewInFlightRef: params.startInterviewInFlightRef,
    setInterviewStartInFlight: params.setInterviewStartInFlight,
  };
}

export function createInterviewSessionLifecycleResumeWelcomeSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    resumeEmotionCatchUpIndicesRef: params.resumeEmotionCatchUpIndicesRef,
    resumeEmotionAfterModalTextRef: params.resumeEmotionAfterModalTextRef,
    resumeOfferWelcomeTtsRef: params.resumeOfferWelcomeTtsRef,
    resumeWelcomeMessageRef: params.resumeWelcomeMessageRef,
    resumeWelcomeHydrationAttemptRef: params.resumeWelcomeHydrationAttemptRef,
    webResumeWelcomeTapHandledRef: params.webResumeWelcomeTapHandledRef,
    webResumeWelcomeTapPendingRef: params.webResumeWelcomeTapPendingRef,
    setWebResumeWelcomeTapPending: params.setWebResumeWelcomeTapPending,
    pendingScenarioIntroAfterResumeWelcomeRef: params.pendingScenarioIntroAfterResumeWelcomeRef,
  };
}

export function createInterviewSessionLifecycleProbeRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    personalHandoffInjectedRef: params.personalHandoffInjectedRef,
    moment4ThresholdProbeAskedRef: params.moment4ThresholdProbeAskedRef,
    deliveredReflectionRegistryRef: params.deliveredReflectionRegistryRef,
    moment4PostGrudgeSpecificityResolvedRef: params.moment4PostGrudgeSpecificityResolvedRef,
    moment4ClientSpecificityProbeInjectedRef: params.moment4ClientSpecificityProbeInjectedRef,
    moment5AccountabilityProbeFiredRef: params.moment5AccountabilityProbeFiredRef,
    moment5SpecificityRedirectIssuedRef: params.moment5SpecificityRedirectIssuedRef,
    moment5ResolutionFollowUpIssuedRef: params.moment5ResolutionFollowUpIssuedRef,
    moment5ResolutionDeliveredRef: params.moment5ResolutionDeliveredRef,
    moment5ConflictValidityClarificationIssuedRef: params.moment5ConflictValidityClarificationIssuedRef,
    moment5QuestionDeliveredRef: params.moment5QuestionDeliveredRef,
    moment5PrimaryAnchorDeliveredSessionRef: params.moment5PrimaryAnchorDeliveredSessionRef,
    moment5PostPromptUserTurnCountRef: params.moment5PostPromptUserTurnCountRef,
    scenarioAContemptProbeAskedRef: params.scenarioAContemptProbeAskedRef,
    scenarioAContemptProbeTtsDeliveredSessionRef: params.scenarioAContemptProbeTtsDeliveredSessionRef,
    scenarioAContemptProbePlaybackConfirmedRef: params.scenarioAContemptProbePlaybackConfirmedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef:
      params.showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioARepairQuestionAskedRef: params.scenarioARepairQuestionAskedRef,
    s2RepairProbeDeliveredRef: params.s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef: params.s3RepairProbeDeliveredRef,
    probeLogRef: params.probeLogRef,
    committedScenarioRef: params.committedScenarioRef,
  };
}

export function createInterviewSessionLifecycleSettersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setHighestScenarioReached: params.setHighestScenarioReached,
    setEmotionItemResponses: params.setEmotionItemResponses,
    setEmotionItemsComplete: params.setEmotionItemsComplete,
    setPendingCompletion: params.setPendingCompletion,
    setInterviewStatus: params.setInterviewStatus,
    setStageResults: params.setStageResults,
    setTouchedConstructs: params.setTouchedConstructs,
    setWebDesktopPendingTtsGestureOverlay: params.setWebDesktopPendingTtsGestureOverlay,
    setStatus: params.setStatus,
    setReferenceCardScenario: params.setReferenceCardScenario,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setInterviewUiPhase: params.setInterviewUiPhase,
    setMicError: params.setMicError,
    setMicPermission: params.setMicPermission,
  };
}

export function createInterviewSessionLifecycleAudioDeviceSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    lastHeadphoneProbeRef: params.lastHeadphoneProbeRef,
    setAudioRouteKind: params.setAudioRouteKind,
    lastAudioRouteFingerprintRef: params.lastAudioRouteFingerprintRef,
    setSessionLogPlatform: params.setSessionLogPlatform,
    setAudioSessionDeviceSnapshot: params.setAudioSessionDeviceSnapshot,
    setLastInterviewDeviceEnvironment: params.setLastInterviewDeviceEnvironment,
    setSessionAudioRoutes: params.setSessionAudioRoutes,
    setSessionAudioHealthNotice: params.setSessionAudioHealthNotice,
  };
}
