import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewTurnHandlerStatusSettersSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    status: params.status,
    setInterviewStatus: params.setInterviewStatus,
    setPendingCompletion: params.setPendingCompletion,
    setIsWaiting: params.setIsWaiting,
    setPendingScoringSyncAttemptId: params.setPendingScoringSyncAttemptId,
    setCurrentTranscript: params.setCurrentTranscript,
    setExchangeCount: params.setExchangeCount,
  };
}

export function createInterviewTurnHandlerEmotionModalSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    awaitEmotionModalForIndex: params.awaitEmotionModalForIndex,
    listUnansweredEmotionModalIndices: params.listUnansweredEmotionModalIndices,
    runEmotionModalAfterScenarioTransition: params.runEmotionModalAfterScenarioTransition,
    tryRunEmotionModalFromScenarioTransitionRef: params.tryRunEmotionModalFromScenarioTransitionRef,
    pendingEmotionModalTransitionRef: params.pendingEmotionModalTransitionRef,
  };
}

export function createInterviewTurnHandlerWebTabRestoreSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    webTabRestoreReplayInFlightRef: params.webTabRestoreReplayInFlightRef,
    webTabRestoreTapSessionRef: params.webTabRestoreTapSessionRef,
    webTabRestoreDeliveredNormRef: params.webTabRestoreDeliveredNormRef,
    tabRestoreInFlightWithoutPlaybackSinceMsRef: params.tabRestoreInFlightWithoutPlaybackSinceMsRef,
    clearStaleWebInterviewTtsRuntimeLocks: params.clearStaleWebInterviewTtsRuntimeLocks,
    queueMobileWebHtmlResumeAfterScreenReturn: params.queueMobileWebHtmlResumeAfterScreenReturn,
  };
}

export function createInterviewTurnHandlerScenarioScoringSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    kickCompletionScoring: params.kickCompletionScoring,
    scoreScenario: params.scoreScenario,
    notifyScenarioStarted: params.notifyScenarioStarted,
    ensureCompletedScenarioScored: params.ensureCompletedScenarioScored,
    scoreScenarioRef: params.scoreScenarioRef,
    fetchStageScore: params.fetchStageScore,
    saveScenarioCheckpoint: params.saveScenarioCheckpoint,
    resetScenarioCClientGatesOnly: params.resetScenarioCClientGatesOnly,
    scoreInterviewAttemptedRef: params.scoreInterviewAttemptedRef,
  };
}

export function createInterviewTurnHandlerClosingQuestionSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setClosingQuestionPending: params.setClosingQuestionPending,
    setClosingQuestionScenario: params.setClosingQuestionScenario,
    markClosingQuestionAsked: params.markClosingQuestionAsked,
    markClosingQuestionAnswered: params.markClosingQuestionAnswered,
    closingQuestionPending: params.closingQuestionPending,
    closingQuestionScenario: params.closingQuestionScenario,
    closingQuestionAnsweredRef: params.closingQuestionAnsweredRef,
    closingQuestionAskedRef: params.closingQuestionAskedRef,
    lastAnsweredClosingScenarioRef: params.lastAnsweredClosingScenarioRef,
    lastClosingQuestionScenarioRef: params.lastClosingQuestionScenarioRef,
    waitingForClosingAdditionRef: params.waitingForClosingAdditionRef,
    resumeClosingRepeatSpeakInFlightRef: params.resumeClosingRepeatSpeakInFlightRef,
  };
}

export function createInterviewTurnHandlerProgressPersistenceSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    commitInterviewMessages: params.commitInterviewMessages,
    loadInterviewFromStorage: params.loadInterviewFromStorage,
    saveInterviewToStorage: params.saveInterviewToStorage,
    saveInterviewProgress: params.saveInterviewProgress,
    markPreparingResultsSession: params.markPreparingResultsSession,
    persistInterviewAttemptSessionLifecycle: params.persistInterviewAttemptSessionLifecycle,
    applyInterviewProgressFromAssistantText: params.applyInterviewProgressFromAssistantText,
    insertPreambleBriefingIfMissing: params.insertPreambleBriefingIfMissing,
  };
}

export function createInterviewTurnHandlerUiStageSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setWebTabGestureRestoreOverlay: params.setWebTabGestureRestoreOverlay,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setHighestScenarioReached: params.setHighestScenarioReached,
    setStageResults: params.setStageResults,
    kickPostClosingInterviewCompletionIfReady: params.kickPostClosingInterviewCompletionIfReady,
  };
}

