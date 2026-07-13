import type { MutableRefObject } from 'react';

import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewMomentIndex } from '@features/aria/interviewProgressSync';
import type { SpeakTextSafeFn } from '@features/aria/speakTextSafeDeps';

export type DeliverRecordingRetryLineSpeakOpts = {
  telemetrySource?: 'turn' | 'other';
  skipLastQuestionRef?: boolean;
};

export type DeliverRecordingRetryLineParams = {
  message: string;
  speakOpts?: DeliverRecordingRetryLineSpeakOpts;
};

export type DeliverRecordingRetryLineDeps = {
  lastRecordingRetryDeliveredNormRef: MutableRefObject<string | null>;
  lastRecordingRetryDeliveredAtMsRef: MutableRefObject<number>;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  currentScenarioRef: MutableRefObject<1 | 2 | 3>;
  currentInterviewMomentRef: MutableRefObject<InterviewMomentIndex>;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  speakTextSafe: SpeakTextSafeFn;
  commitInterviewMessages: (
    updater: (
      prev: Array<{ role: string; content: string; scenarioNumber?: number; interviewMoment?: number }>,
    ) => Array<{ role: string; content: string; scenarioNumber?: number; interviewMoment?: number }>,
  ) => void;
};
