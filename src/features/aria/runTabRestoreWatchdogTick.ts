import type { TabRestoreWatchdogDeps } from '@features/aria/tabRestoreWatchdogTypes';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime } from '@utilities/sessionLogging';

export function runTabRestoreWatchdogTick(deps: TabRestoreWatchdogDeps): void {
  const voiceState = deps.voiceStateRef.current;
  const webTabGestureRestoreOverlay = deps.webTabGestureRestoreOverlayRef.current;
  const playbackActive = deps.isWebInterviewPlaybackSurfaceActive();
  const playbackAudible = deps.isWebInterviewPlaybackAudiblyActive();

  if (deps.mobileTabHideLetPlaybackContinueRef.current && !playbackAudible) {
    if (!deps.hasWebInterviewHtmlAudioTabResumePending()) {
      deps.dismissAfterAndroidBackgroundPlaybackEnd({ force: true });
      if (voiceState === 'speaking') {
        deps.setVoiceState('idle');
      }
    }
  }

  const outputActive = deps.isInterviewerOutputActiveForMicGate();
  deps.setWebInterviewerOutputActive((prev) => (prev === outputActive ? prev : outputActive));

  if (
    deps.hasWebInterviewHtmlAudioTabResumePending() &&
    !deps.pendingGestureRestoreSpeakRef.current &&
    !deps.webTtsTabInterruptPendingReplayRef.current &&
    !deps.mobileTabHideLetPlaybackContinueRef.current &&
    !deps.ttsLineInFlightRef.current &&
    !deps.webTabRestoreReplayInFlightRef.current
  ) {
    if (deps.queueMobileWebHtmlResumeAfterScreenReturn()) {
      deps.ensureWebGestureFlushListener();
    }
  }

  const restorePending =
    deps.pendingGestureRestoreSpeakRef.current != null ||
    deps.webTtsTabInterruptPendingReplayRef.current ||
    deps.hasWebInterviewHtmlAudioTabResumePending();
  /** Overlay must require an explicit pending speak / interrupt — leftover HTML stash alone
   * used to re-show "Tap to continue" after a successful replay finished. */
  const overlayRestorePending =
    deps.pendingGestureRestoreSpeakRef.current != null ||
    deps.webTtsTabInterruptPendingReplayRef.current;
  const rt = getSessionLogRuntime();
  const ttsLocksWithoutPlayback =
    !restorePending &&
    !playbackAudible &&
    !deps.isWebInterviewMidUtteranceTabResumeActive() &&
    !deps.webTabRestoreReplayInFlightRef.current &&
    !deps.mobileTabHideLetPlaybackContinueRef.current &&
    deps.ttsLineInFlightRef.current &&
    (deps.parallelStreamingTtsRef.current.active || rt.ttsPlaybackActive);

  if (ttsLocksWithoutPlayback) {
    const lockNow = Date.now();
    const staleThresholdMs = deps.resolveStaleWebTtsRuntimeLockThresholdMs();
    if (deps.staleWebTtsRuntimeLockSinceMsRef.current == null) {
      deps.staleWebTtsRuntimeLockSinceMsRef.current = lockNow;
    } else if (lockNow - deps.staleWebTtsRuntimeLockSinceMsRef.current >= staleThresholdMs) {
      const speakUtteranceActive = (deps.webTtsUtteranceInFlightRef.current?.trim().length ?? 0) > 0;
      void remoteLog('[tab_restore] stale_tts_runtime_locks_cleared', {
        stale_threshold_ms: staleThresholdMs,
        speak_utterance_active: speakUtteranceActive,
        waited_ms: lockNow - deps.staleWebTtsRuntimeLockSinceMsRef.current,
      });
      deps.clearStaleWebInterviewTtsRuntimeLocks({ recoverVoiceUi: true, force: true });
      deps.staleWebTtsRuntimeLockSinceMsRef.current = null;
      if (
        (voiceState === 'speaking' || voiceState === 'processing') &&
        !restorePending &&
        !deps.webTabRestoreReplayInFlightRef.current
      ) {
        deps.setVoiceState('idle');
      }
    }
  } else {
    deps.staleWebTtsRuntimeLockSinceMsRef.current = null;
  }

  if (voiceState === 'idle' && deps.interviewStatusRef.current === 'in_progress' && playbackActive) {
    deps.setVoiceState('speaking');
    return;
  }

  if (
    overlayRestorePending &&
    !deps.mobileTabHideLetPlaybackContinueRef.current &&
    !deps.webTabRestoreReplayInFlightRef.current &&
    !playbackActive &&
    !playbackAudible &&
    voiceState === 'idle' &&
    !webTabGestureRestoreOverlay
  ) {
    deps.needsGestureRestoreRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
  }

  /** Overlay must not sit on top of audio that already resumed from a prior tap. */
  if (webTabGestureRestoreOverlay && playbackAudible && deps.webTabRestoreReplayInFlightRef.current) {
    deps.setWebTabRestoreOverlayVisible(false);
    deps.needsGestureRestoreRef.current = false;
  }

  if (deps.webTabRestoreReplayInFlightRef.current && !playbackActive) {
    const rtBusy = getSessionLogRuntime();
    if (voiceState === 'processing' || deps.ttsLineInFlightRef.current || rtBusy.ttsPlaybackActive) {
      deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current = null;
    } else {
      const now = Date.now();
      if (deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current == null) {
        deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current = now;
      } else if (
        now - deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current >=
        deps.tabRestoreHtmlPlayStartTimeoutMs + 500
      ) {
        void remoteLog('[tab_restore] in_flight_stuck_recovered');
        deps.webTabRestoreReplayInFlightRef.current = false;
        deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current = null;
        deps.needsGestureRestoreRef.current = true;
        deps.setWebTabRestoreOverlayVisible(true);
        deps.setVoiceState('idle');
      }
    }
  } else {
    deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current = null;
  }

  if (voiceState !== 'speaking') {
    deps.speakingWithoutPlaybackSinceMsRef.current = null;
    return;
  }
  if (
    typeof document !== 'undefined' &&
    document.visibilityState === 'hidden'
  ) {
    deps.speakingWithoutPlaybackSinceMsRef.current = null;
    return;
  }
  if (deps.tabHiddenDuringActiveTtsLineRef?.current) {
    deps.speakingWithoutPlaybackSinceMsRef.current = null;
    return;
  }
  if (deps.mobileTabHideLetPlaybackContinueRef.current) {
    deps.speakingWithoutPlaybackSinceMsRef.current = null;
    return;
  }
  if (restorePending) {
    deps.speakingWithoutPlaybackSinceMsRef.current = null;
    return;
  }
  if (playbackActive || deps.webTabRestoreReplayInFlightRef.current) {
    deps.speakingWithoutPlaybackSinceMsRef.current = null;
    return;
  }
  const now = Date.now();
  if (deps.speakingWithoutPlaybackSinceMsRef.current == null) {
    deps.speakingWithoutPlaybackSinceMsRef.current = now;
    return;
  }
  const stuckMs = now - deps.speakingWithoutPlaybackSinceMsRef.current;
  if (stuckMs < 3500) return;
  void remoteLog('[tab_restore] stuck_speaking_recovered', {
    stuckMs,
    restorePending,
  });
  deps.interruptAllWebInterviewTtsOutput({
    preserveTabRestorePending: overlayRestorePending || restorePending,
  });
  if (overlayRestorePending) {
    deps.needsGestureRestoreRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
  }
  deps.setVoiceState('idle');
  deps.speakingWithoutPlaybackSinceMsRef.current = null;
}
