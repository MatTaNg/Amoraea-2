import type { ScrollView } from 'react-native';

import { type ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { PendingEmotionModalTransition } from '@features/aria/emotionRecognitionInterview';
import type { useAriaInterviewClosingQuestionState } from '@features/aria/hooks/useAriaInterviewClosingQuestionState';
import type { useAriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { createInitialMomentCompletion } from '@features/aria/interviewProgressSync';
import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { InterviewMomentIndex } from '@features/aria/interviewScenarioScoringSlice';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { Moment5ClientScoringMetadata } from '@features/aria/moment5AccountabilityScoringPrompt';
import type { Moment4ClientScoringMetadata } from '@features/aria/personalMomentScoringPrompt';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';

export type InterviewUiPhase = 'pre_scenario' | 'scenario_transitioning' | 'scenario_active';

export type ReasoningProgress =
  | 'generating'
  | 'slow'
  | 'very_slow'
  | 'done'
  | 'pending'
  | 'failed'
  | null;

export type WebTtsUtteranceReplayOptions = {
  interviewSpeechRole?: 'assistant_response';
  telemetrySource?: TtsTelemetrySource;
  skipInterviewSpeechAdvance?: boolean;
  skipQuestionDeliveredTelemetry?: boolean;
  skipLastQuestionRef?: boolean;
  allowDuplicateConsecutiveTts?: boolean;
  skipClosingSessionDedup?: boolean;
  silent?: boolean;
  skipGestureGate?: boolean;
  ttsTriggerSource?:
    | 'gesture_handler'
    | 'effect'
    | 'callback'
    | 'timeout'
    | 'preauthorized_element';
};

export type UseAriaInterviewScreenSessionStateParams = {
  userId: string;
  routeName?: string;
  fromValidationTrack: boolean;
  status: InterviewSessionStatus;
  setMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string; scenarioNumber?: number }[]>>;
};

export type AriaInterviewScreenSessionGateState = {
  resetScenarioCClientGates: {
    scenarioCRepairOnlyEvidenceRef: React.MutableRefObject<string | null>;
    scenarioCSophiePerspectiveProbeFiredRef: React.MutableRefObject<boolean>;
  };
  metaSkip: {
    substantiveInterviewQuestionDeliveredSeqRef: React.MutableRefObject<number>;
    metaCommentAckAwaitingSubstantiveBaselineSeqRef: React.MutableRefObject<number | null>;
    metaClassificationForPendingAssistantRef: React.MutableRefObject<MetaCommentClassification | null>;
    scenarioFrustrationSkipNullMarkersRef: React.MutableRefObject<Partial<Record<1 | 2 | 3, boolean>>>;
    frustrationSkipOfferPendingRef: React.MutableRefObject<boolean>;
    frustrationSkipAwaitingConfirmationRef: React.MutableRefObject<boolean>;
    frustrationSkipHadPriorAnswerRef: React.MutableRefObject<boolean | null>;
    scenarioSkipOfferSourceRef: React.MutableRefObject<
      | 'frustration_meta'
      | 'proactive_utterance'
      | 'skip_request_meta'
      | 'inability_escalation'
      | 'already_answered_meta'
      | null
    >;
    metaCommentFrustrationCountByMomentRef: React.MutableRefObject<Record<number, number>>;
    inabilityCountByMomentRef: React.MutableRefObject<Record<number, number>>;
    skipRequestClassificationSeenByMomentRef: React.MutableRefObject<Record<number, boolean>>;
    skipContinuationSystemSuffixRef: React.MutableRefObject<string>;
    scenarioSkipConfirmedCountRef: React.MutableRefObject<number>;
    scenarioSkipPenaltySumRef: React.MutableRefObject<number>;
    recordInterviewAssistantDeliveryForMetaExemptionRef: React.MutableRefObject<(deliveredQuestionText: string) => void>;
    finalizePendingMetaAckBaselineAfterAssistantTextRef: React.MutableRefObject<(fullAssistantText: string) => void>;
    interviewAttemptCreationInFlightRef: React.MutableRefObject<boolean>;
    recoveryAssistantSpokenAtSubstantiveSeqRef: React.MutableRefObject<number | null>;
    tryRunEmotionModalFromScenarioTransitionRef: React.MutableRefObject<
      (params: {
        completedScenario: 1 | 2 | 3;
        transitionText: string;
        priorScenario: 1 | 2 | 3 | null;
        source: string;
      }) => Promise<void>
    >;
    elongatingProbeFiredRef: React.MutableRefObject<boolean>;
  };
  moments: {
    scenarioCRepairOnlyEvidenceRef: React.MutableRefObject<string | null>;
    scenarioCSophiePerspectiveProbeFiredRef: React.MutableRefObject<boolean>;
    currentInterviewMomentRef: React.MutableRefObject<InterviewMomentIndex>;
    personalHandoffInjectedRef: React.MutableRefObject<boolean>;
    interviewMomentsCompleteRef: React.MutableRefObject<ReturnType<typeof createInitialMomentCompletion>>;
    interviewNameRef: React.MutableRefObject<string | null>;
    interviewNameReaskPendingRef: React.MutableRefObject<boolean>;
    interviewNameReaskUsedRef: React.MutableRefObject<boolean>;
    moment4ThresholdProbeAskedRef: React.MutableRefObject<boolean>;
    deliveredReflectionRegistryRef: React.MutableRefObject<
      import('@features/aria/deliveredReflectionRegistry').DeliveredReflectionRecord[]
    >;
    moment4ClientSpecificityProbeInjectedRef: React.MutableRefObject<boolean>;
    moment4PostGrudgeSpecificityResolvedRef: React.MutableRefObject<boolean>;
    moment4ExpectingPostSpecificityUserTurnRef: React.MutableRefObject<boolean>;
    moment4SpecificityScoringRef: React.MutableRefObject<Moment4ClientScoringMetadata | null>;
    deferredMoment4NarrativeRef: React.MutableRefObject<string | null>;
    moment5QuestionDeliveredRef: React.MutableRefObject<boolean>;
    moment5QuestionDeliveryInFlightRef: React.MutableRefObject<boolean>;
    moment5PrimaryAnchorDeliveredSessionRef: React.MutableRefObject<boolean>;
    moment5PostPromptUserTurnCountRef: React.MutableRefObject<number>;
    moment5AccountabilityProbeFiredRef: React.MutableRefObject<boolean>;
    moment5ConflictValidityClarificationIssuedRef: React.MutableRefObject<boolean>;
    moment5SpecificityRedirectIssuedRef: React.MutableRefObject<boolean>;
    moment5ResolutionFollowUpIssuedRef: React.MutableRefObject<boolean>;
    moment5ResolutionDeliveredRef: React.MutableRefObject<boolean>;
    moment5ClientScoringMetaRef: React.MutableRefObject<Moment5ClientScoringMetadata | null>;
    scenarioAContemptProbeAskedRef: React.MutableRefObject<boolean>;
    scenarioAContemptProbePlaybackConfirmedRef: React.MutableRefObject<boolean>;
    showScenarioCardCanonicalPlaybackConfirmedKindsRef: React.MutableRefObject<
      import('@features/aria/showScenarioCardCanonicalTts').ShowScenarioCardCanonicalPlaybackConfirmedKinds
    >;
    scenarioAContemptProbeTtsDeliveredSessionRef: React.MutableRefObject<boolean>;
    pendingScenarioAContemptProbeStreamMuteRef: React.MutableRefObject<boolean>;
    pendingS3ToM4HandoffStreamMuteRef: React.MutableRefObject<boolean>;
    scenarioARepairQuestionAskedRef: React.MutableRefObject<boolean>;
    s2RepairProbeDeliveredRef: React.MutableRefObject<boolean>;
    s3RepairProbeDeliveredRef: React.MutableRefObject<boolean>;
    turnAudioIndexRef: React.MutableRefObject<number>;
    lastUserTurnAudioDurationMsRef: React.MutableRefObject<number | null>;
    responseTimingsRef: React.MutableRefObject<
      Array<{
        question_id: string;
        scenario: number | null;
        question_text: string;
        latency_ms: number;
        duration_ms: number;
        word_count: number;
      }>
    >;
  };
  webTts: {
    whisperRatioReaskAttemptsForCurrentQuestionRef: React.MutableRefObject<number>;
    ttsSessionHardFailureCountRef: React.MutableRefObject<number>;
    lastSuccessfulTtsTextNormalizedRef: React.MutableRefObject<string | null>;
    lastSuccessfulTtsDeliveredPreviewRef: React.MutableRefObject<string>;
    ttsUtteranceInFlightRef: React.MutableRefObject<string | null>;
    ttsUtteranceInFlightOptionsRef: React.MutableRefObject<WebTtsUtteranceReplayOptions | null>;
    ttsSpeakGenerationRef: React.MutableRefObject<number>;
    parallelStreamingTtsRef: React.MutableRefObject<ReturnType<typeof createInitialParallelStreamingTtsState>>;
    webTabRestoreTapSessionRef: React.MutableRefObject<number>;
    webTabRestoreDeliveredNormRef: React.MutableRefObject<string | null>;
    tabRestoreInFlightWithoutPlaybackSinceMsRef: React.MutableRefObject<number | null>;
  };
  resumeEmotion: {
    resumeRepeatChoicePendingRef: React.MutableRefObject<boolean>;
    resumeLastAssistantTextRef: React.MutableRefObject<string | null>;
    resumeRepeatPrefetchMpegRef: React.MutableRefObject<{ text: string; buffer: ArrayBuffer } | null>;
    resumeClosingRepeatSpeakInFlightRef: React.MutableRefObject<boolean>;
    resumeActiveScenarioRef: React.MutableRefObject<1 | 2 | 3 | null>;
    resumeWelcomeMessageRef: React.MutableRefObject<string>;
    resumeOfferWelcomeTtsRef: React.MutableRefObject<boolean>;
    resumeEmotionAfterModalTextRef: React.MutableRefObject<string | null>;
    resumeWelcomeHydrationAttemptRef: React.MutableRefObject<string | null>;
    pendingScenarioIntroAfterResumeWelcomeRef: React.MutableRefObject<string | null>;
    emotionItemResponsesRef: React.MutableRefObject<string[]>;
    emotionModalResolveRef: React.MutableRefObject<(() => void) | null>;
    emotionModalPendingTransitionRef: React.MutableRefObject<boolean>;
    pendingEmotionModalTransitionRef: React.MutableRefObject<PendingEmotionModalTransition | null>;
    emotionModalShownForScenarioRef: React.MutableRefObject<Set<1 | 2 | 3>>;
    emotionModalTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
    setEmotionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setEmotionModalItemIndex: React.Dispatch<React.SetStateAction<number>>;
    setEmotionItemResponses: React.Dispatch<React.SetStateAction<string[]>>;
    setEmotionItemsComplete: React.Dispatch<React.SetStateAction<boolean>>;
    transcriptScenarioLogCursorRef: React.MutableRefObject<number>;
  };
  progressReset: {
    interviewSessionIdRef: React.MutableRefObject<string>;
    firstScenarioLifecyclePersistedRef: React.MutableRefObject<boolean>;
    scoreInterviewAttemptedRef: React.MutableRefObject<boolean>;
    scoreInterviewInFlightRef: React.MutableRefObject<boolean>;
    consecutiveDigitalSilenceForMicFallbackRef: React.MutableRefObject<number>;
    micFallbackSuccessPendingRef: React.MutableRefObject<boolean>;
  };
};

export type AriaInterviewScreenSessionRoutingState = {
  isInterviewAppRoute: boolean;
  resumeLoadingFlowActiveRef: React.MutableRefObject<boolean>;
  resumeLoadingVisible: boolean;
  setResumeLoadingVisible: React.Dispatch<React.SetStateAction<boolean>>;
  preparingHandoffPollTick: number;
};

export type AriaInterviewScreenSessionShellState = {
  touchedConstructs: number[];
  setTouchedConstructs: React.Dispatch<React.SetStateAction<number[]>>;
  results: InterviewResults | null;
  setResults: React.Dispatch<React.SetStateAction<InterviewResults | null>>;
  stageResults: Array<{ stage: number; results: InterviewResults }>;
  setStageResults: React.Dispatch<React.SetStateAction<Array<{ stage: number; results: InterviewResults }>>>;
  preInterviewConsentAge: boolean;
  setPreInterviewConsentAge: React.Dispatch<React.SetStateAction<boolean>>;
  preInterviewConsentData: boolean;
  setPreInterviewConsentData: React.Dispatch<React.SetStateAction<boolean>>;
  interviewAttemptBootstrap: 'idle' | 'loading' | 'ready' | 'failed';
  setInterviewAttemptBootstrap: React.Dispatch<React.SetStateAction<'idle' | 'loading' | 'ready' | 'failed'>>;
  typedAnswer: string;
  setTypedAnswer: React.Dispatch<React.SetStateAction<string>>;
  scoredScenariosRef: React.MutableRefObject<Set<number>>;
  scenarioScores: Record<number, ScenarioScoreResult>;
  setScenarioScores: React.Dispatch<React.SetStateAction<Record<number, ScenarioScoreResult>>>;
  emotionModalVisible: boolean;
  setEmotionModalVisible: React.Dispatch<React.SetStateAction<boolean>>;
  emotionModalItemIndex: number;
  setEmotionModalItemIndex: React.Dispatch<React.SetStateAction<number>>;
  emotionItemResponses: string[];
  setEmotionItemResponses: React.Dispatch<React.SetStateAction<string[]>>;
  emotionItemsComplete: boolean;
  setEmotionItemsComplete: React.Dispatch<React.SetStateAction<boolean>>;
  emotionModalOpenForIndexRef: React.MutableRefObject<number>;
  maybeAwaitEmotionAfterScenarioTransitionRef: React.MutableRefObject<(sn: 1 | 2 | 3) => Promise<void>>;
  runEmotionModalAfterScenarioTransitionRef: React.MutableRefObject<
    (
      scenarioNum: 1 | 2 | 3,
      opts?: import('@features/aria/emotionModalOrchestrationTypes').EmotionModalAfterScenarioTransitionOpts,
    ) => Promise<void>
  >;
  resumeEmotionCatchUpIndicesRef: React.MutableRefObject<number[] | null>;
  isAdmin: boolean;
  setIsAdmin: React.Dispatch<React.SetStateAction<boolean>>;
  userEmail: string | null;
  setUserEmail: React.Dispatch<React.SetStateAction<string | null>>;
  interviewStatus: 'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis';
  setInterviewStatus: React.Dispatch<
    React.SetStateAction<'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'>
  >;
  analysisAttemptId: string | null;
  setAnalysisAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  pendingScoringSyncAttemptId: string | null;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  isInterviewCompleteRef: React.MutableRefObject<boolean>;
  pendingCompletion: boolean;
  setPendingCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  pendingCompletionTranscriptRef: React.MutableRefObject<
    { role: string; content: string; interviewMoment?: number; scenarioNumber?: number }[] | null
  >;
  standardResultsReferralCode: string | null;
  setStandardResultsReferralCode: React.Dispatch<React.SetStateAction<string | null>>;
  standardResultsReferralCopyFeedback: boolean;
  setStandardResultsReferralCopyFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  committedScenarioRef: React.MutableRefObject<ActiveScenario | null>;
  interviewUiPhase: InterviewUiPhase;
  setInterviewUiPhase: React.Dispatch<React.SetStateAction<InterviewUiPhase>>;
  referenceCardScenario: ActiveScenario | null;
  setReferenceCardScenario: React.Dispatch<React.SetStateAction<ActiveScenario | null>>;
  referenceCardPrompt: string | null;
  setReferenceCardPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  scrollViewRef: React.MutableRefObject<ScrollView | null>;
  hasResumedRef: React.MutableRefObject<boolean>;
  interviewUserTurnEpochRef: React.MutableRefObject<number>;
  timingRef: React.MutableRefObject<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>;
  lastQuestionTextRef: React.MutableRefObject<string>;
  probeLogRef: React.MutableRefObject<
    Array<{
      scenario: number;
      construct: string;
      probe_fired: boolean;
      trigger_reason: string | null;
      pre_probe_score: number;
      post_probe_score: number;
      score_delta: number;
    }>
  >;
  scenarioScoresRef: React.MutableRefObject<Record<number, ScenarioScoreResult>>;
  scoreScenarioRef: React.MutableRefObject<
    ((scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => Promise<void>) | null
  >;
  currentScenarioRef: React.MutableRefObject<1 | 2 | 3>;
  transcriptionFailureStreakRef: React.MutableRefObject<number>;
  recordingCompleteInFlightRef: React.MutableRefObject<boolean>;
  lastRecordingRetryDeliveredNormRef: React.MutableRefObject<string | null>;
  lastRecordingRetryDeliveredAtMsRef: React.MutableRefObject<number>;
  waitingMessageIdRef: React.MutableRefObject<string | null>;
  interviewSessionAttemptIdRef: React.MutableRefObject<string | null>;
  recordingJustFinishedBeforeNextTtsRef: React.MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: React.MutableRefObject<boolean>;
  recordingPeakMeteringRef: React.MutableRefObject<number | null>;
  lastRecordingVadSpeechDetectedRef: React.MutableRefObject<boolean | null>;
  transcribeBufferMetaRef: React.MutableRefObject<{ audio_duration_ms: number; buffer_size_bytes: number } | null>;
  recordingDelayMeasurementRef: React.MutableRefObject<preamble.RecordingDelayMeasurement | null>;
  sessionAudioHealthNotice: string | null;
  setSessionAudioHealthNotice: React.Dispatch<React.SetStateAction<string | null>>;
  ttsPlaybackReliabilityNotice: string | null;
  setTtsPlaybackReliabilityNotice: React.Dispatch<React.SetStateAction<string | null>>;
  conversationErrorNotice: string | null;
  setConversationErrorNotice: React.Dispatch<React.SetStateAction<string | null>>;
  ttsLineInFlightRef: React.MutableRefObject<boolean>;
  speakingWithoutPlaybackSinceMsRef: React.MutableRefObject<number | null>;
  staleTtsRuntimeLockSinceMsRef: React.MutableRefObject<number | null>;
  lastVoiceTurnLanguageRef: React.MutableRefObject<string | null>;
  lastVoiceTurnConfidenceRef: React.MutableRefObject<number | null>;
  networkStatus: 'checking' | 'good' | 'poor';
  setNetworkStatus: React.Dispatch<React.SetStateAction<'checking' | 'good' | 'poor'>>;
  commitInterviewMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string; scenarioNumber?: number }[]>>;
  statusRef: React.MutableRefObject<InterviewSessionStatus>;
  interviewStatusRef: React.MutableRefObject<
    'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'
  >;
  sessionExpired: boolean;
  setSessionExpired: React.Dispatch<React.SetStateAction<boolean>>;
  usingMemoryFallback: boolean;
  setUsingMemoryFallback: React.Dispatch<React.SetStateAction<boolean>>;
  reasoningProgress: ReasoningProgress;
  setReasoningProgress: React.Dispatch<React.SetStateAction<ReasoningProgress>>;
  usedPersonalExamples: boolean;
  setUsedPersonalExamples: React.Dispatch<React.SetStateAction<boolean>>;
  isWaiting: boolean;
  setIsWaiting: React.Dispatch<React.SetStateAction<boolean>>;
  showAdminPanel: boolean;
  setShowAdminPanel: React.Dispatch<React.SetStateAction<boolean>>;
  postInterviewFeedback: ReturnType<typeof useAriaPostInterviewFeedbackState>;
  lastAdminScoreCardCountRef: React.MutableRefObject<number>;
};

export type AriaInterviewScreenSessionState = {
  routing: AriaInterviewScreenSessionRoutingState;
  closingQuestion: ReturnType<typeof useAriaInterviewClosingQuestionState>;
  gate: AriaInterviewScreenSessionGateState;
  shell: AriaInterviewScreenSessionShellState;
};
