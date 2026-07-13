import type { MutableRefObject } from 'react';

export type InterviewWebSpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: (e: unknown) => void;
  onerror: (e: { error: string }) => void;
};

export type InterviewWebSpeechRecognitionDeps = {
  useMediaRecorderPath: boolean;
  recognitionRef: MutableRefObject<InterviewWebSpeechRecognitionInstance | { start(): void; stop(): void } | null>;
  setCurrentTranscript: React.Dispatch<React.SetStateAction<string>>;
  transcriptAtReleaseRef: MutableRefObject<string>;
  setMicError: React.Dispatch<React.SetStateAction<string | null>>;
  setMicWarning: React.Dispatch<React.SetStateAction<string | null>>;
};
