import type { MutableRefObject } from 'react';

import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { Moment5ClientScoringMetadata } from '@features/aria/moment5AccountabilityScoringPrompt';

export type ParallelStreamTextState = {
  full: string;
  spokenStarted: boolean;
  closingSpoken: boolean;
};

export type ClaudeParallelStreamInterviewMessage = {
  role: string;
  content?: string;
  isWelcomeBack?: boolean;
  scenarioNumber?: number;
};

export type ClaudeParallelStreamTtsCallParams = {
  apiUrl: string;
  headers: Record<string, string>;
  requestBody: Record<string, unknown>;
  participantFirstNameForSpoken: string;
  muteParallelTtsForScenarioAContemptProbeStream: boolean;
  muteParallelTtsForS3ToM4HandoffStream: boolean;
  metaFrustrationFirstSignalBuffered: boolean;
  bufferAllStreamTtsForMoment5Close: boolean;
  messagesToUse: ReadonlyArray<ClaudeParallelStreamInterviewMessage>;
  trimmed: string;
  elongatingSuppressedForUserTurn: boolean;
  specificEmmaLineAlreadyAddressed: boolean;
  shouldForceScenarioAContemptProbe: boolean;
  allowScenarioARepairAfterContemptAnswer: boolean;
  shouldForceScenarioBJamesRepairProbe: boolean;
  shouldForceScenarioCRepairProbe: boolean;
  shouldForceScenarioCSophiePerspectiveProbe: boolean;
  shouldForceMoment4ThresholdProbe: boolean;
  userScenarioTag: number;
  hadPriorSubstantiveAnswerForFrustrationOffer: boolean;
  textToParallelStream: ParallelStreamTextState;
};

export type ClaudeParallelStreamTtsCallDeps = {
  userId: string;
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
  pendingScenarioAContemptProbeStreamMuteRef: MutableRefObject<boolean>;
  pendingS3ToM4HandoffStreamMuteRef: MutableRefObject<boolean>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  webTtsSpeakGenerationRef: MutableRefObject<number>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  webTtsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<import('@features/aria/hooks/useAriaInterviewSession').PendingGestureRestoreSpeakEntry | null>;
  currentInterviewMomentRef: MutableRefObject<number>;
  currentScenarioRef: MutableRefObject<number>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  interviewNameRef: MutableRefObject<string | null>;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
  scenarioAContemptProbeAskedRef: MutableRefObject<boolean>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef: MutableRefObject<
    import('@features/aria/showScenarioCardCanonicalTts').ShowScenarioCardCanonicalPlaybackConfirmedKinds
  >;
  scenarioARepairQuestionAskedRef: MutableRefObject<boolean>;
  moment5PostPromptUserTurnCountRef: MutableRefObject<number>;
  moment5QuestionDeliveredRef: MutableRefObject<boolean>;
  moment5PrimaryAnchorDeliveredSessionRef: MutableRefObject<boolean>;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
  moment5ResolutionDeliveredRef: MutableRefObject<boolean>;
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
  moment5ClientScoringMetaRef: MutableRefObject<Moment5ClientScoringMetadata | null>;
  moment4ClientSpecificityProbeInjectedRef: MutableRefObject<string | null>;
  moment5SpecificityRedirectIssuedRef: MutableRefObject<string | null>;
  elongatingProbeFiredRef: MutableRefObject<boolean>;
  lastQuestionTextRef: MutableRefObject<string>;
  recordInterviewAssistantDeliveryForMetaExemptionRef: MutableRefObject<(text: string) => void>;
  committedScenarioRef: MutableRefObject<import('@app/screens/UserInterviewLayout').ActiveScenario | null>;
  applyReferenceCardFromAssistantSpeechRef: MutableRefObject<(text: string) => void>;
  speakTextSafe: (text: string, options?: SpeakTextSafeOptions) => Promise<void>;
  setVoiceState: (state: VoiceState) => void;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  setReferenceCardPrompt: (prompt: string | null) => void;
  setReferenceCardScenario: (
    scenario: import('@app/screens/UserInterviewLayout').ActiveScenario | null,
  ) => void;
  setInterviewUiPhase: (
    phase: import('@features/aria/sessionLifecycleTypes').InterviewUiPhase,
  ) => void;
  awaitTtsScreenReadyGate: (source: string) => Promise<void>;
  prepareInterviewTtsPlayback: (
    source: string,
    opts?: { afterRecording?: boolean },
  ) => Promise<void>;
  stopElevenLabsPlayback: () => Promise<void>;
  scheduleWebMicPreInitRefreshAfterTtsCompletes: () => void;
  referenceCardShouldUpdateOnPlaybackStart: (text: string) => boolean;
  ensureCompletedScenarioScored?: (
    completedScenario: 1 | 2 | 3,
    messagesForScoring: { role: string; content: string }[],
    trigger: string,
  ) => void;
};

export type ClaudeParallelStreamTtsCallResult = {
  content?: Array<{ text?: string }>;
};
