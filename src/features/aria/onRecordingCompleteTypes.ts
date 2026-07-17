import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { TranscribeSafeResult } from '@features/aria/transcribeSafeTypes';

export type OnRecordingCompleteMeta = {
  peakMeteringDb: number | null;
  recordingCapped?: boolean;
  webRecordingTiming?: {
    tapIntentAtMs: number;
    mediaRecorderStartAtMs: number;
    recorderPreInitialized: boolean;
    recorderStartCalledMs: number;
    recorderStopCalledMs?: number;
    firstChunkReceivedMs: number | null;
    chunkLatencyMs: number | null;
    preInitFallbackReason: string | null;
    streamReactivated: boolean;
    preInitTriggeredDuring: string | null;
  };
};

export type OnRecordingCompleteParams = {
  blob: Blob;
  nativeUri: string | null;
  meta?: OnRecordingCompleteMeta;
};

export type OnRecordingCompleteDeps = {
  userId: string;
  isInterviewAppRoute: boolean;
  messages: ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>;
  recordingCompleteInFlightRef: React.MutableRefObject<boolean>;
  recordingPeakMeteringRef: React.MutableRefObject<number | null>;
  lastRecordingVadSpeechDetectedRef: React.MutableRefObject<boolean | null>;
  recordingJustFinishedBeforeNextTtsRef: React.MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: React.MutableRefObject<boolean>;
  micTapWhileTtsActiveRef: React.MutableRefObject<boolean>;
  consecutiveDigitalSilenceForMicFallbackRef: React.MutableRefObject<number>;
  micFallbackSuccessPendingRef: React.MutableRefObject<boolean>;
  pendingRecordingRestartAfterVadBypassRef: React.MutableRefObject<boolean>;
  transcribeBufferMetaRef: React.MutableRefObject<{
    audio_duration_ms: number;
    buffer_size_bytes: number;
  } | null>;
  whisperRatioReaskAttemptsForCurrentQuestionRef: React.MutableRefObject<number>;
  interviewSessionIdRef?: React.MutableRefObject<string>;
  metaCommentAckAwaitingSubstantiveBaselineSeqRef: React.MutableRefObject<number | null>;
  substantiveInterviewQuestionDeliveredSeqRef: React.MutableRefObject<number>;
  recoveryAssistantSpokenAtSubstantiveSeqRef: React.MutableRefObject<number>;
  lastVoiceTurnLanguageRef: React.MutableRefObject<string | null>;
  lastVoiceTurnConfidenceRef: React.MutableRefObject<number | null>;
  turnAudioIndexRef: React.MutableRefObject<number>;
  lastUserTurnAudioDurationMsRef: React.MutableRefObject<number | null>;
  interviewNameRef: React.MutableRefObject<string | null>;
  interviewNameReaskPendingRef: React.MutableRefObject<boolean>;
  lastQuestionTextRef: React.MutableRefObject<string | null>;
  currentInterviewMomentRef: React.MutableRefObject<number>;
  currentScenarioRef: React.MutableRefObject<number | null>;
  releaseRecordingFnRef: React.MutableRefObject<
    | ((opts?: {
        momentNumber?: number;
        logCleanupFailed?: (payload: { message: string; moment_number?: number }) => void;
      }) => Promise<void>)
    | null
  >;
  audioRecorder: {
    getLastWebMicCaptureDeviceId: () => string | null | undefined;
    switchWebInputToDefaultDevice: () => Promise<boolean>;
  };
  setMicEnginePrimed: (v: boolean) => void;
  setVoiceState: (state: VoiceState) => void;
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>;
  deleteTurnAudioFile: (nativeUri: string | null) => Promise<void>;
  deliverRecordingRetryLine: (
    message: string,
    speakOpts?: { telemetrySource?: 'turn' | 'other'; skipLastQuestionRef?: boolean },
  ) => Promise<void>;
  transcribeSafe: (blob: Blob, nativeUri: string | null) => Promise<TranscribeSafeResult>;
  speakTextSafe: (
    text: string,
    opts?: { telemetrySource?: 'turn' | 'other'; skipLastQuestionRef?: boolean },
  ) => Promise<void>;
  processTurnAudioWithRetry: (args: {
    audioBlob: Blob;
    nativeUri: string | null;
    turnIndex: number;
    scenarioNumber: number | null;
  }) => Promise<void>;
  processUserSpeech: (userText: string) => void | Promise<void>;
  resumeLoadingFlowActiveRef: React.MutableRefObject<boolean>;
  resumeOfferWelcomeTtsRef: React.MutableRefObject<boolean>;
  resumeRepeatChoicePendingRef: React.MutableRefObject<boolean>;
  interviewUserTurnEpochRef: React.MutableRefObject<number>;
  interviewSessionAttemptIdRef?: React.MutableRefObject<string>;
};
