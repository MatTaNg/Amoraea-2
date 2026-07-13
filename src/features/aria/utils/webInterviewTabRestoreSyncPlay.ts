import { Platform } from 'react-native';

import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { finalizeInterviewMicAmbientOnTtsEnd } from '@features/aria/utils/webInterviewMicPreInit';
import { TtsTabResumeFallbackError } from './webTtsGestureErrors';
import { isWebAudioAutoplayBlockedError } from './webTtsAutoplayPolicy';
import {
  assignWebInterviewTabRestorePlaybackEndHandlers,
  getWebInterviewTabRestoreStash,
  settleWebInterviewTabRestorePlaybackEnd,
} from './webInterviewTabRestoreStash';
import {
  applyTabStashedHtmlAudioVolume,
  getTabHtmlAudioResumeSnapshot,
  markTabRestoreSyncPlayStarted,
  setHtmlAudioPausedForTabResume,
  shouldSkipTabRestoreSyncPlay,
} from './webInterviewHtmlAudioTabResume';
import {
  assignAbortActiveWebHtmlAudioPlayback,
  claimWebHtmlAudioPlaybackHandoffForTabResume,
} from './webInterviewHtmlAudioPlaybackHooks';
import { ensureWebHtmlAudioElementMaxVolume } from './webInterviewHtmlAudioVolume';
import {
  assignActiveWebHtmlAudio,
  clearActiveWebHtmlAudio,
} from './webInterviewActiveHtmlAudio';
import {
  captureTabHtmlAudioResumeSnapshotFromElement,
  clearHtmlAudioTabResumeState,
  releaseWebInterviewTabRestoreStashForInterview,
} from './webInterviewTabRestoreCapture';

/**
 * Start tab-return HTML playback synchronously inside a user-gesture handler (no await before `play()`).
 * Returns false when no stashed blob / element is available.
 */
