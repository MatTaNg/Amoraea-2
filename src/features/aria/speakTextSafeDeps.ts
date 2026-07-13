import type { MutableRefObject } from 'react';

import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewTtsSpeakOpts, InterviewTtsSpeakOutcome } from '@features/aria/interviewTtsSpeakOptions';
import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';

export type WebTtsUtteranceReplayOptions = {
  interviewSpeechRole?: 'assistant_response';
  telemetrySource?: import('@features/aria/telemetry/tsAutoplayTelemetry').TtsTelemetrySource;
  skipInterviewSpeechAdvance?: boolean;
  skipQuestionDeliveredTelemetry?: boolean;
  skipLastQuestionRef?: boolean;
  allowDuplicateConsecutiveTts?: boolean;
  silent?: boolean;
  skipGestureGate?: boolean;
  ttsTriggerSource?:
    | 'gesture_handler'
    | 'effect'
    | 'callback'
    | 'timeout'
    | 'preauthorized_element';
};

export type SpeakTextSafeOptions = {
  silent?: boolean;
  interviewSpeechRole?: 'assistant_response';
  telemetrySource?: import('@features/aria/telemetry/tsAutoplayTelemetry').TtsTelemetrySource;
  ttsPipeline?: 'parallel_streaming';
  skipQuestionDeliveredTelemetry?: boolean;
  skipInterviewSpeechAdvance?: boolean;
  skipQuestionTiming?: boolean;
  skipLastQuestionRef?: boolean;
  allowDuplicateConsecutiveTts?: boolean;
  skipClosingSessionDedup?: boolean;
  skipScenarioAContemptProbeSessionDedup?: boolean;
  skipPcmStream?: boolean;
  prefetchedMpegArrayBuffer?: ArrayBuffer;
  skipGestureGate?: boolean;
  ttsTriggerSource?:
    | 'gesture_handler'
    | 'effect'
    | 'callback'
    | 'timeout'
    | 'preauthorized_element';
  immediateWebPlaybackElement?: HTMLAudioElement;
  greetingAlreadyAudible?: boolean;
};

export type SpeakTextSafeDeps = {
  userId: string;
  mobileWebTapToBeginDone: boolean;
  setVoiceState: (state: VoiceState) => void;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  setWebDesktopPendingTtsGestureOverlay: (visible: boolean) => void;
  setTtsPlaybackReliabilityNotice: (notice: string | null) => void;
  setLastTtsCompletionCallbackMs: (ms: number) => void;
  speak: (text: string, speakOpts?: InterviewTtsSpeakOpts) => Promise<InterviewTtsSpeakOutcome>;
  applyInterviewSpeechComplete: (rawText: string) => void;
  ensureWebGestureFlushListener: () => void;
  awaitTtsScreenReadyGate: (reason: string) => Promise<void>;
  stopElevenLabsPlayback: () => Promise<void>;
  webSpeechShouldDeferToUserGesture: () => boolean;
  rearmWebMicPreInitAfterTtsPlaybackComplete: () => Promise<void>;
  scheduleWebMicPreInitRefreshAfterTtsCompletes: () => void;
  referenceCardShouldUpdateOnPlaybackStart: (rawText: string) => boolean;
  persistInterviewAttemptSessionLifecycle: (
    attemptId: string | null | undefined,
    lifecycle: 'in_progress' | 'completed',
  ) => Promise<void>;
  webTtsSpeakGenerationRef: MutableRefObject<number>;
  currentInterviewMomentRef: MutableRefObject<number>;
  currentScenarioRef: MutableRefObject<1 | 2 | 3>;
  s2RepairProbeDeliveredRef: MutableRefObject<boolean>;
  s3RepairProbeDeliveredRef: MutableRefObject<boolean>;
  interviewNameRef: MutableRefObject<string | null>;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  lastSuccessfulTtsDeliveredPreviewRef: MutableRefObject<string>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  scenarioAContemptProbePlaybackConfirmedRef: MutableRefObject<boolean>;
  showScenarioCardCanonicalPlaybackConfirmedKindsRef: MutableRefObject<
    import('@features/aria/showScenarioCardCanonicalTts').ShowScenarioCardCanonicalPlaybackConfirmedKinds
  >;
  scenarioAContemptProbeTtsDeliveredSessionRef: MutableRefObject<boolean>;
  lastQuestionTextRef: MutableRefObject<string>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  tabVisibilityGestureLossPendingRef: MutableRefObject<boolean>;
  gestureContextLostAtRef: MutableRefObject<{ atMs: number; reason: GestureContextLostReason } | null>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  interviewStatusRef: MutableRefObject<string>;
  applyReferenceCardFromAssistantSpeechRef: MutableRefObject<(rawText: string) => void>;
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  webTtsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  firstScenarioLifecyclePersistedRef: MutableRefObject<boolean>;
  ttsSessionHardFailureCountRef: MutableRefObject<number>;
  timingRef: MutableRefObject<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>;
  pendingWebSpeechForGestureRef: MutableRefObject<string | null>;
  recordInterviewAssistantDeliveryForMetaExemptionRef: MutableRefObject<(deliveredQuestionText: string) => void>;
  s1ContemptFixVersion: number | string;
};

export type SpeakTextSafeFn = (text: string, options?: SpeakTextSafeOptions) => Promise<void>;
