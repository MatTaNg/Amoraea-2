import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';
import type {
  PendingGestureRestoreSpeakEntry,
  VoiceState,
} from '@features/aria/hooks/useAriaInterviewSession';

export type InterviewMicLifecycleDeps = {
  navigation: { addListener: (event: string, callback: () => void) => () => void };
  userId: string;
  userIdRef: React.MutableRefObject<string>;
  voiceState: VoiceState;
  interviewStatus: string;
  interviewStatusRef: React.MutableRefObject<string>;
  useMediaRecorderPath: boolean;
  audioRecorder: {
    isRecording: boolean;
    reinitializeMicrophoneSession: () => Promise<boolean>;
    stopRecording: () => void | Promise<void>;
  };
  applyRouteProbeAfterResume: (source: 'app_resume' | 'media_services_reset') => Promise<void>;
  setMicSessionRecovering: (v: boolean) => void;
  setMicNeedsReconnect: (v: boolean) => void;
  setLateStartIdleCueVisible: (v: boolean) => void;
  setPreInitMeterLevel: (v: number) => void;
  setVoiceState: (state: VoiceState) => void;
  setEmotionModalVisible: (v: boolean) => void;
  setWebTabRestoreOverlayVisible: (v: boolean) => void;
  gestureContextLostAtRef: React.MutableRefObject<{
    atMs: number;
    reason: GestureContextLostReason;
  } | null>;
  recognitionRef: React.MutableRefObject<{ stop: () => void } | null>;
  parallelStreamingTtsRef: React.MutableRefObject<{ cancelRequested: boolean }>;
  webTtsSpeakGenerationRef: React.MutableRefObject<number>;
  interviewSessionAttemptIdRef: React.MutableRefObject<string | null>;
  interviewSessionIdRef: React.MutableRefObject<string>;
  currentInterviewMomentRef: React.MutableRefObject<number>;
  currentScenarioRef: React.MutableRefObject<number | null>;
  lastQuestionTextRef: React.MutableRefObject<string | null>;
  emotionModalPendingTransitionRef: React.MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: React.MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  webTtsTabInterruptPendingReplayRef: React.MutableRefObject<boolean>;
  mobileTabHideLetPlaybackContinueRef: React.MutableRefObject<boolean>;
  needsGestureRestoreRef: React.MutableRefObject<boolean>;
  syncInterviewTtsAfterScreenReturn: () => void;
  dismissTabRestoreOverlay: () => void;
  ensureWebGestureFlushListener: () => void;
  interruptAllWebInterviewTtsOutput: () => void;
  stopElevenLabsPlayback: () => Promise<void>;
  isWebInterviewPlaybackAudiblyActive: () => boolean;
  armMobileWebBackgroundTtsContinue: () => boolean;
  isMobileWebInterviewTtsSessionActive: () => boolean;
  hasWebInterviewHtmlAudioTabResumePending: () => boolean;
  holdTabStashedHtmlAudioForGestureResume: () => void;
  hasInterviewClosingSpeakInFlightForSession: (key: string | null) => boolean;
  classifyInterviewQuestionType: (
    text: string,
  ) => 'analysis' | 'repair' | 'probe' | 'personal' | 'unknown';
};
