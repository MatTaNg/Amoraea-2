import type { MutableRefObject } from 'react';

export type HandleSendTypedDeps = {
  userId: string | undefined;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  lastVoiceTurnLanguageRef: MutableRefObject<string | null>;
  lastVoiceTurnConfidenceRef: MutableRefObject<number | null>;
  touchActivity: () => void;
  setTypedAnswer: React.Dispatch<React.SetStateAction<string>>;
  setMicWarning: React.Dispatch<React.SetStateAction<string | null>>;
  stopElevenLabsSpeech: () => void;
  processUserSpeech: (spokenText: string) => void | Promise<void>;
};

export type HandleSendTypedParams = {
  text: string;
};
