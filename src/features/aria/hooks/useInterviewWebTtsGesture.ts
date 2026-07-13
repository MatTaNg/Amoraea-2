import { useCallback, useEffect } from 'react';
import { Platform } from 'react-native';

import {
  clearPendingWebSpeechGesturePair,
  peekPendingWebSpeechGesture,
} from '@features/aria/interviewWebPendingSpeechGesture';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { isResumeWelcomeBackAssistantText } from '@utilities/interviewResumeCursor';
import { markWebInterviewUserGestureNow } from '@features/aria/utils/webInterviewGestureContext';
import { unlockWebAudioForAutoplay } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import { tryPlayPendingWebTtsAudioInUserGesture } from '@features/aria/utils/webInterviewPendingGestureBlobPlayback';
import { trySpeakWebSpeechInUserGesture } from '@features/aria/utils/interviewWebSpeechSynthesis';
import { remoteLog } from '@utilities/remoteLog';

export type UseInterviewWebTtsGestureDeps = {
  webResumeWelcomeTapPendingRef: React.MutableRefObject<boolean>;
  webTabRestoreReplayInFlightRef: React.MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: React.MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  webTabGestureRestoreOverlayRef: React.MutableRefObject<boolean>;
  webGestureFlushListenerAttachedRef: React.MutableRefObject<boolean>;
  webGestureFlushHandlerRef: React.MutableRefObject<(() => void) | null>;
  webGestureTtsConsumedPressRef: React.MutableRefObject<boolean>;
  webGestureConsumeClearTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | null>;
  pendingWebSpeechForGestureRef: React.MutableRefObject<string | null>;
  webTtsTabInterruptPendingReplayRef: React.MutableRefObject<boolean>;
  handleWebTabGestureRestoreTapRef: React.MutableRefObject<() => void>;
  setMobileWebTapToBeginDone: (done: boolean) => void;
  setWebDesktopPendingTtsGestureOverlay: (visible: boolean) => void;
  setVoiceState: (state: VoiceState) => void;
};

export function useInterviewWebTtsGesture({
  webResumeWelcomeTapPendingRef,
  webTabRestoreReplayInFlightRef,
  pendingGestureRestoreSpeakRef,
  webTabGestureRestoreOverlayRef,
  webGestureFlushListenerAttachedRef,
  webGestureFlushHandlerRef,
  webGestureTtsConsumedPressRef,
  webGestureConsumeClearTimeoutRef,
  pendingWebSpeechForGestureRef,
  webTtsTabInterruptPendingReplayRef,
  handleWebTabGestureRestoreTapRef,
  setMobileWebTapToBeginDone,
  setWebDesktopPendingTtsGestureOverlay,
  setVoiceState,
}: UseInterviewWebTtsGestureDeps) {
  const runWebGestureTtsFlush = useCallback(async (debugSource?: string) => {
    if (Platform.OS !== 'web') return;
    if (webResumeWelcomeTapPendingRef.current) {
      void remoteLog('[resume] gesture_flush_skipped_resume_welcome_pending', { debugSource });
      return;
    }
    if (webTabRestoreReplayInFlightRef.current) {
      return;
    }
    if (pendingGestureRestoreSpeakRef.current) {
      return;
    }
    markWebInterviewUserGestureNow();
    unlockWebAudioForAutoplay();
    setMobileWebTapToBeginDone(true);
    setVoiceState('speaking');
    const tryPlayed = await tryPlayPendingWebTtsAudioInUserGesture(
      () => setVoiceState('idle'),
      () => setVoiceState('speaking'),
      { source: 'turn' },
    );
    if (tryPlayed) {
      setWebDesktopPendingTtsGestureOverlay(false);
      webGestureTtsConsumedPressRef.current = true;
      if (webGestureConsumeClearTimeoutRef.current) {
        clearTimeout(webGestureConsumeClearTimeoutRef.current);
        webGestureConsumeClearTimeoutRef.current = null;
      }
      webGestureConsumeClearTimeoutRef.current = setTimeout(() => {
        webGestureConsumeClearTimeoutRef.current = null;
        webGestureTtsConsumedPressRef.current = false;
      }, 1800);
      if (pendingGestureRestoreSpeakRef.current || webTtsTabInterruptPendingReplayRef.current) {
        handleWebTabGestureRestoreTapRef.current();
      }
      return;
    }
    const t = peekPendingWebSpeechGesture(pendingWebSpeechForGestureRef);
    if (!t) {
      setWebDesktopPendingTtsGestureOverlay(false);
      return;
    }
    if (isResumeWelcomeBackAssistantText(t)) {
      clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
      setWebDesktopPendingTtsGestureOverlay(false);
      void remoteLog('[resume] gesture_flush_skipped_welcome_back_text', { debugSource });
      return;
    }
    clearPendingWebSpeechGesturePair(pendingWebSpeechForGestureRef);
    webGestureTtsConsumedPressRef.current = true;
    if (webGestureConsumeClearTimeoutRef.current) {
      clearTimeout(webGestureConsumeClearTimeoutRef.current);
      webGestureConsumeClearTimeoutRef.current = null;
    }
    webGestureConsumeClearTimeoutRef.current = setTimeout(() => {
      webGestureConsumeClearTimeoutRef.current = null;
      webGestureTtsConsumedPressRef.current = false;
    }, 1800);
    setVoiceState('speaking');
    trySpeakWebSpeechInUserGesture(t, () => setVoiceState('idle'));
    setWebDesktopPendingTtsGestureOverlay(false);
  }, []);

  const ensureWebGestureFlushListener = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (webResumeWelcomeTapPendingRef.current) {
      return;
    }
    if (webTabRestoreReplayInFlightRef.current || webTabGestureRestoreOverlayRef.current) {
      return;
    }
    if (webGestureFlushListenerAttachedRef.current) {
      return;
    }
    webGestureFlushListenerAttachedRef.current = true;
    const fn = () => {
      webGestureFlushListenerAttachedRef.current = false;
      webGestureFlushHandlerRef.current = null;
      window.removeEventListener('pointerdown', fn, { capture: true });
      void runWebGestureTtsFlush('window');
    };
    webGestureFlushHandlerRef.current = fn;
    window.addEventListener('pointerdown', fn, { capture: true });
  }, [runWebGestureTtsFlush]);

  const detachWebGestureFlushListener = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const h = webGestureFlushHandlerRef.current;
    if (h) {
      window.removeEventListener('pointerdown', h, { capture: true });
      webGestureFlushHandlerRef.current = null;
    }
    webGestureFlushListenerAttachedRef.current = false;
  }, []);

  useEffect(() => {
    return () => {
      detachWebGestureFlushListener();
    };
  }, [detachWebGestureFlushListener]);

  return {
    runWebGestureTtsFlush,
    ensureWebGestureFlushListener,
    detachWebGestureFlushListener,
  };
}
