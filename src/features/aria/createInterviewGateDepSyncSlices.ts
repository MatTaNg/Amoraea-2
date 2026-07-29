import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewClosingQuestionActionsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    closingQuestionAskedRef: params.closingQuestionAskedRef,
    closingQuestionAnsweredRef: params.closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef: params.lastClosingQuestionScenarioRef,
    lastAnsweredClosingScenarioRef: params.lastAnsweredClosingScenarioRef,
    setClosingQuestionState: params.setClosingQuestionState,
  };
}

export function createInterviewAssistantMetaExemptionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    substantiveInterviewQuestionDeliveredSeqRef: params.substantiveInterviewQuestionDeliveredSeqRef,
    metaCommentAckAwaitingSubstantiveBaselineSeqRef: params.metaCommentAckAwaitingSubstantiveBaselineSeqRef,
    metaClassificationForPendingAssistantRef: params.metaClassificationForPendingAssistantRef,
    recoveryAssistantSpokenAtSubstantiveSeqRef: params.recoveryAssistantSpokenAtSubstantiveSeqRef,
    countsAsSubstantiveInterviewQuestionDelivery: params.countsAsSubstantiveInterviewQuestionDelivery,
    stripControlTokens: params.stripControlTokens,
  };
}

export function createInterviewResetInterviewProgressIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    resetScenarioCClientGatesOnly: params.resetScenarioCClientGatesOnly,
    newInterviewSessionId: params.newInterviewSessionId,
    resumeWelcomeBackMessage: params.resumeWelcomeBackMessage,
    createInitialMomentCompletion: params.createInitialMomentCompletion,
    clearResumeWelcomePlaybackLock: params.clearResumeWelcomePlaybackLock,
    setTtsPlaybackReliabilityNotice: params.setTtsPlaybackReliabilityNotice,
    setConversationErrorNotice: params.setConversationErrorNotice,
  };
}

export function createInterviewResetInterviewProgressMomentsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scenarioCRepairOnlyEvidenceRef: params.scenarioCRepairOnlyEvidenceRef,
    scenarioCSophiePerspectiveProbeFiredRef: params.scenarioCSophiePerspectiveProbeFiredRef,
    interviewNameRef: params.interviewNameRef,
    interviewNameReaskPendingRef: params.interviewNameReaskPendingRef,
    interviewNameReaskUsedRef: params.interviewNameReaskUsedRef,
    interviewMomentsCompleteRef: params.interviewMomentsCompleteRef,
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    personalHandoffInjectedRef: params.personalHandoffInjectedRef,
    moment4ThresholdProbeAskedRef: params.moment4ThresholdProbeAskedRef,
    deliveredReflectionRegistryRef: params.deliveredReflectionRegistryRef,
    moment4ClientSpecificityProbeInjectedRef: params.moment4ClientSpecificityProbeInjectedRef,
    moment4PostGrudgeSpecificityResolvedRef: params.moment4PostGrudgeSpecificityResolvedRef,
    moment4ExpectingPostSpecificityUserTurnRef: params.moment4ExpectingPostSpecificityUserTurnRef,
    moment4SpecificityScoringRef: params.moment4SpecificityScoringRef,
    moment5QuestionDeliveredRef: params.moment5QuestionDeliveredRef,
    moment5QuestionDeliveryInFlightRef: params.moment5QuestionDeliveryInFlightRef,
    moment5PrimaryAnchorDeliveredSessionRef: params.moment5PrimaryAnchorDeliveredSessionRef,
    moment5PostPromptUserTurnCountRef: params.moment5PostPromptUserTurnCountRef,
    moment5AccountabilityProbeFiredRef: params.moment5AccountabilityProbeFiredRef,
    moment5ConflictValidityClarificationIssuedRef: params.moment5ConflictValidityClarificationIssuedRef,
    moment5SpecificityRedirectIssuedRef: params.moment5SpecificityRedirectIssuedRef,
    moment5ResolutionFollowUpIssuedRef: params.moment5ResolutionFollowUpIssuedRef,
    moment5ResolutionDeliveredRef: params.moment5ResolutionDeliveredRef,
    moment5ClientScoringMetaRef: params.moment5ClientScoringMetaRef,
    deferredMoment4NarrativeRef: params.deferredMoment4NarrativeRef,
    lastUserTurnAudioDurationMsRef: params.lastUserTurnAudioDurationMsRef,
    scenarioAContemptProbeAskedRef: params.scenarioAContemptProbeAskedRef,
    scenarioAContemptProbePlaybackConfirmedRef: params.scenarioAContemptProbePlaybackConfirmedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef:
      params.showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioAContemptProbeTtsDeliveredSessionRef: params.scenarioAContemptProbeTtsDeliveredSessionRef,
    pendingScenarioAContemptProbeStreamMuteRef: params.pendingScenarioAContemptProbeStreamMuteRef,
    pendingS3ToM4HandoffStreamMuteRef: params.pendingS3ToM4HandoffStreamMuteRef,
    scenarioARepairQuestionAskedRef: params.scenarioARepairQuestionAskedRef,
    s2RepairProbeDeliveredRef: params.s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef: params.s3RepairProbeDeliveredRef,
    turnAudioIndexRef: params.turnAudioIndexRef,
  };
}

export function createInterviewResetInterviewProgressWebTtsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    whisperRatioReaskAttemptsForCurrentQuestionRef: params.whisperRatioReaskAttemptsForCurrentQuestionRef,
    ttsSessionHardFailureCountRef: params.ttsSessionHardFailureCountRef,
    lastSuccessfulTtsTextNormalizedRef: params.lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef: params.lastSuccessfulTtsDeliveredPreviewRef,
    ttsUtteranceInFlightRef: params.ttsUtteranceInFlightRef,
    ttsUtteranceInFlightOptionsRef: params.ttsUtteranceInFlightOptionsRef,
    ttsSpeakGenerationRef: params.ttsSpeakGenerationRef,
    parallelStreamingTtsRef: params.parallelStreamingTtsRef,
  };
}

export function createInterviewResetInterviewProgressResumeEmotionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    resumeRepeatChoicePendingRef: params.resumeRepeatChoicePendingRef,
    resumeLastAssistantTextRef: params.resumeLastAssistantTextRef,
    resumeRepeatPrefetchMpegRef: params.resumeRepeatPrefetchMpegRef,
    resumeClosingRepeatSpeakInFlightRef: params.resumeClosingRepeatSpeakInFlightRef,
    resumeActiveScenarioRef: params.resumeActiveScenarioRef,
    resumeWelcomeMessageRef: params.resumeWelcomeMessageRef,
    resumeOfferWelcomeTtsRef: params.resumeOfferWelcomeTtsRef,
    resumeInPersonalPartRef: params.resumeInPersonalPartRef,
    resumeEmotionAfterModalTextRef: params.resumeEmotionAfterModalTextRef,
    resumeWelcomeHydrationAttemptRef: params.resumeWelcomeHydrationAttemptRef,
    pendingScenarioIntroAfterResumeWelcomeRef: params.pendingScenarioIntroAfterResumeWelcomeRef,
    transcriptScenarioLogCursorRef: params.transcriptScenarioLogCursorRef,
    emotionItemResponsesRef: params.emotionItemResponsesRef,
    emotionModalResolveRef: params.emotionModalResolveRef,
    emotionModalPendingTransitionRef: params.emotionModalPendingTransitionRef,
    pendingEmotionModalTransitionRef: params.pendingEmotionModalTransitionRef,
    emotionModalShownForScenarioRef: params.emotionModalShownForScenarioRef,
    emotionModalTimeoutRef: params.emotionModalTimeoutRef,
    setEmotionModalVisible: params.setEmotionModalVisible,
    setEmotionModalItemIndex: params.setEmotionModalItemIndex,
    setEmotionItemResponses: params.setEmotionItemResponses,
    setEmotionItemsComplete: params.setEmotionItemsComplete,
  };
}

export function createInterviewResetInterviewProgressMetaSkipSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    elongatingProbeFiredRef: params.elongatingProbeFiredRef,
    scenarioSkipConfirmedCountRef: params.scenarioSkipConfirmedCountRef,
    scenarioSkipPenaltySumRef: params.scenarioSkipPenaltySumRef,
  };
}

export function createInterviewResetInterviewProgressSessionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    interviewSessionIdRef: params.interviewSessionIdRef,
    firstScenarioLifecyclePersistedRef: params.firstScenarioLifecyclePersistedRef,
    scoreInterviewAttemptedRef: params.scoreInterviewAttemptedRef,
    scoreInterviewInFlightRef: params.scoreInterviewInFlightRef,
    resetCompletionScoringSession: params.resetCompletionScoringSession,
    resetAudioInterviewTurnCounters: params.resetAudioInterviewTurnCounters,
    resetTtsDurationCalibration: params.resetTtsDurationCalibration,
    hasCachedWebMicTrackSettings: params.hasCachedWebMicTrackSettings,
    resetWebAudioRouteSessionFingerprint: params.resetWebAudioRouteSessionFingerprint,
    resetInterviewVadSession: params.resetInterviewVadSession,
    resetWebInterviewGestureContext: params.resetWebInterviewGestureContext,
    resetInterviewClosingTtsSession: params.resetInterviewClosingTtsSession,
    consecutiveDigitalSilenceForMicFallbackRef: params.consecutiveDigitalSilenceForMicFallbackRef,
    micFallbackSuccessPendingRef: params.micFallbackSuccessPendingRef,
  };
}
