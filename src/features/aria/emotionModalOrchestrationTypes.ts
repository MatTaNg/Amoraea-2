import type { MutableRefObject } from 'react';

import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { PendingEmotionModalTransition } from '@features/aria/emotionRecognitionInterview';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

export type EmotionModalAfterScenarioTransitionOpts = {
  transitionText?: string;
  priorScenario?: 1 | 2 | 3 | null;
  /**
   * Boundary reflection / transition lead already finished (or was streamed under mute).
   * Open the emotion modal without waiting for the muted parallel-stream tail or stale TTS locks.
   */
  afterBeforeModalPlayback?: boolean;
};

export type EmotionModalOrchestrationDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  emotionItemsComplete: boolean;
  status: InterviewSessionStatus;
  voiceState: VoiceState;
  emotionModalVisible: boolean;
  emotionModalItemIndex: number;
  statusRef: MutableRefObject<InterviewSessionStatus>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  emotionItemResponsesRef: MutableRefObject<string[]>;
  emotionModalResolveRef: MutableRefObject<(() => void) | null>;
  emotionModalPendingTransitionRef: MutableRefObject<boolean>;
  emotionModalOpenForIndexRef: MutableRefObject<number>;
  emotionModalTimeoutRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  emotionModalShownForScenarioRef: MutableRefObject<Set<1 | 2 | 3>>;
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
  maybeAwaitEmotionAfterScenarioTransitionRef: MutableRefObject<(sn: 1 | 2 | 3) => Promise<void>>;
  runEmotionModalAfterScenarioTransitionRef: MutableRefObject<
    (scenarioNum: 1 | 2 | 3, opts?: EmotionModalAfterScenarioTransitionOpts) => Promise<void>
  >;
  tryRunEmotionModalFromScenarioTransitionRef: MutableRefObject<
    (params: {
      completedScenario: 1 | 2 | 3;
      transitionText: string;
      priorScenario: 1 | 2 | 3 | null;
      source: string;
    }) => Promise<void>
  >;
  setEmotionItemResponses: React.Dispatch<React.SetStateAction<string[]>>;
  setEmotionItemsComplete: React.Dispatch<React.SetStateAction<boolean>>;
  setEmotionModalVisible: (v: boolean) => void;
  setEmotionModalItemIndex: React.Dispatch<React.SetStateAction<number>>;
};
