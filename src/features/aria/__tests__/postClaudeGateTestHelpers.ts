import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import type { SanitizePostClaudeAssistantDraftResult } from '@features/aria/sanitizePostClaudeAssistantDraftText';

export function mockRef<T>(value: T): { current: T } {
  return { current: value };
}

export function createMockPostClaudeParams(
  overrides: Partial<PostClaudeAssistantTurnParams> = {},
): PostClaudeAssistantTurnParams {
  return {
    data: { content: [{ text: '' }] },
    messagesToUse: [],
    textToParallelStream: { full: '', spokenStarted: false, closingSpoken: false },
    participantFirstNameForSpoken: 'Alex',
    trimmed: 'yes',
    elongatingSuppressedForUserTurn: false,
    isPersonalOpening: false,
    replyingToScenarioAQ1: false,
    replyingToScenarioBQ1: false,
    replyingToScenarioCQ1: false,
    shouldForceScenarioAContemptProbe: false,
    shouldForceScenarioBFullAppreciationProbe: false,
    shouldForceScenarioBJamesRepairProbe: false,
    shouldForceScenarioCRepairProbe: false,
    shouldForceScenarioCSophiePerspectiveProbe: false,
    shouldForceMoment4ThresholdProbe: false,
    specificEmmaLineAlreadyAddressed: false,
    suppressForcedConstructProbesForMetaFrustration: false,
    scenarioAContemptGateUserText: '',
    sidedEntirelyWithJames: false,
    scenarioBQ1Engaged: false,
    moment5CombinedUserText: '',
    moment4ThresholdHintInAnswer: false,
    userScenarioTag: 1,
    muteParallelTtsForScenarioAContemptProbeStream: false,
    muteParallelTtsForS3ToM4HandoffStream: false,
    allowScenarioARepairAfterContemptAnswer: false,
    ...overrides,
  };
}