export function trySyncStartTabRestoreHtmlPlaybackInUserGesture(opts?: {
  onPlayStarted?: () => void;
  telemetrySource?: TtsTelemetrySource;
  /** Mobile web: replay from 0 (seek-after-tab-hide is unreliable). Desktop: resume at pause position. */
  replayFromStart?: boolean;
}): { started: boolean; done: Promise<void> } {
  const failDone = Promise.reject(new TtsTabResumeFallbackError());
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return { started: false, done: failDone };
  }
  let stash =
    getWebInterviewTabRestoreStash() ??
    (getTabHtmlAudioResumeSnapshot()
      ? {
          objectUrl: getTabHtmlAudioResumeSnapshot()!.objectUrl,
          resumeSeconds: getTabHtmlAudioResumeSnapshot()!.resumeSeconds,
        }
      : null);
  if (!stash?.objectUrl) {
    return { started: false, done: failDone };
  }

  const telemetrySource = opts?.telemetrySource ?? 'replay';
  const snapEl = getTabHtmlAudioResumeSnapshot()?.element;
  let el: HTMLAudioElement;
  if (snapEl && !snapEl.ended && typeof snapEl.play === 'function') {
    el = snapEl;
    const ct = el.currentTime;
    if (
      Number.isFinite(ct) &&
      (!Number.isFinite(stash.resumeSeconds) || ct > stash.resumeSeconds + 0.15)
    ) {
      captureTabHtmlAudioResumeSnapshotFromElement(el);
      stash =
        getWebInterviewTabRestoreStash() ??
        (getTabHtmlAudioResumeSnapshot()
          ? {
              objectUrl: getTabHtmlAudioResumeSnapshot()!.objectUrl,
              resumeSeconds: getTabHtmlAudioResumeSnapshot()!.resumeSeconds,
            }
          : stash);
    }
  } else {
    const AudioCtor = (globalThis as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
    if (!AudioCtor) {
      return { started: false, done: failDone };
    }
    el = new AudioCtor(stash.objectUrl);
    el.setAttribute('playsinline', '');
    if ('playsInline' in el) {
      (el as { playsInline: boolean }).playsInline = true;
    }
  }

  assignActiveWebHtmlAudio(el);
  const midUtteranceResume = !opts?.replayFromStart && stash.resumeSeconds > 0.05;
  if (midUtteranceResume) {
    applyTabStashedHtmlAudioVolume(el);
  } else {
    ensureWebHtmlAudioElementMaxVolume(el);
  }
  if (!(el.src ?? '').trim()) {
    el.src = stash.objectUrl;
  }
  const seekSec = opts?.replayFromStart ? 0 : stash.resumeSeconds;
  const playKey = `${stash.objectUrl}|${seekSec.toFixed(3)}`;
  if (shouldSkipTabRestoreSyncPlay(playKey)) {
    return { started: false, done: failDone };
  }
  if (!opts?.replayFromStart && !el.paused && !el.ended) {
    const ct = el.currentTime;
    if (Number.isFinite(ct)) {
      if (ct > seekSec + 0.35) {
        captureTabHtmlAudioResumeSnapshotFromElement(el);
        applyTabStashedHtmlAudioVolume(el);
        setHtmlAudioPausedForTabResume(false);
        assignActiveWebHtmlAudio(el);
        opts?.onPlayStarted?.();
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'play_ok',
          telemetrySource,
          html_audio_volume: el.volume,
          errorMessagePreview: `tab_restore_continue_ahead_at_s=${ct}`,
        });
        return { started: true, done: Promise.resolve() };
      }
      if (Math.abs(ct - seekSec) < 0.4) {
        applyTabStashedHtmlAudioVolume(el);
        setHtmlAudioPausedForTabResume(false);
        assignActiveWebHtmlAudio(el);
        opts?.onPlayStarted?.();
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'play_ok',
          telemetrySource,
          html_audio_volume: el.volume,
          errorMessagePreview: `tab_restore_continue_without_replay_at_s=${ct}`,
        });
        return { started: true, done: Promise.resolve() };
      }
    }
  }
  try {
    el.currentTime = seekSec;
  } catch {
    try {
      el.currentTime = 0;
    } catch {
      return { started: false, done: failDone };
    }
  }

  let doneResolve!: () => void;
  let doneReject!: (err: Error) => void;
  const done = new Promise<void>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });
  assignWebInterviewTabRestorePlaybackEndHandlers(doneResolve, doneReject);

  const playbackHandoff = claimWebHtmlAudioPlaybackHandoffForTabResume(stash.objectUrl);
  const onEnded = () => {
    finalizeInterviewMicAmbientOnTtsEnd();
    clearActiveWebHtmlAudio();
    setHtmlAudioPausedForTabResume(false);
    playbackHandoff?.completePlayback();
    clearHtmlAudioTabResumeState();
    releaseWebInterviewTabRestoreStashForInterview(true);
    settleWebInterviewTabRestorePlaybackEnd();
  };
  const onError = () => {
    el.removeEventListener('ended', onEnded);
    settleWebInterviewTabRestorePlaybackEnd(new TtsTabResumeFallbackError());
  };
  el.addEventListener('ended', onEnded, { once: true });
  el.addEventListener('error', onError, { once: true });

  try {
    markTabRestoreSyncPlayStarted(playKey);
    const playPromise = el.play();
    void playPromise
      .then(() => {
        setHtmlAudioPausedForTabResume(false);
        opts?.onPlayStarted?.();
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'play_ok',
          telemetrySource,
          html_audio_volume: el.volume,
          errorMessagePreview: opts?.replayFromStart
            ? `tab_restore_sync_from_start`
            : `tab_restore_sync_from_pause_at_s=${seekSec}`,
        });
      })
      .catch((playErr: unknown) => {
        el.removeEventListener('ended', onEnded);
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: isWebAudioAutoplayBlockedError(playErr) ? 'play_blocked_autoplay' : 'playback_timeout',
          telemetrySource,
          errorMessagePreview:
            playErr instanceof Error ? playErr.message.slice(0, 120) : 'tab_restore_sync_play_failed',
        });
        settleWebInterviewTabRestorePlaybackEnd(new TtsTabResumeFallbackError());
      });
    return { started: true, done };
  } catch {
    el.removeEventListener('ended', onEnded);
    settleWebInterviewTabRestorePlaybackEnd(new TtsTabResumeFallbackError());
    return { started: false, done: failDone };
  }
}
