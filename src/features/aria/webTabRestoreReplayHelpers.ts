import { Platform } from 'react-native';

import { computeParallelStreamTabRestoreText } from '@features/aria/computeParallelStreamTabRestoreText';
import { normalizeTtsTextForConsecutiveDedup } from '@features/aria/interviewControlTokens';
import {
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingThanksFragment,
  looksLikeInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import { createInitialParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import { TAB_RESTORE_PENDING_SPEAK_OPTIONS } from '@features/aria/interviewTtsSpeakOptions';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { speakLongFormInterviewHtmlMp3 } from '@features/aria/utils/speakLongFormInterviewHtmlMp3';
import { getWebAutoplayContext } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  clearWebInterviewHtmlTabRestoreState,
  pauseActiveWebInterviewHtmlAudioWithoutRevoke,
  trySyncStartTabRestoreHtmlPlaybackInUserGesture,
} from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import { hasPendingWebGestureBlobUrl } from '@features/aria/utils/webInterviewPendingGestureBlob';
import { tryPlayPendingWebTtsAudioInUserGesture } from '@features/aria/utils/webInterviewPendingGestureBlobPlayback';
import {
  isWebInterviewPlaybackAudiblyActive,
  isWebInterviewPlaybackSurfaceActive,
} from '@features/aria/utils/webInterviewPlaybackSurface';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import {
  isTtsTabResumeFallbackError,
  TtsTabResumeFallbackError,
} from '@features/aria/utils/webTtsGestureErrors';
import { takePreAuthorizedAudioElementForTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';
import { coerceInterviewReplayTtsText } from '@features/aria/scenarioCPromptDetection';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';
import { syncInterviewScenarioRefsFromSpokenDelivery } from '@features/aria/interviewScenarioRefSync';

async function tryDirectTabRestorePlayback(args: {
  text: string;
  prefetchedBuffer: ArrayBuffer | null | undefined;
  onPlaybackStarted: () => void;
}): Promise<boolean> {
  return speakLongFormInterviewHtmlMp3({
    text: args.text,
    telemetrySource: 'replay',
    prefetchedBuffer: args.prefetchedBuffer,
    onPlaybackStarted: args.onPlaybackStarted,
  });
}

export type WebTabRestoreReplayContext = {
  finishTabRestore: (opts?: {
    clearTabHiddenLineFlag?: boolean;
    htmlResumeDelivered?: boolean;
  }) => void;
  releaseTabRestoreTapWithoutFinish: () => void;
  replayTabRestoreFromStart: () => Promise<boolean>;
  logTabRestoreReplayCompleted: () => void;
  tabRestoreReplayText: string;
  onTabRestoreAudibleStart: () => void;
  isClosingTabRestoreReplay: boolean;
  isHtmlResumeAudibleThisRestore: () => boolean;
};

export function createWebTabRestoreReplayContext(
  deps: InterviewWebTabRestoreSessionDeps,
  pending: PendingGestureRestoreSpeakEntry,
  tapSession: number,
): WebTabRestoreReplayContext {
  const uid = deps.userIdRef.current;
  let htmlResumeAudibleThisRestore = false;
  const tabRestoreReplayFallbacks = [
    deps.webTtsUtteranceInFlightRef.current ?? '',
    deps.lastQuestionTextRef.current ?? '',
  ];
  /**
   * Prefer the interrupt-queued pending line. Recomputing from parallel stream can pull a
   * muted S1 vignette while the spoken line was a follow-up (contempt probe).
   */
  const pendingRestoreText = pending.text?.trim() ?? '';
  const tabRestoreReplayText = substituteCanonicalInterviewScenarioBodiesForTts(
    coerceInterviewReplayTtsText(
      pendingRestoreText ||
        computeParallelStreamTabRestoreText(
          deps.parallelStreamingTtsRef.current.accumulatedFullText,
          deps.parallelStreamingTtsRef.current.spokenCompleteText,
          tabRestoreReplayFallbacks,
        ) ||
        '',
      pendingRestoreText ? [pendingRestoreText, ...tabRestoreReplayFallbacks] : tabRestoreReplayFallbacks,
    ),
  );
  const queuedAtMs =
    pending.queuedAtMs ?? deps.gestureContextLostAtRef.current?.atMs ?? null;
  const msSinceOriginalQueue =
    queuedAtMs != null ? Math.max(0, Date.now() - queuedAtMs) : null;
  const isClosingTabRestoreReplay =
    isInterviewClosingThanksFragment(tabRestoreReplayText) ||
    isInterviewClosingReflectiveAckFragment(tabRestoreReplayText) ||
    looksLikeInterviewClosingAssistantMessage(tabRestoreReplayText);

  const onTabRestoreAudibleStart = () => {
    /** Must set before playback ends — otherwise post-await checks see neither audible flag nor active audio and re-queue the overlay. */
    htmlResumeAudibleThisRestore = true;
    const currentPending = deps.pendingGestureRestoreSpeakRef.current;
    /** Do not dismiss overlay if a later tab-hide already queued a newer restore. */
    if (currentPending == null || currentPending === pending) {
      deps.needsGestureRestoreRef.current = false;
      deps.setWebTabRestoreOverlayVisible(false);
    }
    deps.setVoiceState('speaking');
    deps.tabRestoreInFlightWithoutPlaybackSinceMsRef.current = null;
  };

  const finishTabRestore = (opts?: {
    clearTabHiddenLineFlag?: boolean;
    htmlResumeDelivered?: boolean;
    /** Set delivered norm only when replay/resume was audibly confirmed (not dedup-only). */
    audibleDelivered?: boolean;
  }) => {
    const currentPending = deps.pendingGestureRestoreSpeakRef.current;
    /**
     * Only preserve when a *later* tab-hide replaced pending (newer queuedAtMs).
     * `replayTabRestoreFromStart` used to assign `{ ...pending }`, which made
     * reference inequality always true and re-queued Tap-to-continue after every success.
     */
    const preserveNewerPending =
      currentPending != null &&
      currentPending !== pending &&
      (currentPending.queuedAtMs ?? 0) > (pending.queuedAtMs ?? 0);
    if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
      return;
    }
    if (opts?.htmlResumeDelivered && !preserveNewerPending) {
      htmlResumeAudibleThisRestore = true;
      deps.webTtsSpeakGenerationRef.current += 1;
      const deliveredLine =
        deps.webTtsUtteranceInFlightRef.current?.trim() ||
        deps.lastQuestionTextRef.current?.trim() ||
        pending.text;
      if (deliveredLine.length > 0) {
        try {
          deps.applyInterviewSpeechComplete?.(deliveredLine);
        } catch (applyErr) {
          void remoteLog('[tab_restore] apply_speech_complete_failed', {
            error: applyErr instanceof Error ? applyErr.message : String(applyErr),
          });
        }
      }
    }
    deps.parallelStreamingTtsRef.current = createInitialParallelStreamingTtsState();
    deps.webTtsUtteranceInFlightRef.current = null;
    deps.webTtsUtteranceInFlightOptionsRef.current = null;
    if (preserveNewerPending) {
      void remoteLog('[tab_restore] finish_preserved_newer_pending');
      deps.webTtsTabInterruptPendingReplayRef.current = true;
      deps.needsGestureRestoreRef.current = true;
      deps.tabHiddenDuringActiveTtsLineRef.current = true;
      deps.setWebTabRestoreOverlayVisible(true);
      deps.setVoiceState('idle');
    } else {
      const tabStillHidden =
        typeof document !== 'undefined' && document.visibilityState === 'hidden';
      /**
       * If restore "finishes" while the tab is still hidden (second hide interrupted
       * playback but interrupt queued the same pending object / early-return race), keep
       * Tap-to-continue armed for the next visible return.
       */
      if (tabStillHidden && (pending.text?.trim().length ?? 0) > 0) {
        void remoteLog('[tab_restore] finish_rearmed_while_hidden');
        deps.pendingGestureRestoreSpeakRef.current = {
          ...pending,
          restoreMode: 'replay',
          queuedAtMs: Date.now(),
        };
        deps.webTtsTabInterruptPendingReplayRef.current = true;
        deps.needsGestureRestoreRef.current = true;
        deps.tabHiddenDuringActiveTtsLineRef.current = true;
        deps.webTabRestoreDeliveredNormRef.current = null;
        deps.setWebTabRestoreOverlayVisible(true);
        deps.setVoiceState('idle');
      } else {
        deps.webTtsTabInterruptPendingReplayRef.current = false;
        if (opts?.clearTabHiddenLineFlag !== false) {
          deps.tabHiddenDuringActiveTtsLineRef.current = false;
        }
        deps.needsGestureRestoreRef.current = false;
        deps.setWebTabRestoreOverlayVisible(false);
        deps.pendingGestureRestoreSpeakRef.current = null;
        if (opts?.htmlResumeDelivered || opts?.audibleDelivered) {
          deps.webTabRestoreDeliveredNormRef.current = normalizeTtsTextForConsecutiveDedup(
            pending.text?.trim() || tabRestoreReplayText || '',
          );
        }
        clearWebInterviewHtmlTabRestoreState();
        if (deps.scenarioRefSync && tabRestoreReplayText.trim()) {
          syncInterviewScenarioRefsFromSpokenDelivery(deps.scenarioRefSync, {
            extraTexts: [tabRestoreReplayText],
          });
        }
        deps.setVoiceState('idle');
      }
    }
    pending.resolve();
    deps.webTabRestoreReplayInFlightRef.current = false;
  };

  const releaseTabRestoreTapWithoutFinish = () => {
    if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
      return;
    }
    deps.webTabRestoreReplayInFlightRef.current = false;
  };

  const replayTabRestoreFromStart = async (): Promise<boolean> => {
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
    deps.parallelStreamingTtsRef.current.active = false;
    clearWebInterviewHtmlTabRestoreState();
    pauseActiveWebInterviewHtmlAudioWithoutRevoke();
    // Keep the same pending object identity so finishTabRestore does not treat this as a newer tab-hide.
    pending.restoreMode = 'replay';
    deps.pendingGestureRestoreSpeakRef.current = pending;
    let audibleConfirmed = htmlResumeAudibleThisRestore;
    if (!audibleConfirmed) {
      const prefetched = deps.resumeRepeatPrefetchMpegRef.current;
      const replayNorm = normalizeTtsTextForConsecutiveDedup(tabRestoreReplayText);
      const prefetchMatches =
        prefetched != null &&
        normalizeTtsTextForConsecutiveDedup(prefetched.text) === replayNorm;
      const directPlayed = await tryDirectTabRestorePlayback({
        text: tabRestoreReplayText,
        prefetchedBuffer: prefetchMatches && prefetched ? prefetched.buffer : null,
        onPlaybackStarted: onTabRestoreAudibleStart,
      });
      if (directPlayed) {
        audibleConfirmed = true;
      } else {
        const preAuthEl = takePreAuthorizedAudioElementForTts();
        onTabRestoreAudibleStart();
        try {
          await deps.speakTextSafe(tabRestoreReplayText, {
            ...TAB_RESTORE_PENDING_SPEAK_OPTIONS,
            ...pending.options,
            telemetrySource: 'replay',
            skipQuestionTiming: true,
            ...(prefetchMatches && prefetched
              ? {
                  prefetchedMpegArrayBuffer: prefetched.buffer,
                  ttsTriggerSource: 'preauthorized_element' as const,
                }
              : preAuthEl
                ? {
                    immediateWebPlaybackElement: preAuthEl,
                    ttsTriggerSource: 'preauthorized_element' as const,
                  }
                : {}),
          });
          audibleConfirmed = true;
        } catch (replayErr) {
          audibleConfirmed = false;
          void remoteLog('[tab_restore] replay_speak_failed', {
            preview: tabRestoreReplayText.slice(0, 120),
            error: replayErr instanceof Error ? replayErr.message : String(replayErr),
          });
        }
      }
    }
    if (audibleConfirmed) {
      finishTabRestore({ htmlResumeDelivered: true, audibleDelivered: true });
      return true;
    }
    if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
      return false;
    }
    const replayNorm = normalizeTtsTextForConsecutiveDedup(tabRestoreReplayText);
    if (replayNorm.length > 0 && replayNorm === deps.lastSuccessfulTtsTextNormalizedRef.current) {
      deps.lastSuccessfulTtsTextNormalizedRef.current = null;
    }
    void remoteLog('[tab_restore] replay_finished_without_audible', {
      preview: tabRestoreReplayText.slice(0, 120),
    });
    deps.pendingGestureRestoreSpeakRef.current = { ...pending, restoreMode: 'replay' };
    deps.webTtsTabInterruptPendingReplayRef.current = true;
    deps.needsGestureRestoreRef.current = true;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.setVoiceState('idle');
    releaseTabRestoreTapWithoutFinish();
    return false;
  };

  const logTabRestoreReplayCompleted = () => {
    if (tapSession !== deps.webTabRestoreTapSessionRef.current || !uid || tabRestoreReplayText.length === 0) {
      return;
    }
    const rLog = getSessionLogRuntime();
    writeSessionLog({
      userId: uid,
      attemptId: rLog.attemptId,
      eventType: 'tts_replayed_after_gesture_restore',
      eventData: {
        replayed_text: tabRestoreReplayText.slice(0, 2000),
        ms_since_original_queue: msSinceOriginalQueue,
        tab_restore_mode: pending.restoreMode ?? 'replay',
      },
      platform: rLog.platform,
    });
  };

  return {
    finishTabRestore,
    releaseTabRestoreTapWithoutFinish,
    replayTabRestoreFromStart,
    logTabRestoreReplayCompleted,
    tabRestoreReplayText,
    onTabRestoreAudibleStart,
    isClosingTabRestoreReplay,
    isHtmlResumeAudibleThisRestore: () => htmlResumeAudibleThisRestore,
  };
}

