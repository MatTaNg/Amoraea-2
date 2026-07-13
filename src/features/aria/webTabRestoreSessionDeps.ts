import type { MutableRefObject } from 'react';

import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import type { InterviewScenarioRefSyncTarget } from '@features/aria/interviewScenarioRefSync';
import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';
import type { PendingEmotionModalTransition } from '@features/aria/emotionModalTransitionOrchestration';
import type { EmotionModalAfterScenarioTransitionOpts } from '@features/aria/emotionModalOrchestrationTypes';

export type InterviewWebTabRestoreSessionDeps = {
  userIdRef: MutableRefObject<string | null>;
  voiceStateRef: MutableRefObject<VoiceState>;
  setVoiceState: (state: VoiceState) => void;
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  setMobileWebTapToBeginDone: (done: boolean) => void;
  setEmotionModalVisible: (visible: boolean) => void;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  webTabRestoreReplayInFlightRef: MutableRefObject<boolean>;
  webTabRestoreTapSessionRef: MutableRefObject<number>;
  webTabRestoreDeliveredNormRef: MutableRefObject<string | null>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  webTtsSpeakGenerationRef: MutableRefObject<number>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  webTtsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
  tabRestoreInFlightWithoutPlaybackSinceMsRef: MutableRefObject<number | null>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  mobileTabHideLetPlaybackContinueRef: MutableRefObject<boolean>;
  mobileTabHideBackgroundUtteranceRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string>;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  emotionModalPendingTransitionRef: MutableRefObject<boolean>;
  pendingEmotionModalTransitionRef: MutableRefObject<PendingEmotionModalTransition | null>;
  emotionModalShownForScenarioRef: MutableRefObject<Set<1 | 2 | 3>>;
  runEmotionModalAfterScenarioTransition?: (
    scenarioNum: 1 | 2 | 3,
    opts?: EmotionModalAfterScenarioTransitionOpts,
  ) => Promise<void>;
  scenarioRefSync?: InterviewScenarioRefSyncTarget;
  gestureContextLostAtRef: MutableRefObject<{ atMs: number; reason: GestureContextLostReason } | null>;
  interviewStatusRef: MutableRefObject<string>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  currentMessagesRef: MutableRefObject<
    ReadonlyArray<{ role: string; content?: string; isWelcomeBack?: boolean }>
  >;
  resumeRepeatPrefetchMpegRef: MutableRefObject<{ text: string; buffer: ArrayBuffer } | null>;
  speakTextSafe: (text: string, options?: SpeakTextSafeOptions) => Promise<void>;
  dismissTabRestoreOverlay: (opts?: { deliveredText?: string | null }) => void;
  dismissAfterAndroidBackgroundPlaybackEnd: (opts?: { force?: boolean }) => void;
  ensureWebGestureFlushListener: () => void;
  detachWebGestureFlushListener: () => void;
  interruptAllWebInterviewTtsOutput: (opts?: { preserveTabRestorePending?: boolean }) => void;
  clearStaleWebInterviewTtsRuntimeLocks: (opts?: { recoverVoiceUi?: boolean; force?: boolean }) => void;
  queueMobileWebHtmlResumeAfterScreenReturn: () => boolean;
  applyInterviewSpeechComplete: (rawText: string) => void;
};
