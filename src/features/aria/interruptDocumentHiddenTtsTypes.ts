import type { MutableRefObject } from 'react';

import type { VoiceState, PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { PendingEmotionModalTransition } from '@features/aria/emotionModalTransitionOrchestration';

export type InterruptInterviewTtsForDocumentHiddenDeps = {
  interviewStatusRef: MutableRefObject<string>;
  userIdRef: MutableRefObject<string | undefined>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  isWebInterviewPlaybackSurfaceActive: () => boolean;
  gestureContextLostAtRef: MutableRefObject<{ atMs: number; reason: string } | null>;
  isMobileWebInterviewTtsSessionActive: () => boolean;
  armMobileWebBackgroundTtsContinue: () => boolean;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  webTabRestoreDeliveredNormRef: MutableRefObject<string | null>;
  webTabRestoreReplayInFlightRef: MutableRefObject<boolean>;
  mobileTabHideLetPlaybackContinueRef: MutableRefObject<boolean>;
  mobileTabHideBackgroundUtteranceRef: MutableRefObject<string | null>;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  tabVisibilityGestureLossPendingRef: MutableRefObject<boolean>;
  webTtsSpeakGenerationRef: MutableRefObject<number>;
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  setTtsPlaybackActive: (active: boolean) => void;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
  emotionModalShownForScenarioRef: MutableRefObject<Set<1 | 2 | 3>>;
};
