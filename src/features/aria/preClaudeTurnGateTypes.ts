import type { MutableRefObject } from 'react';

import type { PendingEmotionModalTransition } from '@features/aria/emotionRecognitionInterview';
import type { PostClaudeInterviewMessage } from '@features/aria/postClaudeAssistantTurnTypes';
import type { SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { InterviewTranscriptRow, VoiceState, InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewProgressRefs } from '@features/aria/interviewProgressSync';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';

export type PreClaudeTurnGateParams = {
  spokenText: string;
  trimmed: string;
  resumeGatePendingEarly: boolean;
  messagesToUse: PostClaudeInterviewMessage[];
  userScenarioTag: number;
  participantFirstNameForSpoken: string;
  isPersonalOpening: boolean;
  replyingToScenarioAQ1: boolean;
  replyingToScenarioBQ1: boolean;
  replyingToScenarioCQ1: boolean;
  shouldForceScenarioAContemptProbe: boolean;
  shouldForceScenarioBFullAppreciationProbe: boolean;
  shouldForceScenarioBJamesRepairProbe: boolean;
  shouldForceScenarioCRepairProbe: boolean;
  shouldForceScenarioCSophiePerspectiveProbe: boolean;
  shouldForceMoment4ThresholdProbe: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  suppressForcedConstructProbesForMetaFrustration: boolean;
  scenarioAContemptGateUserText: string;
  sidedEntirelyWithJames: boolean;
  scenarioBQ1Engaged: boolean;
  moment5CombinedUserText: string;
  moment4ThresholdHintInAnswer: boolean;
  metaCommentClassification: MetaCommentClassification | null;
  repeatedFrustrationInMoment: boolean;
  alreadyAnsweredPriorSubstantiveVerified: boolean | undefined;
  checkingInFrustrationAdjacent: boolean;
  maxTok: number;
  closingInstruction: string;
  progressSuffix: string;
  participantFirstNameSystemSuffix: string;
  elongatingSuppressedForUserTurn: boolean;
  metaCommentSystemSuffix: string;
  muteParallelTtsForScenarioAContemptProbeStream: boolean;
  muteParallelTtsForS3ToM4HandoffStream: boolean;
  allowScenarioARepairAfterContemptAnswer: boolean;
  lastAssistantContent: string;
  isNameEntryTurn: boolean;
  frustrationSkipAcceptancePipeline: boolean;
  frustrationSkipDeclinePipeline: boolean;
  proactiveScenarioSkipConfirmationInjection: boolean;
  elongatingProbeStateForApi: boolean;
  skipContinuationSnap: string;
  hadPriorSubstantiveAnswerForFrustrationOffer: boolean | undefined;
};

export type PreClaudeTurnGateDeps = {
  messages: InterviewTranscriptRow[];
  userId: string;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  status: string;
  closingQuestionPending: boolean;
  closingQuestionScenario: 1 | 2 | 3 | null;
  usedPersonalExamples: boolean;
  setVoiceState: (state: VoiceState) => void;
  setIsWaiting: (waiting: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<InterviewTranscriptRow[]>>;
  setCurrentTranscript: (text: string) => void;
  setExchangeCount: React.Dispatch<React.SetStateAction<number>>;
  setHighestScenarioReached: React.Dispatch<React.SetStateAction<number>>;
  setClosingQuestionPending: React.Dispatch<React.SetStateAction<boolean>>;
  setClosingQuestionScenario: React.Dispatch<React.SetStateAction<1 | 2 | 3 | null>>;
  setInterviewStatus: (status: 'preparing_results') => void;
  setPendingCompletion: (pending: boolean) => void;
  setResults: React.Dispatch<React.SetStateAction<InterviewResults | null>>;
  setStatus: React.Dispatch<React.SetStateAction<InterviewSessionStatus>>;
  setTouchedConstructs: React.Dispatch<React.SetStateAction<number[]>>;
  setUsedPersonalExamples: React.Dispatch<React.SetStateAction<boolean>>;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  setReferenceCardPrompt: (prompt: string | null) => void;
  setReferenceCardScenario?: (scenario: import('@app/screens/UserInterviewLayout').ActiveScenario | null) => void;
  setInterviewUiPhase?: (phase: import('@features/aria/sessionLifecycleTypes').InterviewUiPhase) => void;
  committedScenarioRef?: { current: import('@app/screens/UserInterviewLayout').ActiveScenario | null };
  showScenarioCardCanonicalPlaybackConfirmedKindsRef?: MutableRefObject<
    import('@features/aria/showScenarioCardCanonicalTts').ShowScenarioCardCanonicalPlaybackConfirmedKinds
  >;
  commitInterviewMessages: (
    next: InterviewTranscriptRow[] | ((prev: InterviewTranscriptRow[]) => InterviewTranscriptRow[]),
  ) => void;
  speakTextSafe: (text: string, options?: SpeakTextSafeOptions) => Promise<void>;
  deliverRecordingRetryLine: (line: string) => Promise<void>;
  invalidateProfileQuery: () => void;
  applyInterviewProgressFromAssistantText: (text: string, refs: InterviewProgressRefs) => void;
  scoreScenario: (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => void;
  notifyScenarioStarted: (scenarioNumber: 1 | 2 | 3, allMessages: PostClaudeInterviewMessage[]) => Promise<void>;
  ensureCompletedScenarioScored: (
    completedScenario: 1 | 2 | 3,
    messagesForScoring: { role: string; content: string }[],
    trigger: string,
  ) => void;
  markClosingQuestionAsked: (scenarioNumber: 1 | 2 | 3) => void;
  markClosingQuestionAnswered: (scenarioNumber: 1 | 2 | 3) => void;
  runEmotionModalAfterScenarioTransition: (
    scenarioJustCompleted: 1 | 2 | 3,
    opts?: import('@features/aria/emotionModalOrchestrationTypes').EmotionModalAfterScenarioTransitionOpts,
  ) => Promise<void>;
  awaitEmotionModalForIndex: (itemIndex: number) => Promise<void>;
  kickPostClosingInterviewCompletionIfReady: (
    source: string,
    transcriptMessages: ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>,
  ) => Promise<boolean>;
  kickCompletionScoring: (source: string, transcript: Array<{ role: string; content: string }>) => boolean;
  showChatError: (message: string) => void;
  createInterviewAttemptOnFirstSubstantiveResponse: (
    userId: string,
    userText: string,
    scenarioNumber: 1 | 2 | 3,
    platform: string,
  ) => Promise<string | null>;
  collectDeviceContext: () => Promise<{ platform: string }>;
  resetSessionLogRuntime: (opts: {
    sessionCorrelationId: string;
    attemptId: string;
    sessionLogsRequireAttemptId: boolean;
  }) => void;
  assignAttemptIdForSessionLogs: (attemptId: string) => void;
  markAiProcessingTurnStarted: () => void;
  metaClassificationForPendingAssistantRef: MutableRefObject<MetaCommentClassification | null>;
  whisperRatioReaskAttemptsForCurrentQuestionRef: MutableRefObject<number>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
  resumeLastAssistantTextRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  webTabRestoreDeliveredNormRef?: MutableRefObject<string | null>;
  pendingGestureRestoreSpeakRef?: MutableRefObject<{ text?: string | null } | null>;
  /** Optional: readiness→S1 HTML speak arms these for tab-hide Tap-to-continue. */
  ttsLineInFlightRef?: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef?: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewAttemptCreationInFlightRef: MutableRefObject<boolean>;
  interviewNameRef: MutableRefObject<string | null>;
  interviewNameReaskPendingRef: MutableRefObject<boolean>;
  interviewNameReaskUsedRef: MutableRefObject<boolean>;
  interviewStatusRef: MutableRefObject<string>;
  currentInterviewMomentRef: MutableRefObject<number>;
  currentScenarioRef: MutableRefObject<number>;
  currentMessagesRef: MutableRefObject<InterviewTranscriptRow[]>;
  transcriptAtReleaseRef: MutableRefObject<string>;
  frustrationSkipOfferPendingRef: MutableRefObject<boolean>;
  frustrationSkipAwaitingConfirmationRef: MutableRefObject<boolean>;
  frustrationSkipHadPriorAnswerRef: MutableRefObject<boolean | null>;
  scenarioSkipOfferSourceRef: MutableRefObject<string | null>;
  metaCommentAckAwaitingSubstantiveBaselineSeqRef: MutableRefObject<number | null>;
  substantiveInterviewQuestionDeliveredSeqRef: MutableRefObject<number>;
  metaCommentFrustrationCountByMomentRef: MutableRefObject<Record<number, number>>;
  inabilityCountByMomentRef: MutableRefObject<Record<number, number>>;
  skipRequestClassificationSeenByMomentRef: MutableRefObject<Record<number, boolean>>;
  scenarioCSophiePerspectiveProbeFiredRef: MutableRefObject<boolean>;
  probeLogRef: MutableRefObject<
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
  elongatingProbeFiredRef: MutableRefObject<boolean>;
  personalHandoffInjectedRef: MutableRefObject<boolean>;
  interviewMomentsCompleteRef: MutableRefObject<Record<number, boolean>>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  scenarioScoresRef: MutableRefObject<Record<number, unknown>>;
  scenarioAContemptProbeAskedRef: MutableRefObject<boolean>;
  scenarioARepairQuestionAskedRef: MutableRefObject<boolean>;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  moment4ThresholdProbeAskedRef: MutableRefObject<boolean>;
  deliveredReflectionRegistryRef: MutableRefObject<
    import('@features/aria/deliveredReflectionRegistry').DeliveredReflectionRecord[]
  >;
  moment4ClientSpecificityProbeInjectedRef: MutableRefObject<boolean>;
  moment4ExpectingPostSpecificityUserTurnRef: MutableRefObject<boolean>;
  moment4PostGrudgeSpecificityResolvedRef: MutableRefObject<boolean>;
  moment4SpecificityScoringRef: MutableRefObject<unknown>;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
  moment5PostPromptUserTurnCountRef: MutableRefObject<number>;
  moment5PrimaryAnchorDeliveredSessionRef: MutableRefObject<boolean>;
  moment5QuestionDeliveredRef: MutableRefObject<boolean>;
  moment5QuestionDeliveryInFlightRef: MutableRefObject<boolean>;
  moment5ResolutionFollowUpIssuedRef: MutableRefObject<boolean>;
  moment5ResolutionDeliveredRef: MutableRefObject<boolean>;
  moment5ClientScoringMetaRef: MutableRefObject<unknown>;
  moment5ConflictValidityClarificationIssuedRef: MutableRefObject<boolean>;
  moment5SpecificityRedirectIssuedRef: MutableRefObject<boolean>;
  waitingForClosingAdditionRef: MutableRefObject<number | null>;
  lastAnsweredClosingScenarioRef: MutableRefObject<number | null>;
  lastClosingQuestionScenarioRef: MutableRefObject<number | null>;
  closingQuestionAskedRef: MutableRefObject<Record<number, boolean>>;
  closingQuestionAnsweredRef: MutableRefObject<Record<number, boolean>>;
  skipContinuationSystemSuffixRef: MutableRefObject<string>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  pendingCompletionTranscriptRef: MutableRefObject<
    Array<{ role: string; content: string; interviewMoment?: number; scenarioNumber?: number }> | null
  >;
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
  resetScenarioCClientGatesOnly: () => void;
  emotionItemResponsesRef: MutableRefObject<string[]>;
  recordInterviewAssistantDeliveryForMetaExemptionRef: MutableRefObject<(text: string) => void>;
  finalizePendingMetaAckBaselineAfterAssistantTextRef: MutableRefObject<(text: string) => void>;
  pendingScenarioAContemptProbeStreamMuteRef: MutableRefObject<boolean>;
  pendingS3ToM4HandoffStreamMuteRef: MutableRefObject<boolean>;
  resumeClosingRepeatSpeakInFlightRef: MutableRefObject<boolean>;
  resumeRepeatPrefetchMpegRef: MutableRefObject<{ text: string; buffer: ArrayBuffer } | null>;
  routeChangedDuringRecordingRef: MutableRefObject<boolean>;
  scenarioCRepairOnlyEvidenceRef: MutableRefObject<unknown>;
  scenarioFrustrationSkipNullMarkersRef: MutableRefObject<Partial<Record<1 | 2 | 3, boolean>>>;
  scenarioSkipConfirmedCountRef: MutableRefObject<number>;
  scenarioSkipPenaltySumRef: MutableRefObject<number>;
  lastUserTurnAudioDurationMsRef: MutableRefObject<number | null>;
  lastVoiceTurnConfidenceRef: MutableRefObject<number | null>;
  lastVoiceTurnLanguageRef: MutableRefObject<string | null>;
  responseTimingsRef: MutableRefObject<unknown[]>;
  timingRef: MutableRefObject<unknown>;
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  webResumeWelcomeTapPendingRef: MutableRefObject<boolean>;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
  webResumeWelcomeTapHandledRef: MutableRefObject<boolean>;
  interviewUserTurnEpochRef: MutableRefObject<number>;
};
