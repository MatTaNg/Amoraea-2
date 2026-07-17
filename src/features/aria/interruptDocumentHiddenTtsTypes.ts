import type { MutableRefObject } from 'react';

import type { VoiceState, PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { PendingEmotionModalTransition } from '@features/aria/emotionModalTransitionOrchestration';

export type InterruptInterviewTtsForDocumentHiddenDeps = {
  interviewStatusRef: MutableRefObject<string>;
  userIdRef: MutableRefObject<string | undefined>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  isMobileWebInterviewTtsSessionActive: () => boolean;
  ttsUtteranceInFlightRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  webTabRestoreDeliveredNormRef: MutableRefObject<string | null>;
  ttsSpeakGenerationRef: MutableRefObject<number>;
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  setTtsPlaybackActive: (active: boolean) => void;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
  emotionModalShownForScenarioRef: MutableRefObject<Set<1 | 2 | 3>>;
};
