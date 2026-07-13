import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

export type HandleRecordingErrorDeps = {
  useWebCopy: boolean;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  setMessages: React.Dispatch<
    React.SetStateAction<Array<{ role: string; content: string }>>
  >;
  speakTextSafe: (
    text: string,
    opts?: {
      telemetrySource?: 'turn' | 'other';
      skipLastQuestionRef?: boolean;
    },
  ) => Promise<void>;
};