export function createInterviewTurnHandlerAssistantProcessingSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    applyInterviewSpeechComplete: params.applyInterviewSpeechComplete,
    resolveAssistantScenarioNumber: params.resolveAssistantScenarioNumber,
    finalizePendingMetaAckBaselineAfterAssistantTextRef: params.finalizePendingMetaAckBaselineAfterAssistantTextRef,
    metaClassificationForPendingAssistantRef: params.metaClassificationForPendingAssistantRef,
    showChatError: params.showChatError,
    messages: params.messages,
    usedPersonalExamples: params.usedPersonalExamples,
  };
}

export function createInterviewTurnHandlerMomentProbeRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scenarioCRepairOnlyEvidenceRef: params.scenarioCRepairOnlyEvidenceRef,
    scenarioCSophiePerspectiveProbeFiredRef: params.scenarioCSophiePerspectiveProbeFiredRef,
    elongatingProbeFiredRef: params.elongatingProbeFiredRef,
    moment4ClientSpecificityProbeInjectedRef: params.moment4ClientSpecificityProbeInjectedRef,
    moment4ThresholdProbeAskedRef: params.moment4ThresholdProbeAskedRef,
    deliveredReflectionRegistryRef: params.deliveredReflectionRegistryRef,
    moment4ExpectingPostSpecificityUserTurnRef: params.moment4ExpectingPostSpecificityUserTurnRef,
    moment4PostGrudgeSpecificityResolvedRef: params.moment4PostGrudgeSpecificityResolvedRef,
    moment4SpecificityScoringRef: params.moment4SpecificityScoringRef,
    moment5AccountabilityProbeFiredRef: params.moment5AccountabilityProbeFiredRef,
    moment5ClientScoringMetaRef: params.moment5ClientScoringMetaRef,
    moment5ConflictValidityClarificationIssuedRef: params.moment5ConflictValidityClarificationIssuedRef,
    moment5PostPromptUserTurnCountRef: params.moment5PostPromptUserTurnCountRef,
    moment5PrimaryAnchorDeliveredSessionRef: params.moment5PrimaryAnchorDeliveredSessionRef,
    moment5QuestionDeliveredRef: params.moment5QuestionDeliveredRef,
    moment5QuestionDeliveryInFlightRef: params.moment5QuestionDeliveryInFlightRef,
    moment5SpecificityRedirectIssuedRef: params.moment5SpecificityRedirectIssuedRef,
    moment5ResolutionFollowUpIssuedRef: params.moment5ResolutionFollowUpIssuedRef,
    moment5ResolutionDeliveredRef: params.moment5ResolutionDeliveredRef,
    personalHandoffInjectedRef: params.personalHandoffInjectedRef,
    scenarioAContemptProbeAskedRef: params.scenarioAContemptProbeAskedRef,
    scenarioAContemptProbePlaybackConfirmedRef: params.scenarioAContemptProbePlaybackConfirmedRef,
    scenarioAContemptProbeTtsDeliveredSessionRef: params.scenarioAContemptProbeTtsDeliveredSessionRef,
    scenarioARepairQuestionAskedRef: params.scenarioARepairQuestionAskedRef,
    s2RepairProbeDeliveredRef: params.s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef: params.s3RepairProbeDeliveredRef,
    pendingScenarioAContemptProbeStreamMuteRef: params.pendingScenarioAContemptProbeStreamMuteRef,
    pendingS3ToM4HandoffStreamMuteRef: params.pendingS3ToM4HandoffStreamMuteRef,
    recordInterviewAssistantDeliveryForMetaExemptionRef: params.recordInterviewAssistantDeliveryForMetaExemptionRef,
  };
}

export function createInterviewTurnHandlerMetaSkipRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
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
  };
}

export function createInterviewTurnHandlerSessionBootstrapSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    createInterviewAttemptOnFirstSubstantiveResponse: params.createInterviewAttemptOnFirstSubstantiveResponse,
    collectDeviceContext: params.collectDeviceContext,
    resetSessionLogRuntime: params.resetSessionLogRuntime,
    assignAttemptIdForSessionLogs: params.assignAttemptIdForSessionLogs,
    markAiProcessingTurnStarted: params.markAiProcessingTurnStarted,
    interviewAttemptCreationInFlightRef: params.interviewAttemptCreationInFlightRef,
    interviewNameReaskUsedRef: params.interviewNameReaskUsedRef,
  };
}

export function createInterviewTurnHandlerMiscRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    routeChangedDuringRecordingRef: params.routeChangedDuringRecordingRef,
    responseTimingsRef: params.responseTimingsRef,
  };
}
