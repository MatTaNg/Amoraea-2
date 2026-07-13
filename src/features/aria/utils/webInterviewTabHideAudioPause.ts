import { Platform } from 'react-native';

import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { finalizeInterviewMicAmbientOnTtsEnd } from '@features/aria/utils/webInterviewMicPreInit';
import { TtsTabResumeFallbackError } from './webTtsGestureErrors';
import { isWebAudioAutoplayBlockedError } from './webTtsAutoplayPolicy';
import {
  applyTabStashedHtmlAudioVolume,
  getTabHtmlAudioResumeSnapshot,
  hasWebInterviewHtmlAudioTabResumePending,
  setHtmlAudioPausedForTabResume,
} from './webInterviewHtmlAudioTabResume';
import {
  assignAbortActiveWebHtmlAudioPlayback,
  claimWebHtmlAudioPlaybackHandoffForTabResume,
} from './webInterviewHtmlAudioPlaybackHooks';
import { hasActiveWebBufferOrPcmPlayback } from './webInterviewWebAudioPlaybackSurface';
import {
  assignActiveWebHtmlAudio,
  clearActiveWebHtmlAudio,
  clearActiveWebHtmlAudioObjectUrlIfMatches,
  getActiveWebHtmlAudioElement,
} from './webInterviewActiveHtmlAudio';
import {
  captureTabHtmlAudioResumeSnapshot,
  clearHtmlAudioTabResumeState,
} from './webInterviewTabRestoreCapture';

/** True when HTML MP3 playback has started and has meaningful audio left (tab-hide soft pause). */
export function canSoftPauseActiveWebHtmlAudioForTabResume(): boolean {
  if (Platform.OS !== 'web') return false;
  if (hasActiveWebBufferOrPcmPlayback()) return false;
  const el = getActiveWebHtmlAudioElement();
  if (!el || el.ended) return false;
  const src = (el.src ?? '').trim();
  if (!src) return false;
  const t = el.currentTime;
  if (!Number.isFinite(t) || t < 0) return false;
  const d = el.duration;
  if (Number.isFinite(d) && d > 0 && t >= d - 0.35) return false;
  return true;
}

export function softPauseActiveWebHtmlAudioForTabHide(): void {
  if (!captureTabHtmlAudioResumeSnapshot()) return;
  /** Detach tab-hide abort without rejecting the in-flight `speakWithElevenLabs` promise. */
  assignAbortActiveWebHtmlAudioPlayback(null);
  try {
    getTabHtmlAudioResumeSnapshot()!.element.pause();
  } catch {
    /* ignore */
  }
  /** Snapshot retains the element — clear so {@link isWebInterviewPlaybackSurfaceActive} is false while paused. */
  clearActiveWebHtmlAudio();
}

export function tryPrepareWebInterviewHtmlAudioTabResume(): boolean {
  return canSoftPauseActiveWebHtmlAudioForTabResume() || hasWebInterviewHtmlAudioTabResumePending();
}

/** After `play()`, confirm the element is advancing (mobile tab-return can resolve play without audible output). */
async function verifyHtmlAudioAudibleAfterPlay(
  el: HTMLAudioElement,
  resumeAtSeconds: number,
  waitMs = 220
): Promise<boolean> {
  const t0 = el.currentTime;
  await new Promise((r) => setTimeout(r, waitMs));
  if (el.paused || el.ended) return false;
  if (el.currentTime > t0 + 0.02) return true;
  if (!el.paused && Number.isFinite(resumeAtSeconds) && el.currentTime >= resumeAtSeconds) return true;
  return false;
}

/**
 * Resume HTML MP3 playback after tab return (requires user gesture). Resolves when the utterance ends.
 * Throws {@link TtsTabResumeFallbackError} when resume is not possible — caller should replay from start.
 */
