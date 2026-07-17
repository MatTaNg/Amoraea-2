import type {
  ResetInterviewProgressRefsDeps,
  ResetScenarioCClientGatesDeps,
} from '@features/aria/interviewProgressResetTypes';
import { clearLiveMoment4ScoringRegistry } from '@features/aria/liveMoment4ScoringOnM5Entry';
import { clearConfusionRepeatOfferPending } from '@features/aria/confusionRepeatOfferState';

export function runResetScenarioCClientGatesOnly(deps: ResetScenarioCClientGatesDeps): void {
  deps.scenarioCRepairOnlyEvidenceRef.current = null;
  deps.scenarioCSophiePerspectiveProbeFiredRef.current = false;
}

export function runResetInterviewProgressRefs(deps: ResetInterviewProgressRefsDeps): void {
  clearLiveMoment4ScoringRegistry();
  clearConfusionRepeatOfferPending();
  deps.resumeRepeatChoicePendingRef.current = false;
  deps.resumeLastAssistantTextRef.current = null;
  deps.resumeRepeatPrefetchMpegRef.current = null;
  deps.resumeClosingRepeatSpeakInFlightRef.current = false;
  deps.interviewNameRef.current = null;
  deps.interviewNameReaskPendingRef.current = false;
  deps.interviewNameReaskUsedRef.current = false;
  deps.interviewMomentsCompleteRef.current = deps.createInitialMomentCompletion();
  deps.currentInterviewMomentRef.current = 1;
  deps.personalHandoffInjectedRef.current = false;
  deps.moment4ThresholdProbeAskedRef.current = false;
  deps.deliveredReflectionRegistryRef.current = [];
  deps.moment4ClientSpecificityProbeInjectedRef.current = false;
  deps.moment4PostGrudgeSpecificityResolvedRef.current = false;
  deps.moment4ExpectingPostSpecificityUserTurnRef.current = false;
  deps.moment4SpecificityScoringRef.current = null;
  deps.moment5QuestionDeliveredRef.current = false;
  deps.moment5QuestionDeliveryInFlightRef.current = false;
  deps.moment5PrimaryAnchorDeliveredSessionRef.current = false;
  deps.moment5PostPromptUserTurnCountRef.current = 0;
  deps.moment5AccountabilityProbeFiredRef.current = false;
  deps.moment5ConflictValidityClarificationIssuedRef.current = false;
  deps.moment5SpecificityRedirectIssuedRef.current = false;
  deps.moment5ResolutionFollowUpIssuedRef.current = false;
  deps.moment5ResolutionDeliveredRef.current = false;
  deps.moment5ClientScoringMetaRef.current = null;
  deps.deferredMoment4NarrativeRef.current = null;
  deps.lastUserTurnAudioDurationMsRef.current = null;
  deps.resetScenarioCClientGatesOnly();
  deps.scenarioAContemptProbeAskedRef.current = false;
  deps.scenarioAContemptProbePlaybackConfirmedRef.current = false;
  deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {};
  deps.scenarioAContemptProbeTtsDeliveredSessionRef.current = false;
  deps.pendingScenarioAContemptProbeStreamMuteRef.current = false;
  deps.pendingS3ToM4HandoffStreamMuteRef.current = false;
  deps.scenarioARepairQuestionAskedRef.current = false;
  deps.s2RepairProbeDeliveredRef.current = false;
  deps.s3RepairProbeDeliveredRef.current = false;
  deps.turnAudioIndexRef.current = 0;
  deps.whisperRatioReaskAttemptsForCurrentQuestionRef.current = 0;
  deps.ttsSessionHardFailureCountRef.current = 0;
  deps.setTtsPlaybackReliabilityNotice(null);
  deps.setConversationErrorNotice?.(null);
  deps.interviewSessionIdRef.current = deps.newInterviewSessionId(deps.userId);
  deps.firstScenarioLifecyclePersistedRef.current = false;
  deps.scoreInterviewAttemptedRef.current = false;
  deps.scoreInterviewInFlightRef.current = false;
  deps.resetCompletionScoringSession();
  deps.resetAudioInterviewTurnCounters();
  deps.resetTtsDurationCalibration();
  if (!deps.hasCachedWebMicTrackSettings()) {
    deps.resetWebAudioRouteSessionFingerprint();
  }
  deps.resetInterviewVadSession();
  deps.resetInterviewClosingTtsSession();
  deps.lastSuccessfulTtsTextNormalizedRef.current = null;
  deps.lastSuccessfulTtsDeliveredPreviewRef.current = '';
  deps.scenarioSkipConfirmedCountRef.current = 0;
  deps.scenarioSkipPenaltySumRef.current = 0;
  deps.consecutiveDigitalSilenceForMicFallbackRef.current = 0;
  deps.micFallbackSuccessPendingRef.current = false;
  deps.elongatingProbeFiredRef.current = false;
  deps.resumeActiveScenarioRef.current = null;
  deps.resumeWelcomeMessageRef.current = deps.resumeWelcomeBackMessage;
  /** Fresh starts deliver the opening greeting — not resume welcome-back TTS (that would block name capture on web). */
  deps.resumeOfferWelcomeTtsRef.current = false;
  deps.resumeEmotionAfterModalTextRef.current = null;
  deps.resumeWelcomeHydrationAttemptRef.current = null;
  deps.clearResumeWelcomePlaybackLock();
  deps.ttsUtteranceInFlightRef.current = null;
  deps.ttsUtteranceInFlightOptionsRef.current = null;
  deps.ttsSpeakGenerationRef.current = 0;
  deps.parallelStreamingTtsRef.current = {
    active: false,
    cancelRequested: false,
    accumulatedFullText: '',
    spokenCompleteText: '',
  };
  deps.pendingScenarioIntroAfterResumeWelcomeRef.current = null;
  deps.transcriptScenarioLogCursorRef.current = 0;
  deps.emotionItemResponsesRef.current = [];
  deps.emotionModalResolveRef.current = null;
  deps.emotionModalPendingTransitionRef.current = false;
  deps.pendingEmotionModalTransitionRef.current = null;
  deps.emotionModalShownForScenarioRef.current = new Set();
  if (deps.emotionModalTimeoutRef.current) {
    clearTimeout(deps.emotionModalTimeoutRef.current);
    deps.emotionModalTimeoutRef.current = null;
  }
  deps.setEmotionModalVisible(false);
  deps.setEmotionModalItemIndex(0);
  deps.setEmotionItemResponses([]);
  deps.setEmotionItemsComplete(false);
}
