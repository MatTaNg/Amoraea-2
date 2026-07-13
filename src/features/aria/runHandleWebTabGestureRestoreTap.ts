import { computeParallelStreamTabRestoreText } from '@features/aria/computeParallelStreamTabRestoreText';
import { normalizeTtsTextForConsecutiveDedup } from '@features/aria/interviewControlTokens';
import {
  isWebInterviewPlaybackAudiblyActive,
} from '@features/aria/utils/webInterviewPlaybackSurface';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { unlockWebAudioForAutoplay } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import {
  getMsSinceWebTabBecameVisible,
  hasRecentWebInterviewUserGesture,
  markWebInterviewUserGestureNow,
} from '@features/aria/utils/webInterviewGestureContext';
import { preAuthorizeAudioElementOnMicTapGesture } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';
import { syncInterviewScenarioRefsFromSpokenDelivery } from '@features/aria/interviewScenarioRefSync';
import {
  createWebTabRestoreReplayContext,
  runWebTabRestoreReplayOrchestration,
} from '@features/aria/webTabRestoreReplayHelpers';
import {
  gateTabRestoreReplayTextForEmotionModal,
  tabRestoreReplayBlockedByPendingEmotionModal,
} from '@features/aria/tabRestoreEmotionModalReplayGate';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';