export async function runWebTabRestoreReplayOrchestration(
  deps: InterviewWebTabRestoreSessionDeps,
  pending: PendingGestureRestoreSpeakEntry,
  tapSession: number,
  ctx: WebTabRestoreReplayContext,
): Promise<void> {
  const {
    finishTabRestore,
    releaseTabRestoreTapWithoutFinish,
    replayTabRestoreFromStart,
    logTabRestoreReplayCompleted,
    tabRestoreReplayText,
    onTabRestoreAudibleStart,
    isClosingTabRestoreReplay,
    isHtmlResumeAudibleThisRestore,
  } = ctx;

  const tabRestoreMode = pending.restoreMode ?? 'replay';
  const uid = deps.userIdRef.current;

  const canStashResume = hasWebInterviewHtmlAudioTabResumePending();
  const webAutoplayCtx = Platform.OS === 'web' ? getWebAutoplayContext() : { isMobileWeb: false };
  let syncTabRestoreStarted = false;
  let syncTabRestorePlayback: Promise<void> | null = null;
  if (canStashResume) {
    const sync = trySyncStartTabRestoreHtmlPlaybackInUserGesture({
      onPlayStarted: onTabRestoreAudibleStart,
      telemetrySource: 'replay',
      replayFromStart: tabRestoreMode === 'replay' && webAutoplayCtx.isMobileWeb,
    });
    syncTabRestoreStarted = sync.started;
    syncTabRestorePlayback = sync.done;
  }

  if (uid) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: uid,
      attemptId: r.attemptId,
      eventType: 'gesture_restored_after_tab_switch',
      eventData: {
        gesture_restored_after_tab_switch: true,
        tab_restore_mode: tabRestoreMode,
      },
      platform: r.platform,
    });
  }

  if (isClosingTabRestoreReplay) {
    finishTabRestore({ clearTabHiddenLineFlag: false });
    return;
  }

  if (syncTabRestoreStarted && syncTabRestorePlayback) {
    try {
      const remainingMs = Math.min(
        600_000,
        Math.max(20_000, tabRestoreReplayText.length * 90),
      );
      await Promise.race([
        syncTabRestorePlayback,
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new TtsTabResumeFallbackError()), remainingMs),
        ),
      ]);
      /**
       * Sync `play()` already started in the user-gesture handler. By the time `done`
       * resolves, HTML audio has often already ended — so "still audible?" is the wrong
       * success test and was re-queuing Tap-to-continue after every successful resume.
       * Treat sync-started completion as delivered.
       */
      if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
        return;
      }
      if (!isHtmlResumeAudibleThisRestore()) {
        onTabRestoreAudibleStart();
      }
      logTabRestoreReplayCompleted();
      finishTabRestore({
        clearTabHiddenLineFlag: false,
        htmlResumeDelivered: true,
        audibleDelivered: true,
      });
    } catch (err) {
      if (uid && isTtsTabResumeFallbackError(err)) {
        const rFail = getSessionLogRuntime();
        writeSessionLog({
          userId: uid,
          attemptId: rFail.attemptId,
          eventType: 'tab_restore_html_resume_failed',
          eventData: {
            tab_restore_mode: pending.restoreMode ?? 'resume_html',
            fallback: 'replay_from_start',
            tab_restore_html_resume_failed: true,
          },
          platform: rFail.platform,
        });
      }
      try {
        if (await replayTabRestoreFromStart()) {
          logTabRestoreReplayCompleted();
        }
      } catch (replayErr) {
        if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
          return;
        }
        deps.webTtsTabInterruptPendingReplayRef.current = true;
        deps.pendingGestureRestoreSpeakRef.current = { ...pending, restoreMode: 'replay' };
        deps.setWebTabRestoreOverlayVisible(true);
        deps.needsGestureRestoreRef.current = true;
        deps.setVoiceState('idle');
        releaseTabRestoreTapWithoutFinish();
        pending.reject(replayErr);
      }
    }
    return;
  }
  if (canStashResume && !syncTabRestoreStarted) {
    try {
      if (await replayTabRestoreFromStart()) {
        logTabRestoreReplayCompleted();
      }
    } catch (replayErr) {
      if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
        return;
      }
      deps.webTtsTabInterruptPendingReplayRef.current = true;
      deps.pendingGestureRestoreSpeakRef.current = { ...pending, restoreMode: 'replay' };
      deps.setWebTabRestoreOverlayVisible(true);
      deps.needsGestureRestoreRef.current = true;
      deps.setVoiceState('idle');
      releaseTabRestoreTapWithoutFinish();
      pending.reject(replayErr);
    }
    return;
  }
  if (!canStashResume && hasPendingWebGestureBlobUrl()) {
    try {
      deps.webTtsTabInterruptPendingReplayRef.current = false;
      const playedBlob = await tryPlayPendingWebTtsAudioInUserGesture(
        () => {},
        onTabRestoreAudibleStart,
        { source: 'replay' },
      );
      if (playedBlob) {
        await new Promise<void>((resolve) => {
          const poll = () => {
            if (!isWebInterviewPlaybackSurfaceActive()) {
              resolve();
              return;
            }
            setTimeout(poll, 80);
          };
          poll();
        });
        try {
          deps.applyInterviewSpeechComplete?.(tabRestoreReplayText);
        } catch {
          /* finish still clears overlay below */
        }
        logTabRestoreReplayCompleted();
        finishTabRestore({ clearTabHiddenLineFlag: false, audibleDelivered: true });
        return;
      }
    } catch {
      /* fall through to speakTextSafe replay */
    }
  }
  try {
    if (await replayTabRestoreFromStart()) {
      logTabRestoreReplayCompleted();
    }
  } catch (err) {
    if (tapSession !== deps.webTabRestoreTapSessionRef.current) {
      return;
    }
    deps.webTtsTabInterruptPendingReplayRef.current = true;
    deps.pendingGestureRestoreSpeakRef.current = pending;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.setVoiceState('idle');
    releaseTabRestoreTapWithoutFinish();
    pending.reject(err);
  }
}
