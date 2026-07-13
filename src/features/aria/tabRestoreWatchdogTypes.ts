import type { MutableRefObject } from 'react';

import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { WebActiveGestureOverlayKind } from '@features/aria/webInterviewGestureOverlay';

export type TabRestoreWatchdogDeps = {
  voiceStateRef: MutableRefObject<VoiceState>;
  webTabGestureRestoreOverlayRef: MutableRefObject<WebActiveGestureOverlayKind | false>;
  interviewStatusRef: MutableRefObject<string>;
  mobileTabHideLetPlaybackContinueRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  webTabRestoreReplayInFlightRef: MutableRefObject<boolean>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  staleWebTtsRuntimeLockSinceMsRef: MutableRefObject<number | null>;
  tabRestoreInFlightWithoutPlaybackSinceMsRef: MutableRefObject<number | null>;
  speakingWithoutPlaybackSinceMsRef: MutableRefObject<number | null>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  webTabRestoreDeliveredNormRef: MutableRefObject<string | null>;
  lastSuccessfulTtsTextNormalizedRef: MutableRefObject<string | null>;
  isWebInterviewPlaybackSurfaceActive: () => boolean;
  isWebInterviewPlaybackAudiblyActive: () => boolean;
  hasWebInterviewHtmlAudioTabResumePending: () => boolean;
  isWebInterviewMidUtteranceTabResumeActive: () => boolean;
  isInterviewerOutputActiveForMicGate: () => boolean;
  queueMobileWebHtmlResumeAfterScreenReturn: () => boolean;
  resolveStaleWebTtsRuntimeLockThresholdMs: () => number;
  clearStaleWebInterviewTtsRuntimeLocks: (opts?: {
    recoverVoiceUi?: boolean;
    force?: boolean;
  }) => void;
  interruptAllWebInterviewTtsOutput: (opts?: { preserveTabRestorePending?: boolean }) => void;
  dismissAfterAndroidBackgroundPlaybackEnd: (opts?: { force?: boolean }) => void;
  dismissTabRestoreOverlay: (opts?: { deliveredText?: string }) => void;
  ensureWebGestureFlushListener: () => void;
  setWebInterviewerOutputActive: React.Dispatch<React.SetStateAction<boolean>>;
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  tabRestoreHtmlPlayStartTimeoutMs: number;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
};
