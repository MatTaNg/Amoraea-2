import { useCallback } from 'react';
import { Platform } from 'react-native';

import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { TAB_RESTORE_PENDING_SPEAK_OPTIONS } from '@features/aria/interviewTtsSpeakOptions';
import type { WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import { getWebAutoplayContext } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  clearWebInterviewHtmlTabRestoreState,
  refreshWebInterviewHtmlTabStashForRepeatHide,
} from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import {
  isWebInterviewPlaybackAudiblyActive,
  isWebInterviewPlaybackSurfaceActive,
} from '@features/aria/utils/webInterviewPlaybackSurface';
import { interruptWebInterviewTtsForTabHide } from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import { stopElevenLabsPlayback, stopElevenLabsSpeech } from '@features/aria/utils/elevenLabsTtsPlaybackStop';
import { getSessionLogRuntime, setTtsPlaybackActive } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

export const STALE_SPEAK_AWAITING_AUDIO_MS = 50_000;
export const STALE_PARALLEL_STREAM_AWAITING_AUDIO_MS = 15_000;
export const STALE_TTS_RUNTIME_LOCK_MS = 2_000;

export type InterviewWebTtsRuntimeDeps = {
  voiceStateRef: React.MutableRefObject<VoiceState>;
  setVoiceState: (state: VoiceState) => void;
  parallelStreamingTtsRef: React.MutableRefObject<ParallelStreamingTtsState>;
  ttsLineInFlightRef: React.MutableRefObject<boolean>;
  webTabRestoreReplayInFlightRef: React.MutableRefObject<boolean>;
  webTtsTabInterruptPendingReplayRef: React.MutableRefObject<boolean>;
  webTtsSpeakGenerationRef: React.MutableRefObject<number>;
  webTtsUtteranceInFlightRef: React.MutableRefObject<string | null>;
  webTtsUtteranceInFlightOptionsRef: React.MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  pendingGestureRestoreSpeakRef: React.MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  mobileTabHideLetPlaybackContinueRef: React.MutableRefObject<boolean>;
  mobileTabHideBackgroundUtteranceRef: React.MutableRefObject<string | null>;
  tabHiddenDuringActiveTtsLineRef: React.MutableRefObject<boolean>;
  needsGestureRestoreRef: React.MutableRefObject<boolean>;
  tabVisibilityGestureLossPendingRef: React.MutableRefObject<boolean>;
  lastQuestionTextRef: React.MutableRefObject<string>;
  setWebTabRestoreOverlayVisible: (visible: boolean) => void;
  ensureWebGestureFlushListener: () => void;
};

