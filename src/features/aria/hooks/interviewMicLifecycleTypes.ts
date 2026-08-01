import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

export type InterviewMicLifecycleDeps = {
  navigation: { addListener: (event: string, callback: () => void) => () => void };
  userId: string;
  userIdRef: React.MutableRefObject<string>;
  voiceState: VoiceState;
  interviewStatus: string;
  interviewStatusRef: React.MutableRefObject<string>;
  resumeLoadingFlowActiveRef: React.MutableRefObject<boolean>;
  audioRecorder: {
    isRecording: boolean;
    reinitializeMicrophoneSession: () => Promise<boolean>;
    stopRecording: () => void | Promise<void>;
    releaseRecordingInstance: () => Promise<void>;
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
  resumeLastAssistantTextRef: React.MutableRefObject<string | null>;
  resumeWelcomeMessageRef: React.MutableRefObject<string | null>;
  currentMessagesRef: React.MutableRefObject<Array<{ role: string; content?: string | null }>>;
  interviewNameRef: React.MutableRefObject<string | null>;
  resumeInPersonalPartRef: React.MutableRefObject<boolean>;
  emotionModalPendingTransitionRef: React.MutableRefObject<boolean>;
  resumeOfferWelcomeTtsRef: React.MutableRefObject<boolean>;
  resumeRepeatChoicePendingRef: React.MutableRefObject<boolean>;
  processUserSpeech?: (text: string) => void | Promise<void>;
  speakTextSafe?: (text: string, opts?: Record<string, unknown>) => Promise<void>;
  interruptAllInterviewTtsOutput: () => void;
  stopElevenLabsPlayback: () => Promise<void>;
  hasInterviewClosingSpeakInFlightForSession: (key: string | null) => boolean;
  classifyInterviewQuestionType: (
    text: string,
  ) => 'analysis' | 'repair' | 'probe' | 'personal' | 'unknown';
  interviewUserTurnEpochRef?: React.MutableRefObject<number>;
  flushInterviewProgressForNavigationAway?: () => void;
};
