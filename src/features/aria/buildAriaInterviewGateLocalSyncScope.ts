import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type {
  AriaInterviewGateSyncScope,
  AriaInterviewGateWebTtsSyncScope,
} from '@features/aria/ariaInterviewGateSyncScopeTypes';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type AriaInterviewGateIdentityLocalScope = Pick<
  SyncExtraParams,
  | 'userId'
  | 'resetScenarioCClientGatesOnly'
  | 'newInterviewSessionId'
  | 'createInitialMomentCompletion'
  | 'resumeWelcomeBackMessage'
  | 'countsAsSubstantiveInterviewQuestionDelivery'
  | 'stripControlTokens'
  | 'clearResumeWelcomePlaybackLock'
  | 'setClosingQuestionState'
  | 'setTtsPlaybackReliabilityNotice'
  | 'setConversationErrorNotice'
>;

export type AriaInterviewGateMetaSkipLocalScope = Pick<
  SyncExtraParams,
  | 'substantiveInterviewQuestionDeliveredSeqRef'
  | 'metaCommentAckAwaitingSubstantiveBaselineSeqRef'
  | 'metaClassificationForPendingAssistantRef'
  | 'scenarioFrustrationSkipNullMarkersRef'
  | 'frustrationSkipOfferPendingRef'
  | 'frustrationSkipAwaitingConfirmationRef'
  | 'frustrationSkipHadPriorAnswerRef'
  | 'scenarioSkipOfferSourceRef'
  | 'metaCommentFrustrationCountByMomentRef'
  | 'inabilityCountByMomentRef'
  | 'skipRequestClassificationSeenByMomentRef'
  | 'skipContinuationSystemSuffixRef'
  | 'scenarioSkipConfirmedCountRef'
  | 'scenarioSkipPenaltySumRef'
  | 'recordInterviewAssistantDeliveryForMetaExemptionRef'
  | 'finalizePendingMetaAckBaselineAfterAssistantTextRef'
  | 'interviewAttemptCreationInFlightRef'
  | 'recoveryAssistantSpokenAtSubstantiveSeqRef'
  | 'tryRunEmotionModalFromScenarioTransitionRef'
  | 'elongatingProbeFiredRef'
>;

export type AriaInterviewGateMomentsLocalScope = Pick<
  SyncExtraParams,
  | 'scenarioCRepairOnlyEvidenceRef'
  | 'scenarioCSophiePerspectiveProbeFiredRef'
  | 'currentInterviewMomentRef'
  | 'personalHandoffInjectedRef'
  | 'interviewMomentsCompleteRef'
  | 'interviewNameRef'
  | 'interviewNameReaskPendingRef'
  | 'interviewNameReaskUsedRef'
  | 'moment4ThresholdProbeAskedRef'
  | 'deliveredReflectionRegistryRef'
  | 'moment4ClientSpecificityProbeInjectedRef'
  | 'moment4PostGrudgeSpecificityResolvedRef'
  | 'moment4ExpectingPostSpecificityUserTurnRef'
  | 'moment4SpecificityScoringRef'
  | 'deferredMoment4NarrativeRef'
  | 'moment5QuestionDeliveredRef'
  | 'moment5QuestionDeliveryInFlightRef'
  | 'moment5PrimaryAnchorDeliveredSessionRef'
  | 'moment5PostPromptUserTurnCountRef'
  | 'moment5AccountabilityProbeFiredRef'
  | 'moment5ConflictValidityClarificationIssuedRef'
  | 'moment5SpecificityRedirectIssuedRef'
  | 'moment5ResolutionFollowUpIssuedRef'
  | 'moment5ResolutionDeliveredRef'
  | 'moment5ClientScoringMetaRef'
  | 'scenarioAContemptProbeAskedRef'
  | 'scenarioAContemptProbePlaybackConfirmedRef'
  | 'showScenarioCardCanonicalPlaybackConfirmedKindsRef'
  | 'scenarioAContemptProbeTtsDeliveredSessionRef'
  | 'pendingScenarioAContemptProbeStreamMuteRef'
  | 'pendingS3ToM4HandoffStreamMuteRef'
  | 'scenarioARepairQuestionAskedRef'
  | 's2RepairProbeDeliveredRef'
  | 's3RepairProbeDeliveredRef'
  | 'turnAudioIndexRef'
  | 'lastUserTurnAudioDurationMsRef'
  | 'lastUserTurnMicStopTelemetryRef'
  | 'responseTimingsRef'
  | 'routeChangedDuringRecordingRef'
