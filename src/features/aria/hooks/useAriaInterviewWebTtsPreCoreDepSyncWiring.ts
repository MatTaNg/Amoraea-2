import { useRef } from 'react';

import type { ApplyInterviewSpeechCompleteDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';
import {
  useInterviewTtsSpeak,
  type UseInterviewTtsSpeakDeps,
} from '@features/aria/hooks/useInterviewTtsSpeak';
import {
  useInterviewWebTabRestore,
  type UseInterviewWebTabRestoreDeps,
} from '@features/aria/hooks/useInterviewWebTabRestore';
import {
  useInterviewWebTtsGesture,
  type UseInterviewWebTtsGestureDeps,
} from '@features/aria/hooks/useInterviewWebTtsGesture';
import {
  useInterviewWebTtsRuntime,
  type InterviewWebTtsRuntimeDeps,
} from '@features/aria/hooks/useInterviewWebTtsRuntime';

export type AriaInterviewWebTtsPreCoreDepSyncWiringParams = {
  ttsSpeak: UseInterviewTtsSpeakDeps;
  webTtsGesture: UseInterviewWebTtsGestureDeps;
  webTabRestore: Omit<UseInterviewWebTabRestoreDeps, 'applyInterviewSpeechComplete'> & {
    applyInterviewSpeechComplete: ApplyInterviewSpeechCompleteDeps['applyInterviewSpeechComplete'];
  };
};

/** Mount web TTS runtime, speak, gesture flush, and tab-restore helpers before core TTS wiring. */
export function useAriaInterviewWebTtsPreCoreDepSyncWiring(params: AriaInterviewWebTtsPreCoreDepSyncWiringParams) {
  const { ttsSpeak, webTtsGesture, webTabRestore } = params;

  const webTtsRuntimeDepsRef = useRef({} as InterviewWebTtsRuntimeDeps);
  const {
    isInterviewerOutputActiveForMicGate,
    waitForWebInterviewTtsQuiescentBeforeEmotionModal,
    waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
    clearStaleWebInterviewTtsRuntimeLocks,
    interruptAllWebInterviewTtsOutput,
    resolveStaleWebTtsRuntimeLockThresholdMs,
    resolveMobileTabHideBackgroundUtterance,
    isMobileWebInterviewTtsSessionActive,
    armMobileWebBackgroundTtsContinue,
    queueMobileWebHtmlResumeAfterScreenReturn,
  } = useInterviewWebTtsRuntime(webTtsRuntimeDepsRef);

  const { speak } = useInterviewTtsSpeak(ttsSpeak);

  const { runWebGestureTtsFlush, ensureWebGestureFlushListener, detachWebGestureFlushListener } =
    useInterviewWebTtsGesture(webTtsGesture);

  const {
    dismissTabRestoreOverlay,
    queueWebTabRestoreOverlayForUtterance,
    dismissAfterAndroidBackgroundPlaybackEnd,
  } = useInterviewWebTabRestore(webTabRestore);

  return {
    webTtsRuntimeDepsRef,
    isInterviewerOutputActiveForMicGate,
    waitForWebInterviewTtsQuiescentBeforeEmotionModal,
    waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal,
    clearStaleWebInterviewTtsRuntimeLocks,
    interruptAllWebInterviewTtsOutput,
    resolveStaleWebTtsRuntimeLockThresholdMs,
    resolveMobileTabHideBackgroundUtterance,
    isMobileWebInterviewTtsSessionActive,
    armMobileWebBackgroundTtsContinue,
    queueMobileWebHtmlResumeAfterScreenReturn,
    speak,
    runWebGestureTtsFlush,
    ensureWebGestureFlushListener,
    detachWebGestureFlushListener,
    dismissTabRestoreOverlay,
    queueWebTabRestoreOverlayForUtterance,
    dismissAfterAndroidBackgroundPlaybackEnd,
  };
}