export async function runHandleWebTabGestureRestoreTap(
  deps: InterviewWebTabRestoreSessionDeps,
): Promise<void> {
  markWebInterviewUserGestureNow();
  const pending = deps.pendingGestureRestoreSpeakRef.current;
  const pendingNorm = pending?.text?.trim()
    ? normalizeTtsTextForConsecutiveDedup(pending.text.trim())
    : '';
  if (
    pending &&
    pendingNorm.length > 0 &&
    pendingNorm === deps.webTabRestoreDeliveredNormRef.current &&
    !deps.needsGestureRestoreRef.current
  ) {
    deps.dismissTabRestoreOverlay();
    deps.setVoiceState('idle');
    return;
  }
  if (
    pending &&
    pendingNorm.length > 0 &&
    pending.restoreMode !== 'resume_html' &&
    pendingNorm === deps.lastSuccessfulTtsTextNormalizedRef.current &&
    !deps.needsGestureRestoreRef.current
  ) {
    deps.dismissTabRestoreOverlay({ deliveredText: pending.text });
    deps.setVoiceState('idle');
    return;
  }
  if (deps.webTabRestoreReplayInFlightRef.current) {
    /**
     * Restore already running (fetch or playback). Do not restart — that caused
     * overlay stuck + interviewer repeating on every tap. If audio is already
     * audible, dismiss the overlay so the user can hear the in-progress line.
     */
    if (isWebInterviewPlaybackAudiblyActive()) {
      void remoteLog('[tab_restore] replay_tap_dismiss_overlay_while_in_flight');
      deps.setWebTabRestoreOverlayVisible(false);
      deps.needsGestureRestoreRef.current = false;
    } else {
      void remoteLog('[tab_restore] replay_tap_ignored_duplicate');
    }
    return;
  }
  if (!pending) {
    deps.dismissTabRestoreOverlay();
    deps.setVoiceState('idle');
    return;
  }
  /**
   * Stuck / ghost playback used to ignore taps forever (`replay_tap_ignored_playback_active`).
   * Interrupt first, then continue the restore — the user explicitly asked to continue.
   * Skip interrupt when HTML stash resume can continue the same element.
   */
  if (
    isWebInterviewPlaybackAudiblyActive() &&
    !hasWebInterviewHtmlAudioTabResumePending()
  ) {
    void remoteLog('[tab_restore] replay_tap_interrupt_active_playback');
    deps.interruptAllWebInterviewTtsOutput({ preserveTabRestorePending: true });
  }
  const tabRestoreMode = pending.restoreMode ?? 'replay';
  /** Tab return can briefly set `navigator.userActivation` without allowing audio — require a tracked tap. */
  const gestureContextActiveAtRestore =
    hasRecentWebInterviewUserGesture(2000) ||
    (tabRestoreMode === 'resume_html' &&
      (getMsSinceWebTabBecameVisible() ?? 999_999) < 4000);
  if (!gestureContextActiveAtRestore && (tabRestoreMode === 'replay' || tabRestoreMode === 'resume_html')) {
    deps.needsGestureRestoreRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
    const textPreview =
      pending.text?.trim() ||
      computeParallelStreamTabRestoreText(
        deps.parallelStreamingTtsRef.current.accumulatedFullText,
        deps.parallelStreamingTtsRef.current.spokenCompleteText,
        [deps.webTtsUtteranceInFlightRef.current ?? '', deps.lastQuestionTextRef.current ?? ''],
      ) ||
      '';
    const uidDefer = deps.userIdRef.current;
    if (uidDefer) {
      const rDefer = getSessionLogRuntime();
      writeSessionLog({
        userId: uidDefer,
        attemptId: rDefer.attemptId,
        eventType: 'tts_replay_deferred_pending_gesture',
        eventData: {
          reason: 'gesture_context_not_active_at_tab_restore',
          tab_restore_mode: tabRestoreMode,
          queued_text_preview: textPreview.slice(0, 80),
        },
        platform: rDefer.platform,
      });
    }
    deps.setVoiceState('idle');
    return;
  }
  deps.webTabRestoreReplayInFlightRef.current = true;
  const tapSession = deps.webTabRestoreTapSessionRef.current + 1;
  deps.webTabRestoreTapSessionRef.current = tapSession;
  deps.detachWebGestureFlushListener();
  deps.interruptAllWebInterviewTtsOutput({ preserveTabRestorePending: true });
  markWebInterviewUserGestureNow();
  const canStashResumeEarly = hasWebInterviewHtmlAudioTabResumePending();
  if (!(tabRestoreMode === 'resume_html' && canStashResumeEarly)) {
    preAuthorizeAudioElementOnMicTapGesture();
    unlockWebAudioForAutoplay();
  }
  deps.setMobileWebTapToBeginDone(true);
  deps.setVoiceState('idle');
  if (
    tabRestoreReplayBlockedByPendingEmotionModal(deps) &&
    deps.emotionModalPendingTransitionRef.current
  ) {
    deps.webTabRestoreReplayInFlightRef.current = false;
    deps.setEmotionModalVisible(true);
    deps.pendingGestureRestoreSpeakRef.current = pending;
    return;
  }
  let replayPending: PendingGestureRestoreSpeakEntry = {
    ...pending,
    text: gateTabRestoreReplayTextForEmotionModal(pending.text ?? '', {
      pendingEmotionModalTransitionRef: deps.pendingEmotionModalTransitionRef,
      emotionModalShownForScenarioRef: deps.emotionModalShownForScenarioRef,
    }),
  };
  deps.pendingGestureRestoreSpeakRef.current = replayPending;
  const emotionDeferred = deps.pendingEmotionModalTransitionRef.current;
  if (
    emotionDeferred &&
    deps.runEmotionModalAfterScenarioTransition &&
    !deps.emotionModalShownForScenarioRef.current.has(emotionDeferred.completedScenario)
  ) {
    deps.webTabRestoreReplayInFlightRef.current = false;
    await deps.runEmotionModalAfterScenarioTransition(emotionDeferred.completedScenario, {
      transitionText: emotionDeferred.transitionText,
      priorScenario: emotionDeferred.priorScenario,
      afterBeforeModalPlayback: true,
    });
    deps.pendingEmotionModalTransitionRef.current = null;
    const afterModal = emotionDeferred.afterModal.trim();
    if (!afterModal) {
      deps.dismissTabRestoreOverlay({ deliveredText: pending.text });
      return;
    }
    replayPending = { ...replayPending, text: afterModal };
    deps.pendingGestureRestoreSpeakRef.current = replayPending;
    deps.webTabRestoreReplayInFlightRef.current = true;
  }
  if (deps.scenarioRefSync && replayPending.text?.trim()) {
    syncInterviewScenarioRefsFromSpokenDelivery(deps.scenarioRefSync, {
      extraTexts: [replayPending.text],
    });
  }
  const replayCtx = createWebTabRestoreReplayContext(deps, replayPending, tapSession);
  await runWebTabRestoreReplayOrchestration(deps, replayPending, tapSession, replayCtx);
}