export async function resumeWebInterviewHtmlAudioAfterTabHide(
  telemetrySource: TtsTelemetrySource = 'replay',
  hooks?: { onPlayStarted?: () => void }
): Promise<void> {
  const snap = getTabHtmlAudioResumeSnapshot();
  if (!snap || snap.element.ended) {
    throw new TtsTabResumeFallbackError();
  }
  const el = snap.element;
  const resumeAt = snap.resumeSeconds;
  assignActiveWebHtmlAudio(el);
  if (!(el.src ?? '').trim() && snap.objectUrl) {
    el.src = snap.objectUrl;
  }
  /** Mid-utterance resume: avoid foreground route settle / global re-prime (speaker snap at end). */
  applyTabStashedHtmlAudioVolume(el);
  try {
    el.currentTime = resumeAt;
  } catch {
    throw new TtsTabResumeFallbackError();
  }
  const playbackHandoff = claimWebHtmlAudioPlaybackHandoffForTabResume(snap.objectUrl);
  return new Promise<void>((resolve, reject) => {
    let settled = false;
    let safetyTimeoutId: ReturnType<typeof setTimeout> | null = null;
    const finish = (action: 'resolve' | 'reject', err?: Error) => {
      if (settled) return;
      settled = true;
      if (safetyTimeoutId != null) clearTimeout(safetyTimeoutId);
      safetyTimeoutId = null;
      if (action === 'resolve') resolve();
      else reject(err ?? new TtsTabResumeFallbackError());
    };
    const scheduleEndedSafetyTimeout = () => {
      if (safetyTimeoutId != null) clearTimeout(safetyTimeoutId);
      const d = el.duration;
      const resumeAtSec = snap.resumeSeconds;
      const remainingSec =
        Number.isFinite(d) && d > 0
          ? Math.max(1, d - (Number.isFinite(resumeAtSec) ? resumeAtSec : 0))
          : 120;
      const safetyMs = Math.min(600_000, Math.ceil(remainingSec * 1000) + 5000);
      safetyTimeoutId = setTimeout(() => {
        if (el.ended) {
          finish('resolve');
          return;
        }
        try {
          el.pause();
        } catch {
          /* ignore */
        }
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'playback_timeout',
          telemetrySource,
          errorMessagePreview: `tab_resume_safety_ms=${safetyMs}`,
        });
        finish('reject', new TtsTabResumeFallbackError());
      }, safetyMs);
    };
    const onEnded = () => {
      clearActiveWebHtmlAudio();
      clearActiveWebHtmlAudioObjectUrlIfMatches(snap.objectUrl);
      try {
        URL.revokeObjectURL(snap.objectUrl);
      } catch {
        /* ignore */
      }
      setHtmlAudioPausedForTabResume(false);
      playbackHandoff?.completePlayback();
      clearHtmlAudioTabResumeState();
      finish('resolve');
    };
    const onError = () => {
      el.removeEventListener('ended', onEnded);
      setHtmlAudioPausedForTabResume(true);
      clearHtmlAudioTabResumeState();
      finish('reject', new TtsTabResumeFallbackError());
    };
    el.addEventListener('ended', onEnded, { once: true });
    el.addEventListener('error', onError, { once: true });
    const playTimeoutMs = 2500;
    void Promise.race([
      el.play(),
      new Promise<never>((_, rejectPlay) =>
        setTimeout(() => rejectPlay(new Error('tab_resume_play_timeout')), playTimeoutMs)
      ),
    ]).then(
      async () => {
        const audible = await verifyHtmlAudioAudibleAfterPlay(el, resumeAt);
        if (!audible) {
          el.removeEventListener('ended', onEnded);
          setHtmlAudioPausedForTabResume(true);
          logTtsAutoplayPlayOutcome({
            pipeline: 'elevenlabs_web_html_audio',
            outcome: 'playback_timeout',
            telemetrySource,
            errorMessagePreview: `tab_resume_not_audible_at_s=${resumeAt}`,
          });
          finish('reject', new TtsTabResumeFallbackError());
          return;
        }
        hooks?.onPlayStarted?.();
        setHtmlAudioPausedForTabResume(false);
        scheduleEndedSafetyTimeout();
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: 'play_ok',
          telemetrySource,
          errorMessagePreview: `tab_resume_from_pause_at_s=${resumeAt}`,
        });
      },
      (playErr: unknown) => {
        el.removeEventListener('ended', onEnded);
        setHtmlAudioPausedForTabResume(true);
        clearHtmlAudioTabResumeState();
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_html_audio',
          outcome: isWebAudioAutoplayBlockedError(playErr) ? 'play_blocked_autoplay' : 'playback_timeout',
          telemetrySource,
          errorMessagePreview:
            playErr instanceof Error ? playErr.message.slice(0, 120) : 'tab_resume_play_failed',
        });
        finish('reject', new TtsTabResumeFallbackError());
      }
    );
  });
}
