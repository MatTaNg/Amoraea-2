import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewGateIdentitySyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    userId: params.userId,
    resetScenarioCClientGatesOnly: params.resetScenarioCClientGatesOnly,
    newInterviewSessionId: params.newInterviewSessionId,
    createInitialMomentCompletion: params.createInitialMomentCompletion,
    resumeWelcomeBackMessage: params.resumeWelcomeBackMessage,
    countsAsSubstantiveInterviewQuestionDelivery: params.countsAsSubstantiveInterviewQuestionDelivery,
    stripControlTokens: params.stripControlTokens,
    clearResumeWelcomePlaybackLock: params.clearResumeWelcomePlaybackLock,
    setClosingQuestionState: params.setClosingQuestionState,
    setTtsPlaybackReliabilityNotice: params.setTtsPlaybackReliabilityNotice,
    setConversationErrorNotice: params.setConversationErrorNotice,
  };
}

export function createInterviewGateClosingSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    closingQuestionAskedRef: params.closingQuestionAskedRef,
    closingQuestionAnsweredRef: params.closingQuestionAnsweredRef,
    lastClosingQuestionScenarioRef: params.lastClosingQuestionScenarioRef,
    lastAnsweredClosingScenarioRef: params.lastAnsweredClosingScenarioRef,
    waitingForClosingAdditionRef: params.waitingForClosingAdditionRef,
  };
}

export function createInterviewGateMetaSkipSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    substantiveInterviewQuestionDeliveredSeqRef: params.substantiveInterviewQuestionDeliveredSeqRef,
    metaCommentAckAwaitingSubstantiveBaselineSeqRef: params.metaCommentAckAwaitingSubstantiveBaselineSeqRef,
    metaClassificationForPendingAssistantRef: params.metaClassificationForPendingAssistantRef,
    scenarioFrustrationSkipNullMarkersRef: params.scenarioFrustrationSkipNullMarkersRef,
    frustrationSkipOfferPendingRef: params.frustrationSkipOfferPendingRef,
    frustrationSkipAwaitingConfirmationRef: params.frustrationSkipAwaitingConfirmationRef,
    frustrationSkipHadPriorAnswerRef: params.frustrationSkipHadPriorAnswerRef,
    scenarioSkipOfferSourceRef: params.scenarioSkipOfferSourceRef,
    metaCommentFrustrationCountByMomentRef: params.metaCommentFrustrationCountByMomentRef,
    inabilityCountByMomentRef: params.inabilityCountByMomentRef,
    skipRequestClassificationSeenByMomentRef: params.skipRequestClassificationSeenByMomentRef,
    skipContinuationSystemSuffixRef: params.skipContinuationSystemSuffixRef,
    scenarioSkipConfirmedCountRef: params.scenarioSkipConfirmedCountRef,
    scenarioSkipPenaltySumRef: params.scenarioSkipPenaltySumRef,
    recordInterviewAssistantDeliveryForMetaExemptionRef: params.recordInterviewAssistantDeliveryForMetaExemptionRef,
    finalizePendingMetaAckBaselineAfterAssistantTextRef: params.finalizePendingMetaAckBaselineAfterAssistantTextRef,
    interviewAttemptCreationInFlightRef: params.interviewAttemptCreationInFlightRef,
    recoveryAssistantSpokenAtSubstantiveSeqRef: params.recoveryAssistantSpokenAtSubstantiveSeqRef,
    tryRunEmotionModalFromScenarioTransitionRef: params.tryRunEmotionModalFromScenarioTransitionRef,
    elongatingProbeFiredRef: params.elongatingProbeFiredRef,
  };
}

export function createInterviewGateMomentScenarioSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scenarioCRepairOnlyEvidenceRef: params.scenarioCRepairOnlyEvidenceRef,
    scenarioCSophiePerspectiveProbeFiredRef: params.scenarioCSophiePerspectiveProbeFiredRef,
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    personalHandoffInjectedRef: params.personalHandoffInjectedRef,
    interviewMomentsCompleteRef: params.interviewMomentsCompleteRef,
    interviewNameRef: params.interviewNameRef,
    interviewNameReaskPendingRef: params.interviewNameReaskPendingRef,
    interviewNameReaskUsedRef: params.interviewNameReaskUsedRef,
    moment4ThresholdProbeAskedRef: params.moment4ThresholdProbeAskedRef,
    deliveredReflectionRegistryRef: params.deliveredReflectionRegistryRef,
    moment4ClientSpecificityProbeInjectedRef: params.moment4ClientSpecificityProbeInjectedRef,
    moment4PostGrudgeSpecificityResolvedRef: params.moment4PostGrudgeSpecificityResolvedRef,
    moment4ExpectingPostSpecificityUserTurnRef: params.moment4ExpectingPostSpecificityUserTurnRef,
    moment4SpecificityScoringRef: params.moment4SpecificityScoringRef,
    deferredMoment4NarrativeRef: params.deferredMoment4NarrativeRef,
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
    lastUserTurnAudioDurationMsRef: params.lastUserTurnAudioDurationMsRef,
    responseTimingsRef: params.responseTimingsRef,
    routeChangedDuringRecordingRef: params.routeChangedDuringRecordingRef,
  };
}

export function createInterviewGateWebTtsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    whisperRatioReaskAttemptsForCurrentQuestionRef: params.whisperRatioReaskAttemptsForCurrentQuestionRef,
    ttsSessionHardFailureCountRef: params.ttsSessionHardFailureCountRef,
    lastSuccessfulTtsTextNormalizedRef: params.lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef: params.lastSuccessfulTtsDeliveredPreviewRef,
    ttsUtteranceInFlightRef: params.ttsUtteranceInFlightRef,
    ttsUtteranceInFlightOptionsRef: params.ttsUtteranceInFlightOptionsRef,
    ttsSpeakGenerationRef: params.ttsSpeakGenerationRef,
    parallelStreamingTtsRef: params.parallelStreamingTtsRef,
    webTabRestoreTapSessionRef: params.webTabRestoreTapSessionRef,
    webTabRestoreDeliveredNormRef: params.webTabRestoreDeliveredNormRef,
    tabRestoreInFlightWithoutPlaybackSinceMsRef: params.tabRestoreInFlightWithoutPlaybackSinceMsRef,
    lastHeadphoneProbeRef: params.lastHeadphoneProbeRef,
    lastAudioRouteFingerprintRef: params.lastAudioRouteFingerprintRef,
  };
}

export function createInterviewGateResumeEmotionSyncSlice(params: SyncExtraParams): SyncExtraParams {
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
    transcriptScenarioLogCursorRef: params.transcriptScenarioLogCursorRef,
    resumeLoadingFlowActiveRef: params.resumeLoadingFlowActiveRef,
    interviewUserTurnEpochRef: params.interviewUserTurnEpochRef,
  };
}

export function createInterviewGateProgressResetSyncSlice(params: SyncExtraParams): SyncExtraParams {
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
