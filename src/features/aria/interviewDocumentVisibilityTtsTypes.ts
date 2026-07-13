import type { MutableRefObject } from 'react';

import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { PendingEmotionModalTransition } from '@features/aria/emotionModalTransitionOrchestration';

export type InterviewDocumentVisibilityTtsDeps = {
  docVisibilityWasHiddenRef: MutableRefObject<boolean>;
  interruptInterviewTtsForDocumentHidden: () => void;
  interviewStatusRef: MutableRefObject<string>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  currentMessagesRef: MutableRefObject<Array<{ role: string; content: string }>>;
  syncInterviewTtsAfterScreenReturn: () => void;
  webTabRestoreReplayInFlightRef: MutableRefObject<boolean>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  tabVisibilityGestureLossPendingRef: MutableRefObject<boolean>;
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  ensureWebGestureFlushListener: () => void;
  handleWebTabGestureRestoreTapRef: MutableRefObject<(() => void) | null>;
  mobileTabHideLetPlaybackContinueRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
  hasWebInterviewHtmlAudioTabResumePending: () => boolean;
  isWebInterviewPlaybackAudiblyActive: () => boolean;
  committedScenarioRef: MutableRefObject<ActiveScenario | null>;
  isAssistantBubbleForTranscript: (m: { role: string; content?: string }) => boolean;
  setInterviewUiPhase: (phase: 'pre_scenario' | 'scenario_transitioning' | 'scenario_active') => void;
  setReferenceCardPrompt: (prompt: string | null) => void;
  setReferenceCardScenario: (scenario: ActiveScenario | null) => void;
  pendingEmotionModalTransitionRef?: MutableRefObject<PendingEmotionModalTransition | null>;
  emotionModalShownForScenarioRef?: MutableRefObject<Set<1 | 2 | 3>>;
};
