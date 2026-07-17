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
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  committedScenarioRef: MutableRefObject<ActiveScenario | null>;
  isAssistantBubbleForTranscript: (m: { role: string; content?: string }) => boolean;
  setInterviewUiPhase: (phase: 'pre_scenario' | 'scenario_transitioning' | 'scenario_active') => void;
  setReferenceCardPrompt: (prompt: string | null) => void;
  setReferenceCardScenario: (scenario: ActiveScenario | null) => void;
  pendingEmotionModalTransitionRef?: MutableRefObject<PendingEmotionModalTransition | null>;
  emotionModalShownForScenarioRef?: MutableRefObject<Set<1 | 2 | 3>>;
};
