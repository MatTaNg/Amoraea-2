import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

export type InterviewMicLifecycleDeps = {
  navigation: { addListener: (event: string, callback: () => void) => () => void };
  userId: string;
  userIdRef: React.MutableRefObject<string>;
  voiceState: VoiceState;
  interviewStatus: string;
  interviewStatusRef: React.MutableRefObject<string>;
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
  parallelStreamingTtsRef: React.MutableRefObject<{ cancelRequested: boolean }>;
  ttsSpeakGenerationRef: React.MutableRefObject<number>;
  interviewSessionAttemptIdRef: React.MutableRefObject<string | null>;
  interviewSessionIdRef: React.MutableRefObject<string>;
  currentInterviewMomentRef: React.MutableRefObject<number>;
  currentScenarioRef: React.MutableRefObject<number | null>;
  lastQuestionTextRef: React.MutableRefObject<string | null>;
  emotionModalPendingTransitionRef: React.MutableRefObject<boolean>;
  interruptAllInterviewTtsOutput: () => void;
  stopElevenLabsPlayback: () => Promise<void>;
  hasInterviewClosingSpeakInFlightForSession: (key: string | null) => boolean;
  classifyInterviewQuestionType: (
    text: string,
  ) => 'analysis' | 'repair' | 'probe' | 'personal' | 'unknown';
};
