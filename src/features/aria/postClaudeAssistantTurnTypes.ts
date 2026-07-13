import type { ClosingPhase } from '@features/aria/interviewClosingQuestionTypes';
import type { MutableRefObject } from 'react';

import type { ClaudeParallelStreamTtsCallResult, ParallelStreamTextState } from '@features/aria/claudeParallelStreamTtsCallTypes';
import type { InterviewMomentIndex } from '@features/aria/interviewScenarioScoringSlice';
import type { SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { InterviewTranscriptRow, VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { Moment5ClientScoringMetadata } from '@features/aria/moment5AccountabilityScoringPrompt';
import type { InterviewProgressRefs } from '@features/aria/interviewProgressSync';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import type { FetchStageScoreFn } from '@features/aria/fetchStageScoreTypes';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';

export type PostClaudeInterviewMessage = InterviewTranscriptRow & {
  scenarioNumber?: number;
  isWelcomeBack?: boolean;
  isWaiting?: boolean;
};

export type PostClaudeAssistantTurnParams = {
  data: ClaudeParallelStreamTtsCallResult;
  messagesToUse: PostClaudeInterviewMessage[];
  textToParallelStream: ParallelStreamTextState;
  participantFirstNameForSpoken: string;
  trimmed: string;
  elongatingSuppressedForUserTurn: boolean;
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
  userScenarioTag: number;
  muteParallelTtsForScenarioAContemptProbeStream: boolean;
  allowScenarioARepairAfterContemptAnswer: boolean;
};

export type PostClaudeAssistantTurnDeps = {
  userId: string;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  status: string;
  setVoiceState: (state: VoiceState) => void;
  setIsWaiting: (waiting: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<InterviewTranscriptRow[]>>;
  setInterviewStatus: (status: 'preparing_results') => void;
  setPendingCompletion: (pending: boolean) => void;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  setReferenceCardPrompt: (prompt: string | null) => void;
  setReferenceCardScenario?: (scenario: import('@app/screens/UserInterviewLayout').ActiveScenario | null) => void;
  setInterviewUiPhase?: (phase: import('@features/aria/sessionLifecycleTypes').InterviewUiPhase) => void;
  committedScenarioRef?: { current: import('@app/screens/UserInterviewLayout').ActiveScenario | null };
  showScenarioCardCanonicalPlaybackConfirmedKindsRef?: MutableRefObject<
    import('@features/aria/showScenarioCardCanonicalTts').ShowScenarioCardCanonicalPlaybackConfirmedKinds
  >;
  setHighestScenarioReached: React.Dispatch<React.SetStateAction<number>>;
  fetchStageScore: FetchStageScoreFn;
  setStageResults: React.Dispatch<
    React.SetStateAction<Array<{ stage: number; results: InterviewResults }>>
  >;
  setClosingQuestionPending: React.Dispatch<React.SetStateAction<boolean>>;
  setClosingQuestionScenario: React.Dispatch<React.SetStateAction<1 | 2 | 3 | null>>;
  setClosingQuestionState: React.Dispatch<React.SetStateAction<Record<1 | 2 | 3, ClosingPhase>>>;
  setTouchedConstructs: React.Dispatch<React.SetStateAction<number[]>>;
  commitInterviewMessages: (
    next: InterviewTranscriptRow[] | ((prev: InterviewTranscriptRow[]) => InterviewTranscriptRow[]),
  ) => void;
  speakTextSafe: (text: string, options?: SpeakTextSafeOptions) => Promise<void>;
  applyInterviewSpeechComplete: (rawText: string) => void;
  kickPostClosingInterviewCompletionIfReady: (
    source: string,
    transcriptMessages: ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>,
  ) => Promise<boolean>;
  kickCompletionScoring: (source: string, transcript: Array<{ role: string; content: string }>) => boolean;
  awaitEmotionModalForIndex: (itemIndex: number) => Promise<void>;
  listUnansweredEmotionModalIndices: (
    responses: readonly string[],
    throughScenario: 1 | 2 | 3,
  ) => number[];
  runEmotionModalAfterScenarioTransition: (
    scenarioJustCompleted: 1 | 2 | 3,
    opts?: import('@features/aria/emotionModalOrchestrationTypes').EmotionModalAfterScenarioTransitionOpts,
  ) => Promise<void>;
  scoreScenario: (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => void;
  notifyScenarioStarted: (scenarioNumber: 1 | 2 | 3, allMessages: PostClaudeInterviewMessage[]) => Promise<void>;
  ensureCompletedScenarioScored: (
    completedScenario: 1 | 2 | 3,
    messagesForScoring: { role: string; content: string }[],
    trigger: string,
  ) => void;
  markClosingQuestionAsked: (scenarioNumber: 1 | 2 | 3) => void;
  markClosingQuestionAnswered: (scenarioNumber: 1 | 2 | 3) => void;
  resolveAssistantScenarioNumber: (text: string, messages: PostClaudeInterviewMessage[]) => number | undefined;
  applyInterviewProgressFromAssistantText: (text: string, refs: InterviewProgressRefs) => void;
  finalizePendingMetaAckBaselineAfterAssistantTextRef: MutableRefObject<(text: string) => void>;
  insertPreambleBriefingIfMissing: (
    messages: PostClaudeInterviewMessage[],
    briefingText: string,
  ) => PostClaudeInterviewMessage[];
  persistInterviewAttemptSessionLifecycle: typeof import('@utilities/interviewAttemptLifecycle').persistInterviewAttemptSessionLifecycle;
  saveInterviewProgress: typeof import('@features/aria/interviewLocalPersistence').saveInterviewProgress;
  markPreparingResultsSession: (userId: string) => void;
  closingQuestionAnsweredRef: MutableRefObject<Record<number, boolean>>;
  closingQuestionAskedRef: MutableRefObject<Record<number, boolean>>;
  currentInterviewMomentRef: MutableRefObject<InterviewMomentIndex | number>;
  currentMessagesRef: MutableRefObject<InterviewTranscriptRow[]>;
  currentScenarioRef: MutableRefObject<number>;
  elongatingProbeFiredRef: MutableRefObject<boolean>;
  emotionItemResponsesRef: MutableRefObject<string[]>;
  interviewMomentsCompleteRef: MutableRefObject<Record<number, boolean>>;
  interviewNameRef: MutableRefObject<string | null>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  interviewStatusRef: MutableRefObject<string>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  lastAnsweredClosingScenarioRef: MutableRefObject<number | null>;
  lastClosingQuestionScenarioRef: MutableRefObject<number | null>;
  lastQuestionTextRef: MutableRefObject<string>;
  moment4ClientSpecificityProbeInjectedRef: MutableRefObject<boolean>;
  moment4ThresholdProbeAskedRef: MutableRefObject<boolean>;
  deliveredReflectionRegistryRef: MutableRefObject<
    import('@features/aria/deliveredReflectionRegistry').DeliveredReflectionRecord[]
  >;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
  moment5ClientScoringMetaRef: MutableRefObject<Moment5ClientScoringMetadata | null>;
  moment5ConflictValidityClarificationIssuedRef: MutableRefObject<boolean>;
  moment5PostPromptUserTurnCountRef: MutableRefObject<number>;
  moment5PrimaryAnchorDeliveredSessionRef: MutableRefObject<boolean>;
  moment5QuestionDeliveredRef: MutableRefObject<boolean>;
  moment5QuestionDeliveryInFlightRef: MutableRefObject<boolean>;
  parallelStreamingTtsRef: MutableRefObject<import('@features/aria/interviewParallelTtsBatch').ParallelStreamingTtsState>;
  /** Optional: readiness→S1 HTML speak arms these for tab-hide Tap-to-continue. */
  ttsLineInFlightRef?: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef?: MutableRefObject<string | null>;
  pendingCompletionTranscriptRef: MutableRefObject<Array<{ role: string; content: string }> | null>;
  pendingEmotionModalTransitionRef: MutableRefObject<{
    completedScenario: 1 | 2 | 3;
    afterModal: string;
    transitionText: string;
    priorScenario: number | null;
  } | null>;
  pendingGestureRestoreSpeakRef: MutableRefObject<import('@features/aria/hooks/useAriaInterviewSession').PendingGestureRestoreSpeakEntry | null>;
  personalHandoffInjectedRef: MutableRefObject<boolean>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  scenarioAContemptProbeAskedRef: MutableRefObject<boolean>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  scenarioARepairQuestionAskedRef: MutableRefObject<boolean>;
  scenarioScoresRef: MutableRefObject<
    Record<
      number,
      {
        pillarScores: Record<string, number | null>;
        pillarConfidence: Record<string, string>;
        keyEvidence: Record<string, string>;
        scenarioName?: string;
      }
    >
  >;
  scoreInterviewAttemptedRef: MutableRefObject<boolean>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
  scenarioCSophiePerspectiveProbeFiredRef: MutableRefObject<boolean>;
  moment5SpecificityRedirectIssuedRef: MutableRefObject<boolean>;
  moment5ResolutionFollowUpIssuedRef: MutableRefObject<boolean>;
  moment5ResolutionDeliveredRef: MutableRefObject<boolean>;
  recordInterviewAssistantDeliveryForMetaExemptionRef: MutableRefObject<(text: string) => void>;
  resetScenarioCClientGatesOnly: () => void;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
};
