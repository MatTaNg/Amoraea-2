import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createInterviewTtsPipelineWebUiSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    mobileWebTapToBeginDone: params.mobileWebTapToBeginDone,
    setWebTabGestureRestoreOverlay: params.setWebTabGestureRestoreOverlay,
    setWebDesktopPendingTtsGestureOverlay: params.setWebDesktopPendingTtsGestureOverlay,
    setTtsPlaybackReliabilityNotice: params.setTtsPlaybackReliabilityNotice,
    setLastTtsCompletionCallbackMs: params.setLastTtsCompletionCallbackMs,
    webSpeechShouldDeferToUserGesture: params.webSpeechShouldDeferToUserGesture,
  };
}

export function createInterviewTtsPipelinePlaybackSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    speak: params.speak,
    applyInterviewSpeechComplete: params.applyInterviewSpeechComplete,
    awaitTtsScreenReadyGate: params.awaitTtsScreenReadyGate,
    stopElevenLabsPlayback: params.stopElevenLabsPlayback,
    prepareInterviewTtsPlayback: params.prepareInterviewTtsPlayback,
    rearmWebMicPreInitAfterTtsPlaybackComplete: params.rearmWebMicPreInitAfterTtsPlaybackComplete,
    scheduleWebMicPreInitRefreshAfterTtsCompletes: params.scheduleWebMicPreInitRefreshAfterTtsCompletes,
    referenceCardShouldUpdateOnPlaybackStart: params.referenceCardShouldUpdateOnPlaybackStart,
    persistInterviewAttemptSessionLifecycle: params.persistInterviewAttemptSessionLifecycle,
    setReferenceCardPrompt: params.setReferenceCardPrompt,
    setReferenceCardScenario: params.setReferenceCardScenario,
    setInterviewUiPhase: params.setInterviewUiPhase,
  };
}

export function createInterviewTtsPipelineDeliveryRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    s2RepairProbeDeliveredRef: params.s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef: params.s3RepairProbeDeliveredRef,
    lastSuccessfulTtsDeliveredPreviewRef: params.lastSuccessfulTtsDeliveredPreviewRef,
    scenarioAContemptProbePlaybackConfirmedRef: params.scenarioAContemptProbePlaybackConfirmedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef:
      params.showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioAContemptProbeTtsDeliveredSessionRef: params.scenarioAContemptProbeTtsDeliveredSessionRef,
    applyReferenceCardFromAssistantSpeechRef: params.applyReferenceCardFromAssistantSpeechRef,
    firstScenarioLifecyclePersistedRef: params.firstScenarioLifecyclePersistedRef,
    ttsSessionHardFailureCountRef: params.ttsSessionHardFailureCountRef,
    recordInterviewAssistantDeliveryForMetaExemptionRef: params.recordInterviewAssistantDeliveryForMetaExemptionRef,
  };
}

export function createInterviewTtsPipelineScenarioProbeRefsSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    s1ContemptFixVersion: params.s1ContemptFixVersion,
    pendingScenarioAContemptProbeStreamMuteRef: params.pendingScenarioAContemptProbeStreamMuteRef,
    pendingS3ToM4HandoffStreamMuteRef: params.pendingS3ToM4HandoffStreamMuteRef,
    scenarioAContemptProbeAskedRef: params.scenarioAContemptProbeAskedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef:
      params.showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioARepairQuestionAskedRef: params.scenarioARepairQuestionAskedRef,
    moment5PostPromptUserTurnCountRef: params.moment5PostPromptUserTurnCountRef,
    moment5AccountabilityProbeFiredRef: params.moment5AccountabilityProbeFiredRef,
    moment5ClientScoringMetaRef: params.moment5ClientScoringMetaRef,
    moment4ClientSpecificityProbeInjectedRef: params.moment4ClientSpecificityProbeInjectedRef,
    moment5SpecificityRedirectIssuedRef: params.moment5SpecificityRedirectIssuedRef,
    elongatingProbeFiredRef: params.elongatingProbeFiredRef,
  };
}
