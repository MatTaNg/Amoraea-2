import type { MutableRefObject } from 'react';

import type { SpeakTextSafeFn } from '@features/aria/speakTextSafeDeps';

export type WebResumeWelcomeTapDeps = {
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  interviewStatusRef: MutableRefObject<string>;
  currentMessagesRef: MutableRefObject<Array<{ role: string; content: string }>>;
  webResumeWelcomeTapHandledRef: MutableRefObject<boolean>;
  webResumeWelcomeTapPendingRef: MutableRefObject<boolean>;
  setWebResumeWelcomeTapPending: (v: boolean) => void;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
  pendingWebSpeechForGestureRef: MutableRefObject<string | null>;
  detachWebGestureFlushListener: () => void;
  setWebDesktopPendingTtsGestureOverlay: (v: boolean) => void;
  setMobileWebTapToBeginDone: (v: boolean) => void;
  emotionModalPendingTransitionRef: MutableRefObject<boolean>;
  setEmotionModalVisible: (v: boolean) => void;
  resumeEmotionCatchUpIndicesRef: MutableRefObject<number[] | null>;
  awaitEmotionModalForIndex: (itemIndex: number) => Promise<void>;
  resumeWelcomeMessageRef: MutableRefObject<string>;
  speakTextSafe: SpeakTextSafeFn;
  pendingScenarioIntroAfterResumeWelcomeRef: MutableRefObject<string | null>;
  resumeEmotionAfterModalTextRef: MutableRefObject<string | null>;
  resumeLastAssistantTextRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
};