export function createMockPostClaudeDeps(
  overrides: Partial<PostClaudeAssistantTurnDeps> = {},
): PostClaudeAssistantTurnDeps {
  const noop = jest.fn();
  const asyncNoop = jest.fn().mockResolvedValue(undefined);

  return {
    userId: 'user-test',
    isAdmin: false,
    isInterviewAppRoute: true,
    status: 'active',
    setVoiceState: noop,
    setIsWaiting: noop,
    setMessages: noop,
    setInterviewStatus: noop,
    setPendingCompletion: noop,
    setWebTabGestureRestoreOverlay: noop,
    setReferenceCardPrompt: noop,
    setHighestScenarioReached: jest.fn((updater) => {
      if (typeof updater === 'function') updater(1);
    }),
    fetchStageScore: jest.fn().mockResolvedValue({
      pillarScores: { mentalizing: 5 },
      keyEvidence: {},
      narrativeCoherence: 'moderate',
      behavioralSpecificity: 'moderate',
      notableInconsistencies: [],
      interviewSummary: 'ok',
    }),
    setStageResults: noop,
    setClosingQuestionPending: noop,
    setClosingQuestionScenario: noop,
    setClosingQuestionState: noop,
    setTouchedConstructs: noop,
    commitInterviewMessages: noop,
    speakTextSafe: asyncNoop,
    applyInterviewSpeechComplete: noop,
    kickPostClosingInterviewCompletionIfReady: jest.fn().mockResolvedValue(false),
    kickCompletionScoring: jest.fn().mockReturnValue(false),
    awaitEmotionModalForIndex: asyncNoop,
    listUnansweredEmotionModalIndices: jest.fn().mockReturnValue([]),
    runEmotionModalAfterScenarioTransition: asyncNoop,
    scoreScenario: noop,
    notifyScenarioStarted: asyncNoop,
    ensureCompletedScenarioScored: noop,
    markClosingQuestionAsked: noop,
    markClosingQuestionAnswered: noop,
    resolveAssistantScenarioNumber: jest.fn().mockReturnValue(3),
    applyInterviewProgressFromAssistantText: noop,
    finalizePendingMetaAckBaselineAfterAssistantTextRef: mockRef(noop),
    insertPreambleBriefingIfMissing: jest.fn((msgs) => msgs),
    persistInterviewAttemptSessionLifecycle: noop,
    saveInterviewProgress: asyncNoop,
    markPreparingResultsSession: noop,
    closingQuestionAnsweredRef: mockRef<Record<number, boolean>>({}),
    closingQuestionAskedRef: mockRef<Record<number, boolean>>({}),
    currentInterviewMomentRef: mockRef(1),
    currentMessagesRef: mockRef([]),
    currentScenarioRef: mockRef(1),
    elongatingProbeFiredRef: mockRef(false),
    emotionItemResponsesRef: mockRef<string[]>([]),
    interviewMomentsCompleteRef: mockRef<Record<number, boolean>>({}),
    interviewNameRef: mockRef('Alex'),
    interviewSessionAttemptIdRef: mockRef('attempt-1'),
    interviewSessionIdRef: mockRef('session-1'),
    interviewStatusRef: mockRef('active'),
    isInterviewCompleteRef: mockRef(false),
    lastAnsweredClosingScenarioRef: mockRef<number | null>(null),
    lastClosingQuestionScenarioRef: mockRef<number | null>(null),
    lastQuestionTextRef: mockRef(''),
    moment4ClientSpecificityProbeInjectedRef: mockRef(false),
    moment4ThresholdProbeAskedRef: mockRef(false),
    deliveredReflectionRegistryRef: mockRef([]),
    moment5AccountabilityProbeFiredRef: mockRef(false),
    moment5ClientScoringMetaRef: mockRef(null),
    moment5ConflictValidityClarificationIssuedRef: mockRef(false),
    moment5PostPromptUserTurnCountRef: mockRef(0),
    moment5PrimaryAnchorDeliveredSessionRef: mockRef(false),
    moment5QuestionDeliveredRef: mockRef(false),
    moment5QuestionDeliveryInFlightRef: mockRef(false),
    parallelStreamingTtsRef: mockRef(createInitialParallelStreamingTtsState()),
    ttsLineInFlightRef: mockRef(false),
    webTtsUtteranceInFlightRef: mockRef(null),
    pendingCompletionTranscriptRef: mockRef(null),
    pendingEmotionModalTransitionRef: mockRef(null),
    pendingGestureRestoreSpeakRef: mockRef(null),
    personalHandoffInjectedRef: mockRef(false),
    resumeActiveScenarioRef: mockRef<1 | 2 | 3 | null>(null),
    scenarioAContemptProbeAskedRef: mockRef(false),
    scenarioAContemptProbePlaybackConfirmedRef: mockRef(false),
    scenarioAContemptProbeTtsDeliveredSessionRef: mockRef(false),
    scenarioARepairQuestionAskedRef: mockRef(false),
    scenarioScoresRef: mockRef({}),
    scoreInterviewAttemptedRef: mockRef(false),
    scoredScenariosRef: mockRef(new Set<number>()),
    webTtsTabInterruptPendingReplayRef: mockRef(false),
    s2RepairProbeDeliveredRef: mockRef(false),
    s3RepairProbeDeliveredRef: mockRef(false),
    scenarioCSophiePerspectiveProbeFiredRef: mockRef(false),
    moment5SpecificityRedirectIssuedRef: mockRef(false),
    moment5ResolutionFollowUpIssuedRef: mockRef(false),
    moment5ResolutionDeliveredRef: mockRef(false),
    recordInterviewAssistantDeliveryForMetaExemptionRef: mockRef(noop),
    resetScenarioCClientGatesOnly: noop,
    setPendingScoringSyncAttemptId: noop,
    ...overrides,
  };
}

export function createMockSpeakAssistantTurn() {
  return jest.fn().mockResolvedValue(undefined);
}

export function createMockSanitizeDraftResult(
  overrides: Partial<SanitizePostClaudeAssistantDraftResult> = {},
): SanitizePostClaudeAssistantDraftResult {
  return {
    strippedText: 'Thanks Alex, that makes sense.',
    shouldInjectScenarioARepairAfterContemptAnswer: false,
    scenarioHandoffAssistantTurn: false,
    recentAsstForAck: [],
    assistantIssuedMoment4ThresholdProbe: false,
    assistantIssuedMoment4AnyQuestion: false,
    assistantIssuedScenarioAContemptProbe: false,
    assistantIssuedScenarioARepairQuestion: false,
    assistantIssuedScenarioBFullProbe: false,
    assistantIssuedScenarioBJamesDifferently: false,
    assistantIssuedScenarioBRepairAsJames: false,
    assistantTurnIsElongatingProbeOnly: false,
    ...overrides,
  };
}
