import { useCallback } from 'react';

import { TAB_RESTORE_PENDING_SPEAK_OPTIONS } from '@features/aria/interviewTtsSpeakOptions';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import { normalizeTtsTextForConsecutiveDedup } from '@features/aria/interviewControlTokens';
import { clearWebInterviewHtmlTabRestoreState } from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';

export type UseInterviewWebTabRestoreDeps = {
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  pendingGestureRestoreSpeakRef: React.MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  webTtsTabInterruptPendingReplayRef: React.MutableRefObject<boolean>;
  tabHiddenDuringActiveTtsLineRef: React.MutableRefObject<boolean>;
  tabVisibilityGestureLossPendingRef: React.MutableRefObject<boolean>;
  needsGestureRestoreRef: React.MutableRefObject<boolean>;
  webTabRestoreReplayInFlightRef: React.MutableRefObject<boolean>;
  webTabRestoreDeliveredNormRef: React.MutableRefObject<string | null>;
  mobileTabHideLetPlaybackContinueRef: React.MutableRefObject<boolean>;
  mobileTabHideBackgroundUtteranceRef: React.MutableRefObject<string | null>;
  webTtsUtteranceInFlightRef: React.MutableRefObject<string | null>;
  lastQuestionTextRef: React.MutableRefObject<string>;
  lastSuccessfulTtsTextNormalizedRef: React.MutableRefObject<string | null>;
  applyInterviewSpeechComplete: (rawText: string) => void;
};

export function useInterviewWebTabRestore({
  setWebTabRestoreOverlayVisible,
  pendingGestureRestoreSpeakRef,
  webTtsTabInterruptPendingReplayRef,
  tabHiddenDuringActiveTtsLineRef,
  tabVisibilityGestureLossPendingRef,
  needsGestureRestoreRef,
  webTabRestoreReplayInFlightRef,
  webTabRestoreDeliveredNormRef,
  mobileTabHideLetPlaybackContinueRef,
  mobileTabHideBackgroundUtteranceRef,
  webTtsUtteranceInFlightRef,
  lastQuestionTextRef,
  lastSuccessfulTtsTextNormalizedRef,
  applyInterviewSpeechComplete,
}: UseInterviewWebTabRestoreDeps) {
  const dismissTabRestoreOverlay = useCallback(
    (opts?: { deliveredText?: string | null }) => {
      if (opts?.deliveredText?.trim()) {
        webTabRestoreDeliveredNormRef.current = normalizeTtsTextForConsecutiveDedup(
          opts.deliveredText.trim(),
        );
      }
      mobileTabHideLetPlaybackContinueRef.current = false;
      mobileTabHideBackgroundUtteranceRef.current = null;
      pendingGestureRestoreSpeakRef.current = null;
      webTtsTabInterruptPendingReplayRef.current = false;
      tabHiddenDuringActiveTtsLineRef.current = false;
      tabVisibilityGestureLossPendingRef.current = false;
      needsGestureRestoreRef.current = false;
      webTabRestoreReplayInFlightRef.current = false;
      clearWebInterviewHtmlTabRestoreState();
      setWebTabRestoreOverlayVisible(false);
    },
    [setWebTabRestoreOverlayVisible],
  );

  const queueWebTabRestoreOverlayForUtterance = useCallback(
    (utterance: string): boolean => {
      const trimmed = utterance.trim();
      if (!trimmed) return false;
      const norm = normalizeTtsTextForConsecutiveDedup(trimmed);
      if (norm === webTabRestoreDeliveredNormRef.current) return false;
      pendingGestureRestoreSpeakRef.current = {
        text: trimmed,
        restoreMode: 'replay',
        queuedAtMs: Date.now(),
        options: { ...TAB_RESTORE_PENDING_SPEAK_OPTIONS },
        resolve: () => {},
        reject: () => {},
      };
      webTtsTabInterruptPendingReplayRef.current = true;
      needsGestureRestoreRef.current = true;
      tabVisibilityGestureLossPendingRef.current = true;
      setWebTabRestoreOverlayVisible(true);
      return true;
    },
    [setWebTabRestoreOverlayVisible],
  );

  const dismissAfterAndroidBackgroundPlaybackEnd = useCallback(
    (opts?: { force?: boolean }) => {
      mobileTabHideLetPlaybackContinueRef.current = false;
      const heardLine =
        mobileTabHideBackgroundUtteranceRef.current?.trim() ||
        webTtsUtteranceInFlightRef.current?.trim() ||
        lastQuestionTextRef.current?.trim() ||
        pendingGestureRestoreSpeakRef.current?.text?.trim() ||
        '';
      mobileTabHideBackgroundUtteranceRef.current = null;
      if (!opts?.force) {
        const restoreAlreadyPending =
          pendingGestureRestoreSpeakRef.current != null ||
          webTtsTabInterruptPendingReplayRef.current ||
          hasWebInterviewHtmlAudioTabResumePending();
        if (restoreAlreadyPending) {
          return false;
        }
      }
      if (heardLine) {
        const heardNorm = normalizeTtsTextForConsecutiveDedup(heardLine);
        const alreadyDelivered =
          heardNorm === webTabRestoreDeliveredNormRef.current ||
          heardNorm === lastSuccessfulTtsTextNormalizedRef.current;
        if (!alreadyDelivered) {
          applyInterviewSpeechComplete(heardLine);
        }
        dismissTabRestoreOverlay({ deliveredText: heardLine });
      } else {
        dismissTabRestoreOverlay();
      }
      return true;
    },
    [applyInterviewSpeechComplete, dismissTabRestoreOverlay],
  );

  return {
    dismissTabRestoreOverlay,
    queueWebTabRestoreOverlayForUtterance,
    dismissAfterAndroidBackgroundPlaybackEnd,
  };
}