>;

export type AriaInterviewGateWebTtsLocalScope = AriaInterviewGateWebTtsSyncScope;

export type AriaInterviewGateResumeEmotionLocalScope = Pick<
  SyncExtraParams,
  | 'resumeRepeatChoicePendingRef'
  | 'resumeLastAssistantTextRef'
  | 'resumeRepeatPrefetchMpegRef'
  | 'resumeClosingRepeatSpeakInFlightRef'
  | 'resumeActiveScenarioRef'
  | 'resumeWelcomeMessageRef'
  | 'resumeOfferWelcomeTtsRef'
  | 'resumeInPersonalPartRef'
  | 'resumeEmotionAfterModalTextRef'
  | 'resumeWelcomeHydrationAttemptRef'
  | 'pendingScenarioIntroAfterResumeWelcomeRef'
  | 'emotionItemResponsesRef'
  | 'emotionModalResolveRef'
  | 'emotionModalPendingTransitionRef'
  | 'pendingEmotionModalTransitionRef'
  | 'emotionModalShownForScenarioRef'
  | 'emotionModalTimeoutRef'
  | 'setEmotionModalVisible'
  | 'setEmotionModalItemIndex'
  | 'setEmotionItemResponses'
  | 'setEmotionItemsComplete'
  | 'transcriptScenarioLogCursorRef'
  | 'resumeLoadingFlowActiveRef'
  | 'interviewUserTurnEpochRef'
>;

export type AriaInterviewGateProgressResetLocalScope = Pick<
  SyncExtraParams,
  | 'interviewSessionIdRef'
  | 'firstScenarioLifecyclePersistedRef'
  | 'scoreInterviewAttemptedRef'
  | 'scoreInterviewInFlightRef'
  | 'resetCompletionScoringSession'
  | 'resetAudioInterviewTurnCounters'
  | 'resetTtsDurationCalibration'
  | 'hasCachedWebMicTrackSettings'
  | 'resetWebAudioRouteSessionFingerprint'
  | 'resetInterviewVadSession'
  | 'resetWebInterviewGestureContext'
  | 'resetInterviewClosingTtsSession'
  | 'consecutiveDigitalSilenceForMicFallbackRef'
  | 'micFallbackSuccessPendingRef'
>;

export type AriaInterviewGateLocalSyncScope = AriaInterviewGateSyncScope;

export function buildAriaInterviewGateIdentityLocalScope(
  scope: AriaInterviewGateIdentityLocalScope,
): SyncExtraParams {
  return scope;
}

export function buildAriaInterviewGateMetaSkipLocalScope(scope: AriaInterviewGateMetaSkipLocalScope): SyncExtraParams {
  return scope;
}

export function buildAriaInterviewGateMomentsLocalScope(scope: AriaInterviewGateMomentsLocalScope): SyncExtraParams {
  return scope;
}

export function buildAriaInterviewGateWebTtsLocalScope(
  scope: AriaInterviewGateWebTtsLocalScope,
): AriaInterviewGateWebTtsSyncScope {
  return scope;
}

export function buildAriaInterviewGateResumeEmotionLocalScope(
  scope: AriaInterviewGateResumeEmotionLocalScope,
): SyncExtraParams {
  return scope;
}

export function buildAriaInterviewGateProgressResetLocalScope(
  scope: AriaInterviewGateProgressResetLocalScope,
): SyncExtraParams {
  return scope;
}

/** Assemble grouped gate local scopes for `buildAriaInterviewGateSyncCtx`. */
export function buildAriaInterviewGateLocalSyncScope(scope: AriaInterviewGateLocalSyncScope): AriaInterviewGateSyncScope {
  return scope;
}
