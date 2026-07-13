import { describe, expect, it } from '@jest/globals';

import { runResetInterviewProgressRefs } from '@features/aria/runInterviewProgressReset';
import type { ResetInterviewProgressRefsDeps } from '@features/aria/interviewProgressResetTypes';

function makeResetDeps(
  overrides: Partial<ResetInterviewProgressRefsDeps> = {},
): ResetInterviewProgressRefsDeps {
  const base = {
    userId: 'user-1',
    resetScenarioCClientGatesOnly: () => {},
    resumeRepeatChoicePendingRef: { current: false },
    resumeLastAssistantTextRef: { current: null },
    resumeRepeatPrefetchMpegRef: { current: null },
    resumeClosingRepeatSpeakInFlightRef: { current: false },
    interviewNameRef: { current: null },
    interviewNameReaskPendingRef: { current: false },
    interviewNameReaskUsedRef: { current: false },
    interviewMomentsCompleteRef: { current: { 1: false, 2: false, 3: false, 4: false, 5: false } },
    currentInterviewMomentRef: { current: 1 as const },
    personalHandoffInjectedRef: { current: false },
    moment4ThresholdProbeAskedRef: { current: false },
    deliveredReflectionRegistryRef: { current: [] },
    moment4ClientSpecificityProbeInjectedRef: { current: false },
    moment4PostGrudgeSpecificityResolvedRef: { current: false },
    moment4ExpectingPostSpecificityUserTurnRef: { current: false },
    moment4SpecificityScoringRef: { current: null },
    moment5QuestionDeliveredRef: { current: false },
    moment5QuestionDeliveryInFlightRef: { current: false },
    moment5PrimaryAnchorDeliveredSessionRef: { current: false },
    moment5PostPromptUserTurnCountRef: { current: 0 },
    moment5AccountabilityProbeFiredRef: { current: false },
    moment5ConflictValidityClarificationIssuedRef: { current: false },
    moment5SpecificityRedirectIssuedRef: { current: false },
    moment5ResolutionFollowUpIssuedRef: { current: false },
    moment5ResolutionDeliveredRef: { current: false },
    moment5ClientScoringMetaRef: { current: null },
    deferredMoment4NarrativeRef: { current: null },
    lastUserTurnAudioDurationMsRef: { current: null },
    scenarioCRepairOnlyEvidenceRef: { current: null },
    scenarioCSophiePerspectiveProbeFiredRef: { current: false },
    scenarioAContemptProbeAskedRef: { current: false },
    scenarioAContemptProbePlaybackConfirmedRef: { current: false },
    showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: { situation_1: true } },
    scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
    pendingScenarioAContemptProbeStreamMuteRef: { current: false },
    pendingS3ToM4HandoffStreamMuteRef: { current: false },
    scenarioARepairQuestionAskedRef: { current: false },
    s2RepairProbeDeliveredRef: { current: false },
    s3RepairProbeDeliveredRef: { current: false },
    turnAudioIndexRef: { current: 0 },
    whisperRatioReaskAttemptsForCurrentQuestionRef: { current: 0 },
    ttsSessionHardFailureCountRef: { current: 0 },
    setTtsPlaybackReliabilityNotice: () => {},
    setConversationErrorNotice: () => {},
    interviewSessionIdRef: { current: 'session-1' },
    firstScenarioLifecyclePersistedRef: { current: false },
    scoreInterviewAttemptedRef: { current: false },
    scoreInterviewInFlightRef: { current: false },
    resetCompletionScoringSession: () => {},
    resetAudioInterviewTurnCounters: () => {},
    resetTtsDurationCalibration: () => {},
    hasCachedWebMicTrackSettings: () => false,
    resetWebAudioRouteSessionFingerprint: () => {},
    resetInterviewVadSession: () => {},
    resetWebInterviewGestureContext: () => {},
    resetInterviewClosingTtsSession: () => {},
    gestureContextLostAtRef: { current: null },
    lastSuccessfulTtsTextNormalizedRef: { current: null },
    lastSuccessfulTtsDeliveredPreviewRef: { current: '' },
    scenarioSkipConfirmedCountRef: { current: 0 },
    scenarioSkipPenaltySumRef: { current: 0 },
    consecutiveDigitalSilenceForMicFallbackRef: { current: 0 },
    micFallbackSuccessPendingRef: { current: false },
    elongatingProbeFiredRef: { current: false },
    resumeActiveScenarioRef: { current: null },
    resumeWelcomeMessageRef: { current: 'Welcome back' },
    resumeOfferWelcomeTtsRef: { current: true },
    resumeEmotionAfterModalTextRef: { current: null },
    webResumeWelcomeTapHandledRef: { current: false },
    webResumeWelcomeTapPendingRef: { current: false },
    resumeWelcomeHydrationAttemptRef: { current: null },
    clearResumeWelcomePlaybackLock: () => {},
    webTtsUtteranceInFlightRef: { current: null },
    webTtsUtteranceInFlightOptionsRef: { current: null },
    webTtsTabInterruptPendingReplayRef: { current: false },
    webTtsSpeakGenerationRef: { current: 0 },
    webTabRestoreReplayInFlightRef: { current: false },
    parallelStreamingTtsRef: {
      current: {
        active: false,
        cancelRequested: false,
        accumulatedFullText: '',
        spokenCompleteText: '',
      },
    },
    pendingScenarioIntroAfterResumeWelcomeRef: { current: null },
    transcriptScenarioLogCursorRef: { current: 0 },
    emotionItemResponsesRef: { current: [] },
    emotionModalResolveRef: { current: null },
    emotionModalPendingTransitionRef: { current: false },
    pendingEmotionModalTransitionRef: { current: null },
    emotionModalShownForScenarioRef: { current: new Set<number>() },
    emotionModalTimeoutRef: { current: null },
    setEmotionModalVisible: () => {},
    setEmotionModalItemIndex: () => {},
    setEmotionItemResponses: () => {},
    setEmotionItemsComplete: () => {},
    newInterviewSessionId: () => 'session-new',
    resumeWelcomeBackMessage: 'Welcome back',
    createInitialMomentCompletion: () => ({ 1: false, 2: false, 3: false, 4: false, 5: false }),
  } satisfies ResetInterviewProgressRefsDeps;
  return { ...base, ...overrides };
}

describe('runResetInterviewProgressRefs', () => {
  it('clears delivered reflection registry on session reset', () => {
    const deps = makeResetDeps({
      deliveredReflectionRegistryRef: {
        current: [{ slot: 'm4_grudge_to_threshold', text: 'You named your ex.', deliveredAtMs: 1 }],
      },
    });
    runResetInterviewProgressRefs(deps);
    expect(deps.deliveredReflectionRegistryRef.current).toEqual([]);
  });

  it('clears showScenarioCardCanonicalPlaybackConfirmedKindsRef without throwing', () => {
    const deps = makeResetDeps();
    expect(() => runResetInterviewProgressRefs(deps)).not.toThrow();
    expect(deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current).toEqual({});
  });

  it('clears resume welcome TTS offer so fresh opening name capture is not blocked on web', () => {
    const deps = makeResetDeps();
    runResetInterviewProgressRefs(deps);
    expect(deps.resumeOfferWelcomeTtsRef.current).toBe(false);
    expect(deps.webResumeWelcomeTapHandledRef.current).toBe(false);
    expect(deps.webResumeWelcomeTapPendingRef.current).toBe(false);
  });
});