export function useInterviewWebTtsRuntime(depsRef: React.MutableRefObject<InterviewWebTtsRuntimeDeps>) {
  const isInterviewerOutputActiveForMicGate = useCallback((): boolean => {
    const deps = depsRef.current;
    if (deps.voiceStateRef.current === 'processing') {
      return true;
    }
    if (Platform.OS !== 'web') {
      return deps.voiceStateRef.current === 'speaking';
    }
    const rt = getSessionLogRuntime();
    return (
      isWebInterviewPlaybackAudiblyActive() ||
      deps.parallelStreamingTtsRef.current.active ||
      deps.ttsLineInFlightRef.current ||
      rt.ttsPlaybackActive ||
      deps.webTabRestoreReplayInFlightRef.current ||
      deps.webTtsTabInterruptPendingReplayRef.current
    );
  }, [depsRef]);

  const waitForWebInterviewTtsQuiescentBeforeEmotionModal = useCallback(async (): Promise<void> => {
    const deps = depsRef.current;
    if (Platform.OS !== 'web') return;
    const startedAt = Date.now();
    const deadline = startedAt + 180_000;
    const staleLockDeadline = startedAt + STALE_TTS_RUNTIME_LOCK_MS;
    while (Date.now() < deadline) {
      const audiblyActive = isWebInterviewPlaybackAudiblyActive();
      const surfaceActive = isWebInterviewPlaybackSurfaceActive();
      const parallelStreamActive = deps.parallelStreamingTtsRef.current.active;
      const lineInFlight = deps.ttsLineInFlightRef.current;
      const sessionTtsActive = getSessionLogRuntime().ttsPlaybackActive;
      if (
        !audiblyActive &&
        !surfaceActive &&
        !deps.webTabRestoreReplayInFlightRef.current &&
        !deps.webTtsTabInterruptPendingReplayRef.current &&
        !parallelStreamActive &&
        !lineInFlight &&
        !sessionTtsActive
      ) {
        return;
      }
      if (
        Date.now() >= staleLockDeadline &&
        !parallelStreamActive &&
        !audiblyActive &&
        !surfaceActive &&
        (lineInFlight || sessionTtsActive)
      ) {
        deps.ttsLineInFlightRef.current = false;
        setTtsPlaybackActive(false);
        void remoteLog('[EMOTION_MODAL] cleared_stale_tts_lock_before_modal', {
          lineInFlight,
          sessionTtsActive,
          parallelStreamActive,
        });
        return;
      }
      await new Promise<void>((res) => setTimeout(res, 120));
    }
    deps.ttsLineInFlightRef.current = false;
    setTtsPlaybackActive(false);
    void remoteLog('[EMOTION_MODAL] tts_quiescence_wait_timeout', {
      audible: isWebInterviewPlaybackAudiblyActive(),
      tabRestorePending: deps.webTtsTabInterruptPendingReplayRef.current,
      parallelStreamActive: deps.parallelStreamingTtsRef.current.active,
      lineInFlight: deps.ttsLineInFlightRef.current,
    });
  }, [depsRef]);

  /** Wait only for audible HTML/audio playback — not muted parallel-stream tail or in-flight TTS locks. */
  const waitForWebInterviewTtsAudiblePlaybackBeforeEmotionModal = useCallback(async (): Promise<void> => {
    const deps = depsRef.current;
    if (Platform.OS !== 'web') return;
    const startedAt = Date.now();
    const deadline = startedAt + 60_000;
    while (Date.now() < deadline) {
      if (
        !isWebInterviewPlaybackAudiblyActive() &&
        !isWebInterviewPlaybackSurfaceActive() &&
        !deps.webTabRestoreReplayInFlightRef.current &&
        !deps.webTtsTabInterruptPendingReplayRef.current
      ) {
        // #region agent log
        fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d27a'},body:JSON.stringify({sessionId:'28d27a',location:'useInterviewWebTtsRuntime.ts:audible_wait_exit',message:'audible_wait_resolved',data:{waitMs:Date.now()-startedAt,audible:isWebInterviewPlaybackAudiblyActive(),surface:isWebInterviewPlaybackSurfaceActive(),tabRestore:deps.webTabRestoreReplayInFlightRef.current},timestamp:Date.now(),hypothesisId:'H1,H5'})}).catch(()=>{});
        // #endregion
        return;
      }
      await new Promise<void>((res) => setTimeout(res, 40));
    }
    void remoteLog('[EMOTION_MODAL] audible_playback_wait_timeout', {
      audible: isWebInterviewPlaybackAudiblyActive(),
      surface: isWebInterviewPlaybackSurfaceActive(),
      tabRestorePending: deps.webTtsTabInterruptPendingReplayRef.current,
    });
  }, [depsRef]);

  const clearStaleWebInterviewTtsRuntimeLocks = useCallback(
    (opts?: { recoverVoiceUi?: boolean; force?: boolean }): void => {
      const deps = depsRef.current;
      const preserveSpeakUtterance =
        !opts?.force && (deps.webTtsUtteranceInFlightRef.current?.trim().length ?? 0) > 0;
      deps.parallelStreamingTtsRef.current.active = false;
      if (!preserveSpeakUtterance) {
        deps.ttsLineInFlightRef.current = false;
        setTtsPlaybackActive(false);
        if (opts?.recoverVoiceUi || opts?.force) {
          deps.webTtsUtteranceInFlightRef.current = null;
          deps.webTtsUtteranceInFlightOptionsRef.current = null;
        }
        if (opts?.recoverVoiceUi) {
          if (
            deps.voiceStateRef.current === 'processing' ||
            deps.voiceStateRef.current === 'speaking'
          ) {
            deps.setVoiceState('idle');
          }
        }
      }
    },
    [depsRef],
  );

  const interruptAllWebInterviewTtsOutput = useCallback(
    (opts?: { preserveTabRestorePending?: boolean }): void => {
      const deps = depsRef.current;
      deps.webTtsSpeakGenerationRef.current += 1;
      deps.parallelStreamingTtsRef.current.cancelRequested = true;
      clearStaleWebInterviewTtsRuntimeLocks({ force: true });
      /**
       * When preserving tab-restore pending (user tapped "continue"), keep
       * `webTabRestoreReplayInFlightRef` so a second tap does not restart replay
       * mid-fetch / mid-playback. Clearing it here caused overlay+repeat loops.
       */
      if (!opts?.preserveTabRestorePending) {
        deps.webTabRestoreReplayInFlightRef.current = false;
        deps.pendingGestureRestoreSpeakRef.current = null;
        deps.webTtsTabInterruptPendingReplayRef.current = false;
        clearWebInterviewHtmlTabRestoreState();
      }
      void stopElevenLabsPlayback();
      stopElevenLabsSpeech();
    },
    [clearStaleWebInterviewTtsRuntimeLocks, depsRef],
  );

  const resolveStaleWebTtsRuntimeLockThresholdMs = useCallback((): number => {
    const deps = depsRef.current;
    if ((deps.webTtsUtteranceInFlightRef.current?.trim().length ?? 0) > 0) {
      return STALE_SPEAK_AWAITING_AUDIO_MS;
    }
    if (deps.parallelStreamingTtsRef.current.active) {
      return STALE_PARALLEL_STREAM_AWAITING_AUDIO_MS;
    }
    return STALE_TTS_RUNTIME_LOCK_MS;
  }, [depsRef]);

  const resolveMobileTabHideBackgroundUtterance = useCallback((): string | null => {
    const deps = depsRef.current;
    return (
      deps.parallelStreamingTtsRef.current.spokenCompleteText.trim() ||
      deps.parallelStreamingTtsRef.current.accumulatedFullText.trim() ||
      deps.webTtsUtteranceInFlightRef.current?.trim() ||
      deps.lastQuestionTextRef.current?.trim() ||
      null
    );
  }, [depsRef]);

  const isMobileWebInterviewTtsSessionActive = useCallback((): boolean => {
    const deps = depsRef.current;
    const rt = getSessionLogRuntime();
    return (
      isWebInterviewPlaybackAudiblyActive() ||
      isWebInterviewPlaybackSurfaceActive() ||
      hasWebInterviewHtmlAudioTabResumePending() ||
      deps.parallelStreamingTtsRef.current.active ||
      deps.ttsLineInFlightRef.current ||
      rt.ttsPlaybackActive ||
      deps.voiceStateRef.current === 'speaking'
    );
  }, [depsRef]);

  const armMobileWebBackgroundTtsContinue = useCallback((): boolean => {
    const deps = depsRef.current;
    if (Platform.OS !== 'web' || !getWebAutoplayContext().isMobileWeb) return false;
    if (!isMobileWebInterviewTtsSessionActive()) return false;
    if (!hasWebInterviewHtmlAudioTabResumePending()) {
      interruptWebInterviewTtsForTabHide();
    } else {
      refreshWebInterviewHtmlTabStashForRepeatHide();
    }
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
    deps.mobileTabHideLetPlaybackContinueRef.current = true;
    deps.mobileTabHideBackgroundUtteranceRef.current = resolveMobileTabHideBackgroundUtterance();
    deps.tabHiddenDuringActiveTtsLineRef.current = false;
    deps.webTtsTabInterruptPendingReplayRef.current = false;
    deps.pendingGestureRestoreSpeakRef.current = null;
    deps.needsGestureRestoreRef.current = false;
    deps.tabVisibilityGestureLossPendingRef.current = false;
    deps.setWebTabRestoreOverlayVisible(false);
    deps.setVoiceState('speaking');
    return true;
  }, [depsRef, isMobileWebInterviewTtsSessionActive, resolveMobileTabHideBackgroundUtterance]);

  const queueMobileWebHtmlResumeAfterScreenReturn = useCallback((): boolean => {
    const deps = depsRef.current;
    if (!hasWebInterviewHtmlAudioTabResumePending()) return false;
    const utterance =
      deps.mobileTabHideBackgroundUtteranceRef.current?.trim() ||
      resolveMobileTabHideBackgroundUtterance()?.trim() ||
      deps.webTtsUtteranceInFlightRef.current?.trim() ||
      deps.lastQuestionTextRef.current?.trim() ||
      '';
    if (!utterance) return false;
    deps.pendingGestureRestoreSpeakRef.current = {
      text: utterance,
      restoreMode: 'resume_html',
      queuedAtMs: Date.now(),
      options: { ...TAB_RESTORE_PENDING_SPEAK_OPTIONS },
      resolve: () => {},
      reject: () => {},
    };
    deps.webTtsTabInterruptPendingReplayRef.current = true;
    deps.needsGestureRestoreRef.current = true;
    deps.tabVisibilityGestureLossPendingRef.current = true;
    deps.mobileTabHideLetPlaybackContinueRef.current = false;
    deps.setWebTabRestoreOverlayVisible(true);
    deps.ensureWebGestureFlushListener();
    return true;
  }, [depsRef, resolveMobileTabHideBackgroundUtterance]);

  return {
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
  };
}
