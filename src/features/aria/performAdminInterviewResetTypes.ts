import type { MutableRefObject } from 'react';

import type { InterviewUiPhase } from '@features/aria/sessionLifecycleTypes';
import type { PostInterviewRatingKey } from '@features/aria/performInterviewRetakeTypes';

export type PerformAdminInterviewResetAudioRecorder = {
  isRecording: boolean;
  stopRecording: () => Promise<void>;
  resetWebMicInputFallbackState: () => void;
};

export type PerformAdminInterviewResetDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  useMediaRecorderPath: boolean;
  audioRecorder: PerformAdminInterviewResetAudioRecorder;
  recognitionRef: MutableRefObject<{ start(): void; stop(): void } | null>;
  stopElevenLabsPlayback: () => Promise<void>;
  stopElevenLabsSpeech: () => void;
  clearInterviewFromStorage: (userId: string) => Promise<void>;
  setInterviewJustCompletedInSession: (v: boolean) => void;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  hasResumedRef: MutableRefObject<boolean>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  closingQuestionAskedRef: MutableRefObject<Record<1 | 2 | 3, boolean>>;
  closingQuestionAnsweredRef: MutableRefObject<Record<1 | 2 | 3, boolean>>;
  lastClosingQuestionScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  waitingForClosingAdditionRef: MutableRefObject<boolean | null>;
  lastAnsweredClosingScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  onboardingAutoStartRef: MutableRefObject<boolean>;
  currentScenarioRef: MutableRefObject<number>;
  timingRef: MutableRefObject<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>;
  lastQuestionTextRef: MutableRefObject<string>;
  transcriptAtReleaseRef: MutableRefObject<string>;
  pendingCompletionTranscriptRef: MutableRefObject<string | null>;
  waitingMessageIdRef: MutableRefObject<string | null>;
  committedScenarioRef: MutableRefObject<number | null>;
  isSpeakingRef: MutableRefObject<boolean>;
  responseTimingsRef: MutableRefObject<unknown[]>;
  probeLogRef: MutableRefObject<unknown[]>;
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>;
  setScenarioScores: React.Dispatch<React.SetStateAction<Record<number, unknown>>>;
  setClosingQuestionState: React.Dispatch<
    React.SetStateAction<Record<1 | 2 | 3, 'needed' | 'asked' | 'answered'>>
  >;
  setClosingQuestionPending: React.Dispatch<React.SetStateAction<boolean>>;
  setClosingQuestionScenario: React.Dispatch<React.SetStateAction<1 | 2 | 3 | null>>;
  setMicError: React.Dispatch<React.SetStateAction<string | null>>;
  setMicWarning: React.Dispatch<React.SetStateAction<string | null>>;
  setResults: React.Dispatch<React.SetStateAction<unknown>>;
  setAnalysisAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setInterviewLastCommittedAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  setPostInterviewRatings: React.Dispatch<
    React.SetStateAction<Record<PostInterviewRatingKey, number | null>>
  >;
  setPostInterviewComments: React.Dispatch<
    React.SetStateAction<Record<PostInterviewRatingKey, string>>
  >;
  setPostInterviewGeneralFeedback: React.Dispatch<React.SetStateAction<string>>;
  setHasSubmittedPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  setHighestScenarioReached: React.Dispatch<React.SetStateAction<number>>;
  setStageResults: React.Dispatch<React.SetStateAction<Array<{ stage: number; results: unknown }>>>;
  setTouchedConstructs: React.Dispatch<React.SetStateAction<number[]>>;
  setExchangeCount: React.Dispatch<React.SetStateAction<number>>;
  setIsWaiting: React.Dispatch<React.SetStateAction<boolean>>;
  setCurrentTranscript: React.Dispatch<React.SetStateAction<string>>;
  setTypedAnswer: React.Dispatch<React.SetStateAction<string>>;
  setUsedPersonalExamples: React.Dispatch<React.SetStateAction<boolean>>;
  setPendingCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  setInterviewUiPhase: React.Dispatch<React.SetStateAction<InterviewUiPhase>>;
  setReferenceCardScenario: React.Dispatch<React.SetStateAction<number | null>>;
  setReferenceCardPrompt: React.Dispatch<React.SetStateAction<string | null>>;
  setVoiceState: React.Dispatch<React.SetStateAction<'idle' | 'listening' | 'processing' | 'speaking'>>;
  resetInterviewProgressRefs: () => void;
  startInterview: (opts?: { fromUserGesture?: boolean }) => void | Promise<void>;
};
