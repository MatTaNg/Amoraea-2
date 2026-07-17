import type { MutableRefObject } from 'react';

import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { AudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import type {
  DeviceSnapshot,
  InterviewDeviceEnvironmentPayload,
  SessionOutputRouteLabel,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import type { SessionPlatform } from '@utilities/sessionLogging/writeSessionLog';

export type InterviewAttemptBootstrap = 'idle' | 'loading' | 'ready' | 'failed';
export type InterviewUiPhase = 'pre_scenario' | 'scenario_transitioning' | 'scenario_active';

export type SavedInterviewSnapshot = NonNullable<
  Awaited<ReturnType<typeof import('@utilities/storage/InterviewStorage').loadInterviewFromStorage>>
>;

export type HydratePostClosingFromSavedParams = {
  saved: SavedInterviewSnapshot;
  source: string;
};

export type HydratePostClosingFromSavedDeps = {
  userId: string | undefined;
  hasResumedRef: MutableRefObject<boolean>;
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  setResumeLoadingVisible: (v: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string; [key: string]: unknown }[]>>;
  pendingCompletionTranscriptRef: MutableRefObject<{ role: string; content: string }[] | null>;
  emotionItemResponsesRef: MutableRefObject<string[]>;
  setEmotionItemResponses: React.Dispatch<React.SetStateAction<string[]>>;
  setEmotionItemsComplete: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  interviewStatusRef: MutableRefObject<string>;
  setInterviewStatus: React.Dispatch<
    React.SetStateAction<
      'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'
    >
  >;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
};

export type HandleResumeParams = {
  saved: SavedInterviewSnapshot;
};

export type HandleResumeDeps = HydratePostClosingFromSavedDeps & {
  speakTextSafe: (
    text: string,
    opts?: Record<string, unknown>,
  ) => Promise<void>;
  awaitScreenReadySignal: () => Promise<void>;
  logSessionResumeState: (state: 'loading' | 'ready') => void;
  awaitEmotionModalForIndex: (itemIndex: number) => Promise<void>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  interviewMomentsCompleteRef: MutableRefObject<unknown>;
  currentInterviewMomentRef: MutableRefObject<number>;
  personalHandoffInjectedRef: MutableRefObject<boolean>;
  interviewNameRef: MutableRefObject<string | null>;
  moment4ThresholdProbeAskedRef: MutableRefObject<boolean>;
  deliveredReflectionRegistryRef: MutableRefObject<
    import('@features/aria/deliveredReflectionRegistry').DeliveredReflectionRecord[]
  >;
  moment4PostGrudgeSpecificityResolvedRef: MutableRefObject<boolean>;
  moment4ClientSpecificityProbeInjectedRef: MutableRefObject<boolean>;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
  moment5SpecificityRedirectIssuedRef: MutableRefObject<boolean>;
  moment5ResolutionFollowUpIssuedRef: MutableRefObject<boolean>;
  moment5ResolutionDeliveredRef: MutableRefObject<boolean>;
  moment5ConflictValidityClarificationIssuedRef: MutableRefObject<boolean>;
  moment5QuestionDeliveredRef: MutableRefObject<boolean>;
  moment5PrimaryAnchorDeliveredSessionRef: MutableRefObject<boolean>;
  moment5PostPromptUserTurnCountRef: MutableRefObject<number>;
  scenarioAContemptProbeAskedRef: MutableRefObject<boolean>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef: MutableRefObject<
    import('@features/aria/showScenarioCardCanonicalTts').ShowScenarioCardCanonicalPlaybackConfirmedKinds
  >;
  scenarioARepairQuestionAskedRef: MutableRefObject<boolean>;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
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
  scoredScenariosRef: MutableRefObject<Set<number>>;
  setHighestScenarioReached: React.Dispatch<React.SetStateAction<number>>;
  currentScenarioRef: MutableRefObject<number | null>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  resumeEmotionCatchUpIndicesRef: MutableRefObject<number[] | null>;
  resumeEmotionAfterModalTextRef: MutableRefObject<string | null>;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
  resumeWelcomeMessageRef: MutableRefObject<string | null>;
  resumeWelcomeHydrationAttemptRef: MutableRefObject<string | null>;
  resumeLastAssistantTextRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  setScenarioScores: React.Dispatch<React.SetStateAction<Record<number, ScenarioScoreResult>>>;
  setStageResults: React.Dispatch<
    React.SetStateAction<Array<{ stage: number; results: InterviewResults }>>
  >;
  setTouchedConstructs: React.Dispatch<React.SetStateAction<number[]>>;
  pendingScenarioIntroAfterResumeWelcomeRef: MutableRefObject<string | null>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
  setStatus: React.Dispatch<React.SetStateAction<InterviewSessionStatus>>;
  committedScenarioRef: MutableRefObject<ActiveScenario | null>;
  setReferenceCardScenario: React.Dispatch<React.SetStateAction<ActiveScenario | null>>;
  setReferenceCardPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  setInterviewUiPhase: React.Dispatch<React.SetStateAction<InterviewUiPhase>>;
  currentMessagesRef: MutableRefObject<{ role: string; content: string; [key: string]: unknown }[]>;
  interruptAllInterviewTtsOutput: () => void;
  moment5QuestionDeliveryInFlightRef: MutableRefObject<boolean>;
  interviewUserTurnEpochRef: MutableRefObject<number>;
};

export type StartInterviewParams = {
  fromUserGesture?: boolean;
};

export type StartInterviewDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  profile: { isAlphaTester?: boolean; inviteCode?: string | null } | null | undefined;
  interviewAttemptBootstrap: InterviewAttemptBootstrap;
  audioRecorder: {
    markWebMicPermissionGranted: () => void;
    requestPermission: () => Promise<boolean>;
    resetWebMicInputFallbackState: () => void;
  };
  speakTextSafe: (
    text: string,
    opts?: Record<string, unknown>,
  ) => Promise<void>;
  notifyScenarioStarted: (
    scenario: 1 | 2 | 3,
    messages: { role: string; content: string; scenarioNumber?: number }[],
    opts?: { allowMessageHistoryShrink?: boolean },
  ) => Promise<void>;
  resetInterviewProgressRefs: () => void;
  interruptAllInterviewTtsOutput: () => void;
  startInterviewInFlightRef: MutableRefObject<boolean>;
  setInterviewStartInFlight: (v: boolean) => void;
  hasResumedRef: MutableRefObject<boolean>;
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  interviewStatusRef: MutableRefObject<string>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  lastHeadphoneProbeRef: MutableRefObject<HeadphoneProbeResult | null>;
  setAudioRouteKind: (kind: AudioRouteKind) => void;
  lastAudioRouteFingerprintRef: MutableRefObject<string | null>;
  setMicError: React.Dispatch<React.SetStateAction<string | null>>;
  setVoiceState: React.Dispatch<
    React.SetStateAction<'idle' | 'listening' | 'processing' | 'speaking' | 'recording'>
  >;
  setMicPermission: React.Dispatch<React.SetStateAction<'granted' | 'denied' | 'prompt' | 'unavailable'>>;
  setStatus: React.Dispatch<React.SetStateAction<InterviewSessionStatus>>;
  setInterviewStatus: React.Dispatch<
    React.SetStateAction<
      'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'
    >
  >;
  setMessages: React.Dispatch<React.SetStateAction<{ role: string; content: string; [key: string]: unknown }[]>>;
  currentMessagesRef: MutableRefObject<{ role: string; content: string; [key: string]: unknown }[]>;
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
  lastVoiceTurnLanguageRef: MutableRefObject<string | null>;
  lastVoiceTurnConfidenceRef: MutableRefObject<number | null>;
  currentScenarioRef: MutableRefObject<number | null>;
  setSessionLogPlatform: (platform: SessionPlatform | null) => void;
  setAudioSessionDeviceSnapshot: (snapshot: DeviceSnapshot) => void;
  setLastInterviewDeviceEnvironment: (env: InterviewDeviceEnvironmentPayload) => void;
  setSessionAudioRoutes: (inputRoute: string, outputRoute: SessionOutputRouteLabel) => void;
  setSessionAudioHealthNotice: React.Dispatch<React.SetStateAction<string | null>>;
};

export type InterviewSessionLifecycleDeps = HandleResumeDeps &
  StartInterviewDeps & {
    isAdmin: boolean;
    isInterviewAppRoute: boolean;
    status: InterviewSessionStatus;
    interviewStatus:
      | 'loading'
      | 'not_started'
      | 'in_progress'
      | 'preparing_results'
      | 'under_review'
      | 'congratulations'
      | 'analysis';
    onboardingAutoStartRef: MutableRefObject<boolean>;
  };
