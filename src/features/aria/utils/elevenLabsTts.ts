import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { logAndApplyPlaybackModeForTts, applyWebInterviewForegroundTtsSettle } from './audioModeHelpers';
import { runWithThreeAttemptsFixedBackoff } from '@utilities/networkRetry';
import { classifyError } from '@utilities/withRetry';
import {
  setTtsBufferCompleteBeforePlaybackForNextPlayback,
  setTtsPlaybackStrategyForNextPlayback,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { computeElevenLabsEnabled } from './elevenLabsEnvGating';
import { getWebSpeechDeferFromNavigatorSnapshot } from './webSpeechDeferPolicy';
import {
  TtsTabResumeFallbackError,
  WebInterviewTtsTabHiddenAbortError,
  WebTtsRequiresUserGestureError,
} from './webTtsGestureErrors';
import { supabase } from '@data/supabase/client';
import {
  isIosSafariMobileWeb,
  logTtsAutoplayPlayOutcome,
  type TtsAutoplayPipeline,
  type TtsTelemetrySource,
} from '@features/aria/telemetry/tsAutoplayTelemetry';
import { getSessionLogRuntime } from '@utilities/sessionLogging/sessionLogContext';

const TTS_PCM_STREAM_PIPELINE: TtsAutoplayPipeline = 'elevenlabs_web_pcm_stream';
import {
  beginInterviewMicPreInitDuringTts,
  finalizeInterviewMicAmbientOnTtsEnd,
  type PreInitTriggerDuring,
} from '@features/aria/utils/webInterviewMicPreInit';
import { markWebTabBecameVisible } from './webInterviewGestureContext';
import { takePreAuthorizedAudioElementForTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';

/** Avoid top-level `expo-av` import — it breaks web lazy-load of the interview chunk (SDK 53+). */
function getExpoAvAudio(): typeof import('expo-av').Audio {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-av').Audio;
}

/**
 * Jessica — warm, friendly, conversational (ElevenLabs). Override with
 * EXPO_PUBLIC_ELEVENLABS_VOICE_ID or app config elevenLabsVoiceId if needed.
 *
 * **Credits / environment:** ElevenLabs network TTS is off in dev bundles (`__DEV__`, including
 * `expo start` / localhost web) so no credits are used. Release/production builds use ElevenLabs when configured.
 * - `EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV=1` — allow ElevenLabs while developing (optional).
 * - `EXPO_PUBLIC_ELEVENLABS_TTS=0` — disable in any build (e.g. staging preview).
 */
const DEFAULT_VOICE_ID = 'cgSgspJ2msm6clMCkdW9'; // Jessica — warm, friendly

/** Last spoken chunk tail — passed as ElevenLabs `previous_text` for prosody continuity across split requests. */
let elevenLabsPreviousTextContext = '';

const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.22,
  similarity_boost: 0.82,
  /** Lower style reduces long dramatic pauses at commas / periods within an utterance. */
  style: 0.42,
  use_speaker_boost: true,
} as const;

function takePreviousTextForElevenLabsRequest(): string | undefined {
  const prev = elevenLabsPreviousTextContext.trim();
  if (!prev) return undefined;
  return prev.slice(-200);
}

function recordElevenLabsSpokenContext(text: string): void {
  const t = text.trim();
  if (!t) return;
  elevenLabsPreviousTextContext = t.slice(-300);
}

export function resetElevenLabsSpokenContext(): void {
  elevenLabsPreviousTextContext = '';
}

/** True when ElevenLabs network TTS is allowed (production builds; not default __DEV__). */
function isElevenLabsEnabledForEnvironment(): boolean {
  return computeElevenLabsEnabled({
    isDevBundle: typeof __DEV__ !== 'undefined' && __DEV__,
    env: {
      EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV:
        typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV : undefined,
      EXPO_PUBLIC_ELEVENLABS_TTS:
        typeof process !== 'undefined' ? process.env?.EXPO_PUBLIC_ELEVENLABS_TTS : undefined,
    },
  });
}

/** When false on iOS (default), use expo-speech so output stays on loudspeaker after recording (expo-av MP3 regresses to earpiece). Set EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK=1 to force ElevenLabs MP3 on iOS. */
function iosUseElevenLabsMp3Playback(): boolean {
  const v =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_IOS_ELEVENLABS_TTS_PLAYBACK) || '';
  const s = String(v).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
}

let activeWebAudio: { pause(): void; currentTime: number; ended?: boolean; duration?: number } | null =
  null;
/** Blob URL for in-flight HTML MP3 playback — kept through tab-hide soft pause until `ended`. */
let activeWebHtmlAudioObjectUrl: string | null = null;
/** Set on tab-hide soft pause; used to restore `currentTime` after return (some browsers reset position). */
let htmlAudioPausedForTabResume = false;
let tabPausedHtmlAudioResumeSeconds: number | null = null;
/** After mid-utterance tab resume, block global volume re-prime briefly (avoids speaker snap). */
let webInterviewTabResumeVolumeLockedUntilMs: number | null = null;
const WEB_TAB_RESUME_VOLUME_LOCK_MS = 30_000;

type TabHtmlAudioResumeSnapshot = {
  element: HTMLAudioElement;
  objectUrl: string;
  resumeSeconds: number;
  /** `<audio>` volume when tab hide soft-paused — avoid speaker snap on mid-utterance resume. */
  volume: number;
};

/** Strong ref to paused `<audio>` — survives `activeWebAudio = null` during tab hide. */
let tabHtmlAudioResumeSnapshot: TabHtmlAudioResumeSnapshot | null = null;

/** Blob + seek preserved across {@link stopElevenLabsPlayback} for tab-return replay. */
let webInterviewTabRestoreStash: { objectUrl: string; resumeSeconds: number } | null = null;
let webInterviewTabRestoreEndResolve: (() => void) | null = null;
let webInterviewTabRestoreEndReject: ((err: Error) => void) | null = null;

export function hasWebInterviewTabRestoreStash(): boolean {
  return Platform.OS === 'web' && webInterviewTabRestoreStash != null;
}

export function pauseActiveWebInterviewHtmlAudioWithoutRevoke(): void {
  if (Platform.OS !== 'web') return;
  const el = getActiveWebHtmlAudioElement();
  if (el) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
  activeWebAudio = null;
}

function releaseWebInterviewTabRestoreStash(revokeObjectUrl: boolean): void {
  if (revokeObjectUrl && webInterviewTabRestoreStash?.objectUrl) {
    const url = webInterviewTabRestoreStash.objectUrl;
    if (activeWebHtmlAudioObjectUrl === url) {
      activeWebHtmlAudioObjectUrl = null;
    }
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  webInterviewTabRestoreStash = null;
}

function settleWebInterviewTabRestorePlaybackEnd(err?: Error): void {
  if (err) {
    webInterviewTabRestoreEndReject?.(err);
  } else {
    webInterviewTabRestoreEndResolve?.();
  }
  webInterviewTabRestoreEndResolve = null;
  webInterviewTabRestoreEndReject = null;
}

/** Tracks in-flight Web Speech API utterance for tab-hide partial resume (not seekable). */
let webSpeechSynthTabResumeState: { fullText: string; startedAtMs: number } | null = null;
const WEB_SPEECH_SYNTH_EST_CHARS_PER_SEC = 14;

/** Call before tab-hide cancels speechSynthesis — returns remaining text estimate, or null. */
export function captureWebSpeechSynthTabRestoreText(): string | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const snap = webSpeechSynthTabResumeState;
  if (!snap?.fullText.trim()) return null;
  const speaking = window.speechSynthesis?.speaking === true;
  const elapsedMs = Date.now() - snap.startedAtMs;
  if (!speaking && elapsedMs > 4000) return null;
  const spokenChars = Math.floor((elapsedMs / 1000) * WEB_SPEECH_SYNTH_EST_CHARS_PER_SEC);
  const remaining = snap.fullText.slice(Math.min(spokenChars, snap.fullText.length)).trim();
  if (remaining.length < 12) return null;
  return remaining;
}

function clearWebSpeechSynthTabResumeState(): void {
  webSpeechSynthTabResumeState = null;
}

function clearHtmlAudioTabResumeState(): void {
  htmlAudioPausedForTabResume = false;
  tabPausedHtmlAudioResumeSeconds = null;
  tabHtmlAudioResumeSnapshot = null;
  webInterviewTabResumeVolumeLockedUntilMs = null;
  lastTabRestoreSyncPlayKey = null;
  lastTabRestoreSyncPlayAtMs = 0;
}

function shouldSkipWebInterviewTtsVolumeReprime(): boolean {
  if (Platform.OS !== 'web') return false;
  if (htmlAudioPausedForTabResume || hasWebInterviewHtmlAudioTabResumePending()) return true;
  return (
    webInterviewTabResumeVolumeLockedUntilMs != null &&
    Date.now() < webInterviewTabResumeVolumeLockedUntilMs
  );
}

function isWebHtmlAudioMidUtteranceTabResumeElement(el: HTMLAudioElement): boolean {
  if (!htmlAudioPausedForTabResume && !hasWebInterviewHtmlAudioTabResumePending()) {
    return false;
  }
  const snap = tabHtmlAudioResumeSnapshot;
  return (
    snap?.element === el &&
    Number.isFinite(snap.resumeSeconds) &&
    snap.resumeSeconds > 0.05
  );
}

/** True while tab-hide stash or post-resume volume lock is active — skip route/volume re-prime. */
export function isWebInterviewMidUtteranceTabResumeActive(): boolean {
  return shouldSkipWebInterviewTtsVolumeReprime();
}

/** Restore pre-pause `<audio>` volume on the stashed or active element (mobile tab/home return). */
export function restoreWebInterviewTabStashedPlaybackVolume(el?: HTMLAudioElement): void {
  if (Platform.OS !== 'web') return;
  const target = el ?? tabHtmlAudioResumeSnapshot?.element ?? getActiveWebHtmlAudioElement();
  if (target) applyTabStashedHtmlAudioVolume(target);
}

let lastTabRestoreSyncPlayKey: string | null = null;
let lastTabRestoreSyncPlayAtMs = 0;
const TAB_RESTORE_SYNC_DEDUPE_MS = 900;

function captureTabHtmlAudioResumeSnapshotFromElement(el: HTMLAudioElement): boolean {
  if (Platform.OS !== 'web') return false;
  if (activePcmStreamSources.length > 0 || activeWebBufferSource != null) return false;
  if (el.ended) return false;
  const resumeSeconds = el.currentTime;
  if (!Number.isFinite(resumeSeconds) || resumeSeconds < 0) return false;
  const objectUrl = (el.src ?? activeWebHtmlAudioObjectUrl ?? tabHtmlAudioResumeSnapshot?.objectUrl ?? '').trim();
  if (!objectUrl) return false;
  const d = el.duration;
  if (Number.isFinite(d) && d > 0 && resumeSeconds >= d - 0.35) return false;
  let volume = 1;
  try {
    const v = el.volume;
    if (Number.isFinite(v) && v > 0) volume = v;
  } catch {
    /* ignore */
  }
  tabHtmlAudioResumeSnapshot = { element: el, objectUrl, resumeSeconds, volume };
  webInterviewTabRestoreStash = { objectUrl, resumeSeconds };
  tabPausedHtmlAudioResumeSeconds = resumeSeconds;
  htmlAudioPausedForTabResume = true;
  return true;
}

function captureTabHtmlAudioResumeSnapshot(): boolean {
  const el = getActiveWebHtmlAudioElement();
  if (!el) return false;
  return captureTabHtmlAudioResumeSnapshotFromElement(el);
}

/**
 * Repeat tab-hide while stash is still pending: refresh pause position + volume instead of
 * leaving a stale seek (second resume replays from an old `currentTime` → overlap / volume snap).
 */
export function refreshWebInterviewHtmlTabStashForRepeatHide(): void {
  if (Platform.OS !== 'web') return;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return;
  const el = getTabStashedHtmlAudioElement() ?? getActiveWebHtmlAudioElement();
  if (!el || el.ended) return;
  if (!el.paused) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
  if (!captureTabHtmlAudioResumeSnapshotFromElement(el)) return;
  abortActiveWebHtmlAudioPlayback = null;
  activeWebAudio = null;
}

/** Rejects in-flight HTML audio playback promises when the tab hides (avoids wall-clock safety timeout resolving as "complete"). */
let abortActiveWebHtmlAudioPlayback: (() => void) | null = null;

/** Links tab-resume playback to the original {@link speakWithElevenLabs} HTML promise (clears safety timeout + resolves on `ended`). */
type WebHtmlAudioPlaybackHandoff = {
  clearSafetyTimeout: () => void;
  completePlayback: () => void;
  objectUrl: string;
};
let activeWebHtmlAudioPlaybackHandoff: WebHtmlAudioPlaybackHandoff | null = null;

function claimWebHtmlAudioPlaybackHandoffForTabResume(
  objectUrl: string
): WebHtmlAudioPlaybackHandoff | null {
  const handoff = activeWebHtmlAudioPlaybackHandoff;
  if (!handoff || handoff.objectUrl !== objectUrl) return null;
  handoff.clearSafetyTimeout();
  return handoff;
}

/** Rejects in-flight Web Audio buffer playback when the tab hides. */
let abortActiveWebBufferAudioPlayback: (() => void) | null = null;

function abortInFlightWebInterviewPlaybackForTabHide(opts?: { includeHtmlAudio?: boolean }): void {
  if (opts?.includeHtmlAudio !== false) {
    abortActiveWebHtmlAudioPlayback?.();
    abortActiveWebHtmlAudioPlayback = null;
  }
  abortActiveWebBufferAudioPlayback?.();
  abortActiveWebBufferAudioPlayback = null;
}

function getActiveWebHtmlAudioElement(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || !activeWebAudio) return null;
  const el = activeWebAudio as HTMLAudioElement;
  if (typeof el.play !== 'function' || typeof el.pause !== 'function') return null;
  return el;
}

function getTabStashedHtmlAudioElement(): HTMLAudioElement | null {
  if (Platform.OS !== 'web') return null;
  const snap = tabHtmlAudioResumeSnapshot;
  if (!snap || snap.element.ended) return null;
  return snap.element;
}

/**
 * Chrome may auto-resume a soft-paused utterance when the tab becomes visible before our handoff
 * runs — pause it so resume goes through a single controlled path (clears safety timeout overlap).
 */
export function holdTabStashedHtmlAudioForGestureResume(): boolean {
  if (Platform.OS !== 'web') return false;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return false;
  const el = getTabStashedHtmlAudioElement();
  if (!el) return false;
  if (!el.ended) {
    /** Chrome may advance `currentTime` while away — refresh stash before pause/resume (avoids overlap snap). */
    captureTabHtmlAudioResumeSnapshotFromElement(el);
  }
  if (!el.paused && !el.ended) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
  htmlAudioPausedForTabResume = true;
  return true;
}

/** Sync tab-stash seek position + volume from the stashed element (navigation/home return). */
export function syncTabStashHtmlAudioPositionForResumeReturn(): boolean {
  if (Platform.OS !== 'web') return false;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return false;
  const el = getTabStashedHtmlAudioElement();
  if (!el || el.ended) return false;
  return captureTabHtmlAudioResumeSnapshotFromElement(el);
}

/** Re-link soft-paused HTML audio to the in-flight speak promise (clears wall-clock safety timeout). */
export function attachTabStashHtmlAudioPlaybackHandoff(): boolean {
  if (Platform.OS !== 'web') return false;
  const snap = tabHtmlAudioResumeSnapshot;
  if (!snap || snap.element.ended) return false;
  activeWebAudio = snap.element;
  const handoff = claimWebHtmlAudioPlaybackHandoffForTabResume(snap.objectUrl);
  if (handoff) {
    abortActiveWebHtmlAudioPlayback = null;
  }
  return handoff != null;
}

/** True when HTML MP3 playback has started and has meaningful audio left (tab-hide soft pause). */
export function canSoftPauseActiveWebHtmlAudioForTabResume(): boolean {
  if (Platform.OS !== 'web') return false;
  if (activePcmStreamSources.length > 0 || activeWebBufferSource != null) return false;
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

export function hasWebInterviewHtmlAudioTabResumePending(): boolean {
  if (Platform.OS !== 'web') return false;
  if (webInterviewTabRestoreStash != null) return true;
  const snap = tabHtmlAudioResumeSnapshot;
  if (!snap || snap.element.ended) return false;
  return Number.isFinite(snap.resumeSeconds) && snap.resumeSeconds >= 0;
}

/** Drop stashed HTML tab-resume state (snapshot + blob URL). Safe after replay or dismiss. */
export function clearWebInterviewHtmlTabRestoreState(): void {
  if (Platform.OS !== 'web') return;
  try {
    tabHtmlAudioResumeSnapshot?.element.pause();
  } catch {
    /* ignore */
  }
  clearHtmlAudioTabResumeState();
  releaseWebInterviewTabRestoreStash(true);
  if (webInterviewTabRestoreEndResolve) {
    webInterviewTabRestoreEndResolve();
  }
  webInterviewTabRestoreEndResolve = null;
  webInterviewTabRestoreEndReject = null;
}

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
    webInterviewTabRestoreStash ??
    (tabHtmlAudioResumeSnapshot
      ? {
          objectUrl: tabHtmlAudioResumeSnapshot.objectUrl,
          resumeSeconds: tabHtmlAudioResumeSnapshot.resumeSeconds,
        }
      : null);
  if (!stash?.objectUrl) {
    return { started: false, done: failDone };
  }

  const telemetrySource = opts?.telemetrySource ?? 'replay';
  const snapEl = tabHtmlAudioResumeSnapshot?.element;
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
        webInterviewTabRestoreStash ??
        (tabHtmlAudioResumeSnapshot
          ? {
              objectUrl: tabHtmlAudioResumeSnapshot.objectUrl,
              resumeSeconds: tabHtmlAudioResumeSnapshot.resumeSeconds,
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

  activeWebAudio = el;
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
  const playDedupeNow = Date.now();
  if (
    lastTabRestoreSyncPlayKey === playKey &&
    playDedupeNow - lastTabRestoreSyncPlayAtMs < TAB_RESTORE_SYNC_DEDUPE_MS
  ) {
    return { started: false, done: failDone };
  }
  if (!opts?.replayFromStart && !el.paused && !el.ended) {
    const ct = el.currentTime;
    if (Number.isFinite(ct)) {
      if (ct > seekSec + 0.35) {
        captureTabHtmlAudioResumeSnapshotFromElement(el);
        applyTabStashedHtmlAudioVolume(el);
        htmlAudioPausedForTabResume = false;
        activeWebAudio = el;
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
        htmlAudioPausedForTabResume = false;
        activeWebAudio = el;
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
  webInterviewTabRestoreEndResolve = doneResolve;
  webInterviewTabRestoreEndReject = doneReject;

  const playbackHandoff = claimWebHtmlAudioPlaybackHandoffForTabResume(stash.objectUrl);
  const onEnded = () => {
    finalizeInterviewMicAmbientOnTtsEnd();
    activeWebAudio = null;
    htmlAudioPausedForTabResume = false;
    playbackHandoff?.completePlayback();
    clearHtmlAudioTabResumeState();
    releaseWebInterviewTabRestoreStash(true);
    settleWebInterviewTabRestorePlaybackEnd();
  };
  const onError = () => {
    el.removeEventListener('ended', onEnded);
    settleWebInterviewTabRestorePlaybackEnd(new TtsTabResumeFallbackError());
  };
  el.addEventListener('ended', onEnded, { once: true });
  el.addEventListener('error', onError, { once: true });

  try {
    lastTabRestoreSyncPlayKey = playKey;
    lastTabRestoreSyncPlayAtMs = playDedupeNow;
    const playPromise = el.play();
    void playPromise
      .then(() => {
        htmlAudioPausedForTabResume = false;
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

/** Wait until sync-started tab-restore HTML audio finishes (or fails). */
export function waitForWebInterviewTabRestorePlaybackEnd(timeoutMs = 600_000): Promise<void> {
  if (Platform.OS !== 'web') return Promise.resolve();
  const el = getActiveWebHtmlAudioElement();
  if (!el || el.ended) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      webInterviewTabRestoreEndResolve = null;
      webInterviewTabRestoreEndReject = null;
      reject(new TtsTabResumeFallbackError());
    }, timeoutMs);
    webInterviewTabRestoreEndResolve = () => {
      clearTimeout(timeoutId);
      webInterviewTabRestoreEndResolve = null;
      webInterviewTabRestoreEndReject = null;
      resolve();
    };
    webInterviewTabRestoreEndReject = (err: Error) => {
      clearTimeout(timeoutId);
      webInterviewTabRestoreEndResolve = null;
      webInterviewTabRestoreEndReject = null;
      reject(err);
    };
  });
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

function softPauseActiveWebHtmlAudioForTabHide(): void {
  if (!captureTabHtmlAudioResumeSnapshot()) return;
  /** Detach tab-hide abort without rejecting the in-flight `speakWithElevenLabs` promise. */
  abortActiveWebHtmlAudioPlayback = null;
  try {
    tabHtmlAudioResumeSnapshot!.element.pause();
  } catch {
    /* ignore */
  }
  /** Snapshot retains the element — clear so {@link isWebInterviewPlaybackSurfaceActive} is false while paused. */
  activeWebAudio = null;
}

export function tryPrepareWebInterviewHtmlAudioTabResume(): boolean {
  return canSoftPauseActiveWebHtmlAudioForTabResume() || hasWebInterviewHtmlAudioTabResumePending();
}

/**
 * Resume HTML MP3 playback after tab return (requires user gesture). Resolves when the utterance ends.
 * Throws {@link TtsTabResumeFallbackError} when resume is not possible — caller should replay from start.
 */
export async function resumeWebInterviewHtmlAudioAfterTabHide(
  telemetrySource: TtsTelemetrySource = 'replay',
  hooks?: { onPlayStarted?: () => void }
): Promise<void> {
  const snap = tabHtmlAudioResumeSnapshot;
  if (!snap || snap.element.ended) {
    throw new TtsTabResumeFallbackError();
  }
  const el = snap.element;
  const resumeAt = snap.resumeSeconds;
  activeWebAudio = el;
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
      const resumeAt = snap.resumeSeconds;
      const remainingSec =
        Number.isFinite(d) && d > 0
          ? Math.max(1, d - (Number.isFinite(resumeAt) ? resumeAt : 0))
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
      activeWebAudio = null;
      if (activeWebHtmlAudioObjectUrl === snap.objectUrl) {
        activeWebHtmlAudioObjectUrl = null;
      }
      try {
        URL.revokeObjectURL(snap.objectUrl);
      } catch {
        /* ignore */
      }
      htmlAudioPausedForTabResume = false;
      playbackHandoff?.completePlayback();
      clearHtmlAudioTabResumeState();
      finish('resolve');
    };
    const onError = () => {
      el.removeEventListener('ended', onEnded);
      htmlAudioPausedForTabResume = true;
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
          htmlAudioPausedForTabResume = true;
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
        htmlAudioPausedForTabResume = false;
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
        htmlAudioPausedForTabResume = true;
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

/** Web Audio API playback (decode + BufferSource) — often allowed after `unlockWebAudioForAutoplay` without a second tap, unlike HTMLAudio after async fetch. */
let activeWebBufferSource: AudioBufferSourceNode | null = null;

/** Web: sequential PCM stream chunks (ElevenLabs raw L16) — all stopped in {@link stopElevenLabsPlayback}. */
const activePcmStreamSources: AudioBufferSourceNode[] = [];

/**
 * Incremented when tab hides or {@link stopElevenLabsPlayback} runs so in-flight PCM stream readers
 * stop calling {@link AudioBufferSourceNode#start} (Chrome suspend/resume + continued scheduling → overlap/static).
 */
let webInterviewTtsScheduleEpoch = 0;

function bumpWebInterviewTtsScheduleEpoch(): void {
  webInterviewTtsScheduleEpoch += 1;
}

const ELEVENLABS_PCM_STREAM_SAMPLE_RATE = 24_000;
const ELEVENLABS_PCM_MIN_START_BYTES = 4_800;
const LONG_TTS_USE_STREAMING_MIN_CHARS = 100;

/** After `unlockWebAudioForAutoplay()` runs in a tap handler — primes AudioContext (silent tick). */
let sharedWebAudioContext: AudioContext | null = null;

/** Debug: non-zero peak/rms indicates decoded MP3 is not silent (hypothesis H2). */
function debugSummarizeAudioBufferPeaks(buf: AudioBuffer): {
  durationSec: number;
  sampleRate: number;
  channels: number;
  peak: number;
  rms: number;
} {
  const ch0 = buf.getChannelData(0);
  const n = Math.min(ch0.length, 96_000);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const v = ch0[i]!;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
  }
  return {
    durationSec: buf.duration,
    sampleRate: buf.sampleRate,
    channels: buf.numberOfChannels,
    peak,
    rms: Math.sqrt(sumSq / Math.max(1, n)),
  };
}

/**
 * Web interview session: true only after a successful `unlockWebAudioForAutoplay()` in this session.
 * TTS must not run until set — avoids WEB_TTS_GESTURE when autoplay unlock never ran in a user gesture.
 */
let webInterviewAudioUnlocked = false;

/** ElevenLabs MP3 `blob:` URL kept when `play()` hits autoplay policy; replay from mic tap in the user-gesture stack. */
let pendingWebGestureBlobUrl: string | null = null;

/** Minimal silent WAV — used to unlock a shared HTMLAudioElement in the mic-stop gesture so later async TTS can `play()` without a second tap. */
const SILENT_WAV_DATA_URL =
  'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==';

/**
 * Shared element for mobile web MP3: primed with `primeHtmlAudioForMobileTtsFromMicGesture` (mic release / press)
 * so `play()` after async ElevenLabs fetch is not blocked as a new gesture.
 */
let sharedHtmlAudioForMobileTts: HTMLAudioElement | null = null;

/**
 * Facebook / Instagram / Line / LinkedIn in-app browsers run embedded WebViews where chunked PCM +
 * Web Audio overlaps badly with HTML audio after `visibilitychange` (garbled / static). Same pipeline
 * as desktop: MP3 fetch → HTMLAudio or Web Audio decode only.
 */
function webEmbeddedInAppBrowserDiscouragesPcmStream(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') return false;
  const ua = navigator.userAgent;
  if (/FBAN|FBAV|FBIOS|FB_IAB/i.test(ua)) return true;
  if (/Instagram/i.test(ua)) return true;
  if (/\bLine\//i.test(ua)) return true;
  if (/\bLinkedInApp\//i.test(ua)) return true;
  return false;
}

/**
 * iOS browsers (including Brave/Chrome/Firefox on iPhone/iPad) all use WebKit under the hood.
 * PCM streaming is static-prone there; force non-PCM paths like mobile Safari.
 */
function isIosWebkitMobileWebLike(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIosDevice = /\b(iPhone|iPad|iPod)\b/i.test(ua);
  const isAppleWebKit = /\bAppleWebKit\/\d+/i.test(ua);
  const isMobile = /\bMobile\/\w+/i.test(ua) || /Mobi/i.test(ua);
  return isIosDevice && isAppleWebKit && isMobile;
}

/** Conservative guard: mobile browsers are more static-prone with PCM chunk scheduling. */
function isAnyMobileWebBrowser(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent || ''
  );
}

/** One listener: resume shared `AudioContext` / reprime HTML audio when the tab becomes visible again (Safari suspends on hide). */
let webInterviewAudioVisibilityListenerAttached = false;
/** True when the last tab-hide actually paused/stopped interview playback (skip idle reprime on return). */
let webTabHideAudioTeardownApplied = false;

export function debugNoteWebAudioRouteChange(source: string, routeData?: Record<string, unknown>): void {
  if (Platform.OS !== 'web') return;
  void source;
  void routeData;
  void sharedWebAudioContext;
}

/** Force full media volume on web HTML audio (Android mobile web can sound quiet without this). */
export function ensureWebHtmlAudioElementMaxVolume(
  el: HTMLAudioElement,
  opts?: { force?: boolean },
): void {
  if (Platform.OS !== 'web') return;
  if (!opts?.force && shouldSkipWebInterviewTtsVolumeReprime()) {
    if (isWebHtmlAudioMidUtteranceTabResumeElement(el)) {
      applyTabStashedHtmlAudioVolume(el);
    }
    return;
  }
  try {
    el.volume = 1;
    el.muted = false;
  } catch {
    /* ignore */
  }
}

/** Mid-utterance tab resume: restore pre-pause level instead of re-priming to max (avoids speaker snap). */
function applyTabStashedHtmlAudioVolume(el: HTMLAudioElement): void {
  if (Platform.OS !== 'web') return;
  const snap = tabHtmlAudioResumeSnapshot;
  const vol =
    snap?.element === el && Number.isFinite(snap.volume) && snap.volume > 0
      ? snap.volume
      : null;
  try {
    el.muted = false;
    if (vol != null) {
      el.volume = vol;
      webInterviewTabResumeVolumeLockedUntilMs = Date.now() + WEB_TAB_RESUME_VOLUME_LOCK_MS;
    }
  } catch {
    /* ignore */
  }
}

/** Keep interview TTS at full `<audio>` volume across shared, active, and pre-authorized elements. */
export function ensureWebInterviewTtsOutputVolumePrimed(): void {
  if (Platform.OS !== 'web') return;
  if (shouldSkipWebInterviewTtsVolumeReprime()) return;
  if (sharedHtmlAudioForMobileTts) ensureWebHtmlAudioElementMaxVolume(sharedHtmlAudioForMobileTts);
  if (activeWebAudio) ensureWebHtmlAudioElementMaxVolume(activeWebAudio as HTMLAudioElement);
}

const HTML_MEDIA_HAVE_ENOUGH_DATA = 4;

/**
 * Mobile Chrome often clips the first syllables when `play()` runs before decode finishes.
 * Wait for `canplaythrough` (with timeout) and reset position before audible playback.
 */
export async function waitForWebHtmlAudioElementReady(
  el: HTMLAudioElement,
  timeoutMs = 8000,
  options?: { skipExplicitLoad?: boolean; preservePlaybackPosition?: boolean },
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const preservePosition =
    options?.preservePlaybackPosition || isWebHtmlAudioMidUtteranceTabResumeElement(el);
  if (preservePosition) {
    applyTabStashedHtmlAudioVolume(el);
  } else {
    ensureWebHtmlAudioElementMaxVolume(el, { force: true });
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  if (el.readyState >= HTML_MEDIA_HAVE_ENOUGH_DATA) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('canplaythrough', finish);
      el.removeEventListener('loadeddata', finish);
      clearTimeout(tid);
      resolve();
    };
    el.addEventListener('canplaythrough', finish, { once: true });
    el.addEventListener('loadeddata', finish, { once: true });
    const tid = setTimeout(finish, timeoutMs);
    if (!options?.skipExplicitLoad) {
      try {
        el.load();
      } catch {
        /* ignore */
      }
    }
  });
}

/** Volume of the active web HTML audio element — for session telemetry only. */
export function getActiveWebHtmlAudioVolumeForTelemetry(): number | null {
  if (Platform.OS !== 'web' || !activeWebAudio) return null;
  try {
    const v = activeWebAudio.volume;
    return Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

function attachWebInterviewAudioVisibilityHandler(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (webInterviewAudioVisibilityListenerAttached) return;
  webInterviewAudioVisibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      pauseWebInterviewHtmlAudioForDocumentHidden();
      return;
    }
    void handleWebInterviewDocumentVisibilityChange();
  });
}

async function handleWebInterviewDocumentVisibilityChange(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  markWebTabBecameVisible();
  const hadTeardown = webTabHideAudioTeardownApplied;
  webTabHideAudioTeardownApplied = false;
  const tabResumePending = hasWebInterviewHtmlAudioTabResumePending();
  if (tabResumePending) {
    holdTabStashedHtmlAudioForGestureResume();
  }
  const ctx = sharedWebAudioContext;
  /** Resume only when we tore down on hide, or Chrome suspended the context in the background. */
  const needsContextResume =
    !tabResumePending &&
    (hadTeardown || (ctx != null && ctx.state !== 'closed' && ctx.state !== 'running'));
  if (needsContextResume) {
    await ensureSharedWebAudioContextResumedForPlayback('other');
  }
  if (hadTeardown && !tabResumePending) {
    reprimeSharedHtmlAudioSilentPlay();
  }
}

/** Silent tick on the shared HTMLAudio element — does not replace `src` while that element is playing real TTS. */
function reprimeSharedHtmlAudioSilentPlay(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!sharedHtmlAudioForMobileTts) return;
  try {
    if (activeWebAudio === sharedHtmlAudioForMobileTts && !sharedHtmlAudioForMobileTts.paused) {
      return;
    }
    sharedHtmlAudioForMobileTts.src = SILENT_WAV_DATA_URL;
    sharedHtmlAudioForMobileTts.muted = true;
    sharedHtmlAudioForMobileTts.volume = 1;
    void sharedHtmlAudioForMobileTts
      .play()
      .then(() => {
        try {
          if (activeWebAudio !== sharedHtmlAudioForMobileTts) {
            sharedHtmlAudioForMobileTts?.pause();
            if (sharedHtmlAudioForMobileTts) {
              sharedHtmlAudioForMobileTts.currentTime = 0;
              ensureWebHtmlAudioElementMaxVolume(sharedHtmlAudioForMobileTts);
            }
          }
        } catch {
          /* ignore */
        }
      })
      .catch(() => {
        if (sharedHtmlAudioForMobileTts) ensureWebHtmlAudioElementMaxVolume(sharedHtmlAudioForMobileTts);
      });
  } catch {
    /* ignore */
  }
}

/**
 * Safari and some browsers suspend `AudioContext` when the tab is hidden. Call before web playback
 * (and after any await) so TTS does not fail with autoplay/gesture errors on the next line.
 */
async function ensureSharedWebAudioContextResumedForPlayback(
  telemetrySource: TtsTelemetrySource
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return true;
  const ctx = sharedWebAudioContext;
  if (!ctx || !webInterviewAudioUnlocked) return true;
  if (ctx.state === 'closed') return false;
  /** `resume()` is a no-op when already `running`; call for `suspended` and any other non-running state (e.g. post–tab-hide Chrome). */
  if (ctx.state === 'running') return true;
  try {
    await Promise.race([
      ctx.resume(),
      new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('resume-timeout')), 5000);
      }),
    ]);
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_web_audio_context',
      outcome: 'play_error',
      telemetrySource,
      errorName: 'resume',
      errorMessagePreview: msg.slice(0, 120),
    });
    return false;
  }
}

async function ensureWebPlaybackPrimedForNextTurn(
  telemetrySource: TtsTelemetrySource,
  opts?: { skipSilentReprime?: boolean },
): Promise<void> {
  if (!hasWebInterviewHtmlAudioTabResumePending()) {
    ensureWebInterviewTtsOutputVolumePrimed();
  }
  await ensureSharedWebAudioContextResumedForPlayback(telemetrySource);
  if (!opts?.skipSilentReprime && !hasWebInterviewHtmlAudioTabResumePending()) {
    reprimeSharedHtmlAudioSilentPlay();
  }
}

function shouldSkipSilentReprimeForTelemetry(telemetrySource: TtsTelemetrySource): boolean {
  if (hasWebInterviewHtmlAudioTabResumePending()) return true;
  if (telemetrySource !== 'replay') return false;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getMsSinceWebTabBecameVisible } = require('./webInterviewGestureContext') as typeof import('./webInterviewGestureContext');
  const msSinceTabVisible = getMsSinceWebTabBecameVisible();
  return msSinceTabVisible != null && msSinceTabVisible < 20000;
}

export { WebTtsRequiresUserGestureError, isWebTtsRequiresUserGestureError } from './webTtsGestureErrors';

/** Chromium blocks `HTMLAudioElement.play()` without a prior user gesture (mobile Brave, Chrome, etc.). */
function isWebAudioAutoplayBlockedError(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false;
  const name = 'name' in err ? String((err as { name?: string }).name) : '';
  const msg = 'message' in err ? String((err as { message?: string }).message) : String(err);
  if (name === 'NotAllowedError') return true;
  if (/not allowed|notallowed|user gesture|interaction/i.test(msg)) return true;
  return false;
}

/**
 * Mobile browsers often block or silently drop async speechSynthesis / autoplay without a user gesture.
 * Defer to tap-to-speak (see AriaScreen + mic). Includes Android phones (e.g. Brave) — not only WebKit iOS.
 */
export function webSpeechShouldDeferToUserGesture(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  return getWebSpeechDeferFromNavigatorSnapshot({
    userAgent: navigator.userAgent || '',
    platform: navigator.platform,
    maxTouchPoints: navigator.maxTouchPoints,
  });
}

/** Mobile web: opening mic capture during TTS ducks playback — pre-init runs after the turn instead. */
function kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring: PreInitTriggerDuring): void {
  if (webSpeechShouldDeferToUserGesture()) return;
  void beginInterviewMicPreInitDuringTts(preInitTriggerDuring);
}

/** Native ElevenLabs MP3 playback; must be stopped/unloaded before starting another clip. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- expo-av Sound instance
let activeNativeTtsSound: any = null;

function applyAmoraeaPronunciation(text: string): string {
  // Custom pronunciation dictionary fallback: enforce consistent spoken rendering.
  return text.replace(/\bamoraea\b/gi, 'Ah-mor-AY-ah');
}

function getResolvedSupabaseUrl(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacy =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2 =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  const fromProcess =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_URL) || '';
  const fromConfig =
    (extra?.supabaseUrl as string | undefined) ??
    (extra?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (legacy?.supabaseUrl as string | undefined) ??
    (legacy?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (manifest2?.supabaseUrl as string | undefined) ??
    (manifest2?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    (easConfig?.supabaseUrl as string | undefined) ??
    (easConfig?.EXPO_PUBLIC_SUPABASE_URL as string | undefined) ??
    '';
  const fromEnv = (fromProcess || fromConfig).trim().replace(/\/+$/, '');
  if (fromEnv) return fromEnv;
  const maybeSupabase = supabase as unknown as { supabaseUrl?: string; rest?: { url?: string } };
  if (typeof maybeSupabase.supabaseUrl === 'string' && maybeSupabase.supabaseUrl.trim()) {
    return maybeSupabase.supabaseUrl.trim().replace(/\/+$/, '');
  }
  const restUrl = maybeSupabase.rest?.url;
  if (typeof restUrl === 'string' && restUrl.trim()) {
    return restUrl.replace(/\/rest\/v1\/?$/, '').trim().replace(/\/+$/, '');
  }
  return '';
}

function getTtsProxyUrl(): string {
  const explicit =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL) ||
    (Constants.expoConfig?.extra as { elevenLabsTtsProxyUrl?: string; EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL?: string } | undefined)?.elevenLabsTtsProxyUrl ||
    (Constants.expoConfig?.extra as { elevenLabsTtsProxyUrl?: string; EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL?: string } | undefined)?.EXPO_PUBLIC_ELEVENLABS_TTS_PROXY_URL ||
    '';
  if (explicit.trim()) return explicit.trim();
  const supabaseUrl = getResolvedSupabaseUrl();
  return supabaseUrl ? `${supabaseUrl}/functions/v1/elevenlabs-tts-proxy` : '';
}

/** Same pattern as AriaScreen whisper proxy — Supabase gateway requires Bearer anon or session JWT. */
function getResolvedSupabaseAnonKey(): string {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacy =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2 =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  const fromProcess =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '';
  const fromConfig =
    (extra?.supabaseAnonKey as string | undefined) ??
    (extra?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (legacy?.supabaseAnonKey as string | undefined) ??
    (legacy?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (manifest2?.supabaseAnonKey as string | undefined) ??
    (manifest2?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    (easConfig?.supabaseAnonKey as string | undefined) ??
    (easConfig?.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined) ??
    '';
  const fromEnv = (fromProcess || fromConfig).trim();
  if (fromEnv) return fromEnv;
  const maybeSupabase = supabase as unknown as {
    supabaseKey?: string;
    rest?: { headers?: Record<string, string> };
  };
  const fromClientKey = typeof maybeSupabase.supabaseKey === 'string' ? maybeSupabase.supabaseKey.trim() : '';
  if (fromClientKey) return fromClientKey;
  const fromRestHeader = (
    maybeSupabase.rest?.headers?.apikey ??
    maybeSupabase.rest?.headers?.Authorization ??
    ''
  )
    .replace(/^Bearer\s+/i, '')
    .trim();
  return fromRestHeader;
}

async function buildSupabaseEdgeFunctionAuthHeaders(): Promise<Record<string, string>> {
  const anon = getResolvedSupabaseAnonKey();
  if (anon) {
    return { Authorization: `Bearer ${anon}`, apikey: anon };
  }
  const sessionResult = await supabase.auth.getSession().catch(() => null);
  const token = sessionResult?.data?.session?.access_token?.trim();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

const getApiKey = (): string => {
  const fromProcess =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_API_KEY) || '';
  const expoConfigExtra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacyManifestExtra =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2Extra =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  const fromConfig =
    (expoConfigExtra?.elevenLabsApiKey as string | undefined) ??
    (expoConfigExtra?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    (legacyManifestExtra?.elevenLabsApiKey as string | undefined) ??
    (legacyManifestExtra?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    (manifest2Extra?.elevenLabsApiKey as string | undefined) ??
    (manifest2Extra?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    (easConfig?.elevenLabsApiKey as string | undefined) ??
    (easConfig?.EXPO_PUBLIC_ELEVENLABS_API_KEY as string | undefined) ??
    '';
  const resolved = (fromProcess || fromConfig).trim();
  return resolved;
};

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk) as unknown as number[]);
  }
  if (typeof globalThis !== 'undefined' && typeof (globalThis as unknown as { btoa?: (s: string) => string }).btoa === 'function') {
    return (globalThis as unknown as { btoa: (s: string) => string }).btoa(binary);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64');
  }
  throw new Error('No base64 encoder available');
}

/**
 * Stop web audio, expo-speech, and any in-progress native MP3 from a prior TTS call.
 * Await this before starting new playback so clips cannot overlap.
 */
/**
 * Tear down active web TTS outputs when the document is hidden.
 * Chrome suspends AudioContext in background tabs; leaving PCM stream nodes or AudioBufferSourceNode
 * attached can produce static/noise after resume. Clear `activeWebAudio` like {@link stopElevenLabsPlayback}
 * so {@link isWebInterviewPlaybackSurfaceActive} does not stay true while paused.
 */
function suspendSharedWebAudioContextForTabHide(): void {
  if (Platform.OS !== 'web') return;
  const ctx = sharedWebAudioContext;
  if (!ctx || ctx.state === 'closed') return;
  if (ctx.state === 'running') {
    void ctx.suspend().catch(() => {});
  }
}

/**
 * Tear down active web TTS outputs when the document is hidden.
 * Suspends the shared AudioContext so background tabs do not advance decoded audio silently.
 * HTML audio is paused without seeking — full utterance replay is handled in AriaScreen.
 */
export function pauseWebInterviewHtmlAudioForDocumentHidden(): void {
  if (Platform.OS !== 'web') return;
  if (hasWebInterviewHtmlAudioTabResumePending()) {
    webTabHideAudioTeardownApplied = true;
    suspendSharedWebAudioContextForTabHide();
    refreshWebInterviewHtmlTabStashForRepeatHide();
    return;
  }
  const softPauseHtmlInitial = canSoftPauseActiveWebHtmlAudioForTabResume();
  const hasActivePlayback =
    isWebInterviewPlaybackSurfaceActive() ||
    softPauseHtmlInitial ||
    (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true);
  if (!hasActivePlayback) {
    webTabHideAudioTeardownApplied = false;
    return;
  }
  webTabHideAudioTeardownApplied = true;
  /** Stop PCM / Web Audio buffer first — they block {@link canSoftPauseActiveWebHtmlAudioForTabResume}. */
  if (activePcmStreamSources.length > 0) {
    for (const s of activePcmStreamSources) {
      try {
        s.stop(0);
      } catch {
        /* ignore */
      }
    }
    activePcmStreamSources.length = 0;
  }
  if (activeWebBufferSource) {
    try {
      activeWebBufferSource.stop(0);
    } catch {
      /* ignore */
    }
    activeWebBufferSource = null;
  }
  const softPauseHtml = canSoftPauseActiveWebHtmlAudioForTabResume();
  if (!softPauseHtml) {
    clearHtmlAudioTabResumeState();
    bumpWebInterviewTtsScheduleEpoch();
  }
  abortInFlightWebInterviewPlaybackForTabHide({ includeHtmlAudio: !softPauseHtml });
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (softPauseHtml) {
    softPauseActiveWebHtmlAudioForTabHide();
    suspendSharedWebAudioContextForTabHide();
    return;
  }
  if (activeWebAudio) {
    try {
      activeWebAudio.pause();
    } catch {
      /* ignore */
    }
    activeWebAudio = null;
    activeWebHtmlAudioObjectUrl = null;
    clearHtmlAudioTabResumeState();
  }
  suspendSharedWebAudioContextForTabHide();
}

/** Same as {@link pauseWebInterviewHtmlAudioForDocumentHidden} — explicit name for tab-switch interrupt path. */
export function interruptWebInterviewTtsForTabHide(): void {
  pauseWebInterviewHtmlAudioForDocumentHidden();
}

/** Optional hooks for playback surfaces owned outside this module (e.g. prefetched greeting `<audio>`). */
type WebInterviewExtraPlaybackHooks = {
  stop?: () => void;
  isActive?: () => boolean;
};
let extraWebInterviewPlaybackHooks: WebInterviewExtraPlaybackHooks = {};

export function registerExtraWebInterviewPlaybackHooks(
  hooks: WebInterviewExtraPlaybackHooks,
): void {
  extraWebInterviewPlaybackHooks = hooks;
}

/**
 * Web: true while interview TTS might still be using Web Audio / HTMLAudio / speechSynthesis output.
 * Use after {@link stopElevenLabsPlayback} to poll until surfaces are idle before opening the mic.
 */
export function isWebInterviewPlaybackSurfaceActive(): boolean {
  if (Platform.OS !== 'web') return false;
  if (activeWebAudio != null || activeWebBufferSource != null || activePcmStreamSources.length > 0) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true) return true;
  if (extraWebInterviewPlaybackHooks.isActive?.()) return true;
  return false;
}

/** Like {@link isWebInterviewPlaybackSurfaceActive} but false for paused HTML audio (iOS tab background). */
export function isWebInterviewPlaybackAudiblyActive(): boolean {
  if (Platform.OS !== 'web') return false;
  const el = getActiveWebHtmlAudioElement();
  if (el) {
    return !el.paused && !el.ended;
  }
  const stashEl = getTabStashedHtmlAudioElement();
  if (stashEl && !stashEl.paused && !stashEl.ended) {
    return true;
  }
  if (activeWebBufferSource != null || activePcmStreamSources.length > 0) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true) return true;
  if (extraWebInterviewPlaybackHooks.isActive?.()) return true;
  return false;
}

export async function stopElevenLabsPlayback(): Promise<void> {
  if (Platform.OS === 'web') {
    extraWebInterviewPlaybackHooks.stop?.();
    clearHtmlAudioTabResumeState();
    bumpWebInterviewTtsScheduleEpoch();
  }
  if (Platform.OS === 'web' && pendingWebGestureBlobUrl) {
    const tabStashUrl = webInterviewTabRestoreStash?.objectUrl ?? null;
    if (pendingWebGestureBlobUrl !== tabStashUrl) {
      try {
        URL.revokeObjectURL(pendingWebGestureBlobUrl);
      } catch {
        /* ignore */
      }
    }
    pendingWebGestureBlobUrl = null;
  }
  if (Platform.OS === 'web' && activePcmStreamSources.length > 0) {
    for (const s of activePcmStreamSources) {
      try {
        s.stop(0);
      } catch {
        /* ignore */
      }
    }
    activePcmStreamSources.length = 0;
  }
  if (Platform.OS === 'web' && activeWebBufferSource) {
    try {
      activeWebBufferSource.stop(0);
    } catch {
      /* ignore */
    }
    activeWebBufferSource = null;
  }
  if (Platform.OS === 'web' && activeWebAudio) {
    try {
      activeWebAudio.pause();
      activeWebAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeWebAudio = null;
  }
  if (Platform.OS === 'web' && activeWebHtmlAudioObjectUrl) {
    const tabStashUrl = webInterviewTabRestoreStash?.objectUrl ?? null;
    if (activeWebHtmlAudioObjectUrl !== tabStashUrl) {
      try {
        URL.revokeObjectURL(activeWebHtmlAudioObjectUrl);
      } catch {
        /* ignore */
      }
    }
    activeWebHtmlAudioObjectUrl = null;
  }
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  Speech.stop();
  if (Platform.OS !== 'web') {
    const s = activeNativeTtsSound;
    activeNativeTtsSound = null;
    if (s) {
      try {
        await s.stopAsync();
      } catch {
        /* ignore */
      }
      try {
        await s.unloadAsync();
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Call **synchronously** from a real user gesture (Start interview, mic `onPressIn`, mic permission, etc.).
 * Creates/resumes a shared `AudioContext` and plays a minimal silent buffer so later MP3 playback via
 * `decodeAudioData` + `AudioBufferSourceNode` is allowed without another tap (avoids HTMLAudio T12 on Brave/Chrome).
 * Sets {@link webInterviewAudioUnlocked} on success so `speakWithElevenLabs` / `speakFallback` may run.
 */
export function unlockWebAudioForAutoplay(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    if (!sharedWebAudioContext) {
      sharedWebAudioContext = new AC();
    }
    void sharedWebAudioContext.resume();
    const ctx = sharedWebAudioContext;
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    webInterviewAudioUnlocked = true;
    attachWebInterviewAudioVisibilityHandler();
    if (!isWebInterviewMidUtteranceTabResumeActive()) {
      ensureWebInterviewTtsOutputVolumePrimed();
    }
  } catch {
    /* ignore — TTS will throw WebTtsRequiresUserGestureError until a successful unlock */
  }
}

/** Reset at each new interview session so the first gesture in that session must unlock again. */
export function resetWebInterviewAudioSession(): void {
  webInterviewAudioUnlocked = false;
  resetElevenLabsSpokenContext();
  clearWebInterviewHtmlTabRestoreState();
}

/** Whether web audio has been unlocked in the current interview session (shared context is ready). */
export function isWebInterviewAudioUnlocked(): boolean {
  return Platform.OS !== 'web' || webInterviewAudioUnlocked;
}

/** Shared mobile-web `<audio>` for interview TTS — reused across parallel-stream chunks. */
export function ensureSharedHtmlAudioElementForInterviewTts(): HTMLAudioElement | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const AudioCtor = (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
  if (!AudioCtor) return null;
  if (!sharedHtmlAudioForMobileTts) {
    sharedHtmlAudioForMobileTts = new AudioCtor();
    const el = sharedHtmlAudioForMobileTts;
    el.setAttribute('playsinline', '');
    if ('playsInline' in el) {
      (el as { playsInline: boolean }).playsInline = true;
    }
    el.preload = 'auto';
    ensureWebHtmlAudioElementMaxVolume(el);
  }
  return sharedHtmlAudioForMobileTts;
}

/**
 * Call synchronously from the same user-gesture stack as mic stop (`onBeforeWebRecorderStop`) or mic press.
 * Plays a silent clip on a shared `HTMLAudioElement` so a later async MP3 `play()` is allowed without an extra tap.
 */
export function primeHtmlAudioForMobileTtsFromMicGesture(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!webSpeechShouldDeferToUserGesture()) return;
  try {
    const el = ensureSharedHtmlAudioElementForInterviewTts();
    if (!el) return;
    el.src = SILENT_WAV_DATA_URL;
    try {
      el.muted = true;
      el.volume = 1;
      void el
        .play()
        .then(() => {
          try {
            el.pause();
            el.currentTime = 0;
            ensureWebHtmlAudioElementMaxVolume(el);
          } catch {
            /* ignore */
          }
        })
        .catch(() => {
          ensureWebHtmlAudioElementMaxVolume(el);
        });
    } catch {
      ensureWebHtmlAudioElementMaxVolume(el);
    }
  } catch {
    /* ignore */
  }
}

/**
 * ElevenLabs MP3 via `decodeAudioData` + `AudioBufferSourceNode` on the shared `AudioContext`
 * primed by `unlockWebAudioForAutoplay()` (mic / start interview). Often survives mobile autoplay
 * policy better than `HTMLAudioElement.play()` after async fetch.
 */
async function tryPlayElevenLabsMp3WithWebAudio(
  arrayBuffer: ArrayBuffer,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource,
  preInitTriggerDuring: PreInitTriggerDuring,
  playbackRateMultiplier: number = 1
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const ctx = sharedWebAudioContext;
  if (!ctx || !webInterviewAudioUnlocked) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;
  const epochCapture = webInterviewTtsScheduleEpoch;
  const epochStale = () => epochCapture !== webInterviewTtsScheduleEpoch;
  const decodeTimeoutMs = 15000;
  let decoded: AudioBuffer;
  try {
    decoded = await Promise.race([
      ctx.decodeAudioData(arrayBuffer.slice(0)),
      new Promise<AudioBuffer>((_, reject) => {
        setTimeout(() => reject(new Error('decode-timeout')), decodeTimeoutMs);
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_web_audio_context',
      outcome: 'play_error',
      telemetrySource,
      errorName: 'decode',
      errorMessagePreview: msg.slice(0, 120),
    });
    return false;
  }
  if (epochStale()) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;
  if (epochStale()) return false;
  let src: AudioBufferSourceNode | null = null;
  try {
    src = ctx.createBufferSource();
    src.buffer = decoded;
    src.playbackRate.value = playbackRateMultiplier;
    const durSec = decoded.duration;
    /** Safety only: decoded buffer duration + 3000ms — never use char estimate; primary completion is `onended`. */
    const playbackCapMs = Math.min(
      600_000,
      Math.max(4_000, Math.ceil(((Number.isFinite(durSec) ? durSec : 30) * 1000) / playbackRateMultiplier) + 3_000)
    );

    const decodeDbg = debugSummarizeAudioBufferPeaks(decoded);
    const rt0 = getSessionLogRuntime();

    const handlePlaybackRaceError = (raceErr: unknown): false => {
      const msg = raceErr instanceof Error ? raceErr.message : String(raceErr);
      if (msg === 'playback-timeout' && src) {
        try {
          src.stop(0);
        } catch {
          /* ignore */
        }
        if (activeWebBufferSource === src) activeWebBufferSource = null;
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_audio_context',
          outcome: 'play_error',
          telemetrySource,
          errorName: 'playback-timeout',
          errorMessagePreview: `capMs=${playbackCapMs}`,
        });
        return false;
      }
      throw raceErr;
    };

    let playbackAnalyser: AnalyserNode | null = null;
    try {
      playbackAnalyser = ctx.createAnalyser();
      playbackAnalyser.fftSize = 512;
      src.connect(playbackAnalyser);
      playbackAnalyser.connect(ctx.destination);
    } catch {
      src.connect(ctx.destination);
      playbackAnalyser = null;
    }
    activeWebBufferSource = src;
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const clearBufferAbort = () => {
            if (abortActiveWebBufferAudioPlayback === abortBufferPlayback) {
              abortActiveWebBufferAudioPlayback = null;
            }
          };
          const abortBufferPlayback = () => {
            clearBufferAbort();
            try {
              src!.stop(0);
            } catch {
              /* ignore */
            }
            if (activeWebBufferSource === src) activeWebBufferSource = null;
            reject(new WebInterviewTtsTabHiddenAbortError());
          };
          abortActiveWebBufferAudioPlayback = abortBufferPlayback;
          src!.onended = () => {
            clearBufferAbort();
            finalizeInterviewMicAmbientOnTtsEnd();
            if (activeWebBufferSource === src) activeWebBufferSource = null;
            resolve();
          };
          try {
            if (epochStale()) {
              if (activeWebBufferSource === src) activeWebBufferSource = null;
              try {
                src!.disconnect();
              } catch {
                /* ignore */
              }
              try {
                playbackAnalyser?.disconnect();
              } catch {
                /* ignore */
              }
              reject(new WebInterviewTtsTabHiddenAbortError());
              return;
            }
            src!.start(0);
            onPlaybackStarted?.();
            void kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_audio_context',
              outcome: 'play_ok',
              telemetrySource,
            });
          } catch (e) {
            if (activeWebBufferSource === src) activeWebBufferSource = null;
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('playback-timeout')), playbackCapMs);
        }),
      ]);
      return true;
    } catch (raceErr) {
      if (raceErr instanceof WebInterviewTtsTabHiddenAbortError) {
        throw raceErr;
      }
      const msg = raceErr instanceof Error ? raceErr.message : String(raceErr);
      if (msg === 'tts-schedule-aborted') {
        throw new WebInterviewTtsTabHiddenAbortError();
      }
      return handlePlaybackRaceError(raceErr);
    }
  } catch (err) {
    if (src && activeWebBufferSource === src) activeWebBufferSource = null;
    const e = err instanceof Error ? err : new Error(String(err));
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_web_audio_context',
      outcome: 'play_error',
      telemetrySource,
      errorName: e.name,
      errorMessagePreview: e.message?.slice(0, 120),
    });
    return false;
  }
}

/**
 * Speak text using ElevenLabs TTS (warm, natural voice).
 * Falls back to expo-speech if API key is missing or request fails.
 * Returns a promise that resolves when playback finishes (or fallback completes).
 */
export type ElevenLabsSpeakOptions = {
  /** Called once when audio actually starts (MP3 play() resolved, native playAsync, or fallback speech start). */
  onPlaybackStarted?: () => void;
  /** Baseline: which interviewer line this is (greeting vs mid-interview turn). */
  telemetry?: { source?: TtsTelemetrySource };
  /**
   * Full MP3 from a prior {@link fetchElevenLabsMpegArrayBuffer} — skips network fetch (e.g. prefetched segments).
   */
  prefetchedMpegArrayBuffer?: ArrayBuffer;
  /**
   * When chaining segments, skip `stopElevenLabsPlayback` at entry so the prior segment is not torn down mid-handoff.
   */
  skipStopElevenLabsPlaybackBeforeStart?: boolean;
  /** Parallel-stream 2nd+ sentence: skip silent HTML reprime (avoids Android/BT speaker snap between chunks). */
  skipWebPlaybackPriming?: boolean;
  /** Skip `reprimeSharedHtmlAudioSilentPlay` during priming (post-recording / parallel-stream continuations). */
  skipSilentWebPlaybackReprime?: boolean;
  /** Parallel streaming: never open mic capture during playback (Android speaker duck / route snap). */
  skipMicPreInitDuringPlayback?: boolean;
  /**
   * Parallel-stream handoffs: always play on the shared mobile `<audio>` element so Android Chrome
   * does not re-route speaker output when swapping blob URLs between consecutive chunks.
   */
  chainHtmlAudioPlayback?: boolean;
  /** Web mic pre-init audit: which phase last warmed the inactive MediaRecorder. */
  preInitTriggerDuring?: PreInitTriggerDuring;
  /** Web: force full MP3 download + Web Audio / HTML audio — skip raw PCM stream (retry path after truncated playback). */
  skipPcmStream?: boolean;
  /** Optional playback-rate multiplier for output pipelines that support it. */
  playbackRateMultiplier?: number;
};

function getLocalDevPlaybackRateMultiplier(): number {
  if (!(typeof __DEV__ !== 'undefined' && __DEV__)) return 1;
  if (Platform.OS !== 'web' || typeof window === 'undefined') return 1;
  const h = window.location.hostname.toLowerCase();
  const isLocal = h === 'localhost' || h === '127.0.0.1' || h === '::1';
  return isLocal ? 2 : 1;
}

function getEffectivePlaybackRateMultiplier(explicit?: number): number {
  const base = explicit ?? getLocalDevPlaybackRateMultiplier();
  if (!Number.isFinite(base) || base <= 0) return 1;
  return Math.min(4, Math.max(0.5, base));
}

/**
 * Fetch ElevenLabs MP3 bytes without playing. Same availability matrix as {@link speakWithElevenLabs}.
 * Used to prefetch multiple segments before sequential playback (no gap between downloads).
 */
export async function fetchElevenLabsMpegArrayBuffer(
  text: string,
  opts?: { allowBeforeWebUnlock?: boolean }
): Promise<ArrayBuffer | null> {
  const spokenText = applyAmoraeaPronunciation(text ?? '');
  if (!spokenText.trim()) return null;
  if (!isElevenLabsEnabledForEnvironment()) return null;
  if (Platform.OS === 'ios' && !iosUseElevenLabsMp3Playback()) return null;
  const proxyUrl = getTtsProxyUrl();
  const apiKey = getApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  const voiceId =
    fromExtra?.elevenLabsVoiceId ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID) ||
    DEFAULT_VOICE_ID;
  if (!apiKey && !useProxy) return null;
  if (Platform.OS === 'web' && !webInterviewAudioUnlocked && !opts?.allowBeforeWebUnlock) return null;

  try {
    const modelId = 'eleven_multilingual_v2';
    const previousText = takePreviousTextForElevenLabsRequest();
    const bodyPayload = {
      text: spokenText.trim(),
      model_id: modelId,
      voice_settings: { ...ELEVENLABS_VOICE_SETTINGS },
      ...(previousText ? { previous_text: previousText } : {}),
    };
    const proxyAuth = useProxy ? await buildSupabaseEdgeFunctionAuthHeaders() : {};
    const fetchTimeoutMs = 45000;
    const ttsShouldRetry = (err: unknown): boolean => classifyError(err) !== 'unrecoverable';

    const doOneTtsFetch = async (): Promise<Response> => {
      const ac = new AbortController();
      const fetchTimer = setTimeout(() => ac.abort(), fetchTimeoutMs);
      try {
        const r = await fetch(
          useProxy ? proxyUrl : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
          useProxy
            ? {
                signal: ac.signal,
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Accept: 'audio/mpeg',
                  ...proxyAuth,
                },
                body: JSON.stringify({
                  text: bodyPayload.text,
                  voiceId,
                  modelId: bodyPayload.model_id,
                  voiceSettings: bodyPayload.voice_settings,
                  ...(bodyPayload.previous_text ? { previousText: bodyPayload.previous_text } : {}),
                }),
              }
            : {
                signal: ac.signal,
                method: 'POST',
                headers: {
                  'xi-api-key': apiKey,
                  'Content-Type': 'application/json',
                  Accept: 'audio/mpeg',
                },
                body: JSON.stringify(bodyPayload),
              }
        );
        if (!r.ok) {
          const errText = await r.text();
          const err = new Error(errText.slice(0, 200));
          Object.assign(err, { status: r.status });
          throw err;
        }
        return r;
      } catch (e) {
        const name = typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: string }).name) : '';
        if (name === 'AbortError') {
          console.warn('ElevenLabs TTS fetch timed out');
          const err = new Error('tts_fetch_timeout');
          Object.assign(err, { status: 504 });
          throw err;
        }
        throw e;
      } finally {
        clearTimeout(fetchTimer);
      }
    };

    let res: Response;
    try {
      res = await runWithThreeAttemptsFixedBackoff({
        delaysMs: [1000, 2000],
        shouldRetry: (err) => ttsShouldRetry(err),
        onRetry: ({ nextAttempt, delayMs, error }) => {
          if (__DEV__) {
            console.warn('[TTS] ElevenLabs fetch retry', { nextAttempt, delayMs, error });
          }
        },
        run: async () => doOneTtsFetch(),
      });
    } catch (e) {
      const name = typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: string }).name) : '';
      if (name === 'AbortError') return null;
      console.warn('ElevenLabs TTS fetch failed after retries:', e);
      return null;
    }

    try {
      return await Promise.race([
        res.arrayBuffer(),
        new Promise<ArrayBuffer>((_, reject) => {
          setTimeout(() => reject(new Error('arraybuffer-timeout')), 90000);
        }),
      ]);
    } catch {
      console.warn('ElevenLabs TTS response body read timed out');
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Web: opens ElevenLabs **streaming** PCM (raw s16le mono) for low time-to-first-sample vs full MP3 buffer.
 * Returns the Response or null on failure. Caller must read the body; do not use with non-stream proxy.
 */
async function openElevenLabsPcmStreamRequest(spokenText: string): Promise<Response | null> {
  if (!isElevenLabsEnabledForEnvironment()) return null;
  if (Platform.OS === 'web' && !webInterviewAudioUnlocked) return null;
  if (!spokenText.trim()) return null;
  const proxyUrl = getTtsProxyUrl();
  const apiKey = getApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  const voiceId =
    fromExtra?.elevenLabsVoiceId ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID) ||
    DEFAULT_VOICE_ID;
  if (!apiKey && !useProxy) return null;

  const modelId = 'eleven_multilingual_v2';
  const previousText = takePreviousTextForElevenLabsRequest();
  const voiceSettings = { ...ELEVENLABS_VOICE_SETTINGS };
  const q = new URLSearchParams({
    output_format: 'pcm_24000',
    optimize_streaming_latency: '2',
  });
  const bodyPayload = {
    text: spokenText.trim(),
    model_id: modelId,
    voice_settings: voiceSettings,
    ...(previousText ? { previous_text: previousText } : {}),
  };
  const proxyAuth = useProxy ? await buildSupabaseEdgeFunctionAuthHeaders() : {};
  const fetchTimeoutMs = 45000;
  const ttsShouldRetry = (err: unknown): boolean => classifyError(err) !== 'unrecoverable';

  const doOnePcmStreamFetch = async (): Promise<Response> => {
    const ac = new AbortController();
    const fetchTimer = setTimeout(() => ac.abort(), fetchTimeoutMs);
    try {
      const r = await fetch(
        useProxy
          ? proxyUrl
          : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?${q.toString()}`,
        useProxy
          ? {
              signal: ac.signal,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Accept: 'audio/pcm, audio/*, */*',
                ...proxyAuth,
              },
              body: JSON.stringify({
                text: bodyPayload.text,
                voiceId,
                modelId: bodyPayload.model_id,
                voiceSettings: bodyPayload.voice_settings,
                stream: true,
                outputFormat: 'pcm_24000',
                ...(bodyPayload.previous_text ? { previousText: bodyPayload.previous_text } : {}),
              }),
            }
          : {
              signal: ac.signal,
              method: 'POST',
              headers: {
                'xi-api-key': apiKey!,
                'Content-Type': 'application/json',
                Accept: 'audio/pcm, audio/*, */*',
              },
              body: JSON.stringify(bodyPayload),
            }
      );
      if (!r.ok) {
        const errText = await r.text();
        const err = new Error(errText.slice(0, 200));
        Object.assign(err, { status: r.status });
        throw err;
      }
      if (!r.body) {
        throw new Error('pcm_stream_no_body');
      }
      return r;
    } catch (e) {
      const name = typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: string }).name) : '';
      if (name === 'AbortError') {
        const err = new Error('tts_fetch_timeout');
        Object.assign(err, { status: 504 });
        throw err;
      }
      throw e;
    } finally {
      clearTimeout(fetchTimer);
    }
  };

  try {
    if (!useProxy) {
      return await runWithThreeAttemptsFixedBackoff({
        delaysMs: [1000, 2000],
        shouldRetry: (err) => ttsShouldRetry(err),
        onRetry: ({ nextAttempt, delayMs, error }) => {
          if (__DEV__) {
            console.warn('[TTS] ElevenLabs PCM stream fetch retry', { nextAttempt, delayMs, error });
          }
        },
        run: async () => doOnePcmStreamFetch(),
      });
    }
    return await doOnePcmStreamFetch();
  } catch (e) {
    if (__DEV__) {
      console.warn('[TTS] ElevenLabs PCM stream open failed', e);
    }
    return null;
  }
}

/**
 * Plays L16LE mono PCM at {@link ELEVENLABS_PCM_STREAM_SAMPLE_RATE} from a streaming Response, scheduling
 * `AudioBufferSource` chunks as they arrive. Returns true when the stream finished playing.
 */
async function playElevenLabsPcmStreamFromResponse(
  res: Response,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource,
  preInitTriggerDuring: PreInitTriggerDuring,
  playbackRateMultiplier: number = 1
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !res.body) return false;
  const ctx = sharedWebAudioContext;
  if (!ctx || !webInterviewAudioUnlocked) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;

  const epochCapture = webInterviewTtsScheduleEpoch;
  const pcmEpochStale = () => epochCapture !== webInterviewTtsScheduleEpoch;

  const reader = res.body.getReader();
  let pending = new Uint8Array(0);
  let nextScheduleTime = 0;
  let pcmPlaybackStarted = false;
  let readComplete = false;
  let totalSourcesScheduled = 0;
  let totalSourcesCompleted = 0;
  let resolveAll: (() => void) | null = null;
  const allDone = new Promise<void>((resolve) => {
    resolveAll = resolve;
  });

  const cleanupPcmEpochAbort = async (): Promise<boolean> => {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    for (const s of activePcmStreamSources) {
      try {
        s.stop(0);
      } catch {
        /* ignore */
      }
    }
    activePcmStreamSources.length = 0;
    resolveAll?.();
    return false;
  };

  const tryFinishIfDone = () => {
    if (readComplete && totalSourcesScheduled > 0 && totalSourcesCompleted >= totalSourcesScheduled) {
      resolveAll?.();
    }
  };

  const schedulePcmChunk = (u8: Uint8Array) => {
    if (pcmEpochStale()) return;
    if (u8.length < 2) return;
    const sampleCount = u8.length / 2;
    const leBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length);
    const i16 = new Int16Array(leBuf);
    const abuf = ctx.createBuffer(1, i16.length, ELEVENLABS_PCM_STREAM_SAMPLE_RATE);
    const ch = abuf.getChannelData(0);
    for (let i = 0; i < i16.length; i += 1) {
      ch[i] = i16[i]! / 32768;
    }
    let pcmPeak = 0;
    let pcmSumSq = 0;
    for (let i = 0; i < ch.length; i += 1) {
      const v = ch[i]!;
      pcmPeak = Math.max(pcmPeak, Math.abs(v));
      pcmSumSq += v * v;
    }
    const pcmRms = Math.sqrt(pcmSumSq / Math.max(1, ch.length));
    const src = ctx.createBufferSource();
    src.buffer = abuf;
    src.playbackRate.value = playbackRateMultiplier;
    src.connect(ctx.destination);
    const t0 = !pcmPlaybackStarted ? ctx.currentTime + 0.02 : nextScheduleTime;
    const scheduleSlipSec = t0 - ctx.currentTime;
    const scheduleSlipMs = scheduleSlipSec * 1000;
    nextScheduleTime = t0 + abuf.duration / playbackRateMultiplier;
    if (!pcmPlaybackStarted) {
      pcmPlaybackStarted = true;
      onPlaybackStarted?.();
      kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
      logTtsAutoplayPlayOutcome({
        pipeline: TTS_PCM_STREAM_PIPELINE,
        outcome: 'play_ok',
        telemetrySource,
      });
      const rtPcm = getSessionLogRuntime();
    }
    totalSourcesScheduled += 1;
    const srcNode = src;
    activePcmStreamSources.push(src);
    src.onended = () => {
      const idx = activePcmStreamSources.indexOf(srcNode);
      if (idx >= 0) activePcmStreamSources.splice(idx, 1);
      totalSourcesCompleted += 1;
      if (totalSourcesCompleted === totalSourcesScheduled) {
        finalizeInterviewMicAmbientOnTtsEnd();
      }
      tryFinishIfDone();
    };
    try {
      src.start(t0);
    } catch (e) {
      logTtsAutoplayPlayOutcome({
        pipeline: TTS_PCM_STREAM_PIPELINE,
        outcome: 'play_error',
        telemetrySource,
        errorMessagePreview: (e instanceof Error ? e.message : String(e)).slice(0, 120),
      });
    }
  };

  const takeEvenBytes = (n: number) => {
    if (n < 2) return;
    const take = n - (n % 2);
    if (take < 2) return;
    const chunk = pending.subarray(0, take);
    pending = pending.length > take ? pending.subarray(take) : new Uint8Array(0);
    schedulePcmChunk(chunk);
  };

  try {
    for (;;) {
      if (pcmEpochStale()) {
        return await cleanupPcmEpochAbort();
      }
      const { done, value } = await reader.read();
      if (value && value.length > 0) {
        const merged = new Uint8Array(pending.length + value.length);
        merged.set(pending, 0);
        merged.set(value, pending.length);
        pending = merged;
      }
      for (;;) {
        if (pcmEpochStale()) {
          return await cleanupPcmEpochAbort();
        }
        if (!pcmPlaybackStarted) {
          if (pending.length < ELEVENLABS_PCM_MIN_START_BYTES) break;
          takeEvenBytes(ELEVENLABS_PCM_MIN_START_BYTES);
        } else if (pending.length >= 16384) {
          takeEvenBytes(16384);
        } else {
          break;
        }
      }
      if (done) {
        readComplete = true;
        break;
      }
    }
  } catch {
    for (const s of activePcmStreamSources) {
      try {
        s.stop(0);
      } catch {
        /* ignore */
      }
    }
    activePcmStreamSources.length = 0;
    logTtsAutoplayPlayOutcome({
      pipeline: TTS_PCM_STREAM_PIPELINE,
      outcome: 'play_error',
      telemetrySource,
      errorMessagePreview: 'pcm_read_failed',
    });
    return false;
  }

  readComplete = true;
  while (pending.length >= 2) {
    if (pcmEpochStale()) {
      return await cleanupPcmEpochAbort();
    }
    if (pending.length >= 16384) {
      takeEvenBytes(16384);
    } else {
      takeEvenBytes(pending.length);
    }
  }
  if (pcmEpochStale()) {
    return await cleanupPcmEpochAbort();
  }
  if (totalSourcesScheduled === 0) {
    return false;
  }
  await Promise.race([allDone, new Promise<void>((r) => setTimeout(r, 600_000))]);
  return !pcmEpochStale();
}

async function tryPlayElevenLabsPcmStream(
  spokenText: string,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource,
  preInitTriggerDuring: PreInitTriggerDuring,
  playbackRateMultiplier: number = 1
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const res = await openElevenLabsPcmStreamRequest(spokenText);
  if (!res) return false;
  return playElevenLabsPcmStreamFromResponse(
    res,
    onPlaybackStarted,
    telemetrySource,
    preInitTriggerDuring,
    playbackRateMultiplier
  );
}

export async function speakWithElevenLabs(
  text: string,
  onFallback?: () => void,
  options?: ElevenLabsSpeakOptions
): Promise<void> {
  const onPlaybackStarted = options?.onPlaybackStarted;
  const telemetrySource = options?.telemetry?.source ?? 'other';
  const preInitTriggerDuring: PreInitTriggerDuring =
    options?.preInitTriggerDuring ??
    (telemetrySource === 'greeting' ? 'greeting' : 'tts_playback');
  const playbackRateMultiplier = getEffectivePlaybackRateMultiplier(options?.playbackRateMultiplier);
  if (!options?.skipStopElevenLabsPlaybackBeforeStart) {
    await stopElevenLabsPlayback();
  }
  await logAndApplyPlaybackModeForTts('speakWithElevenLabs:afterStop');

  const spokenText = applyAmoraeaPronunciation(text ?? '');
  const envAllowsEleven = isElevenLabsEnabledForEnvironment();
  const iosBlocksMp3 = Platform.OS === 'ios' && !iosUseElevenLabsMp3Playback();

  if (!spokenText.trim()) {
    await speakFallback(spokenText, onFallback, options);
    return;
  }

  if (!envAllowsEleven) {
    await speakFallback(spokenText, onFallback, options);
    return;
  }

  const proxyUrl = getTtsProxyUrl();
  const apiKey = getApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  const voiceId = fromExtra?.elevenLabsVoiceId
    || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID)
    || DEFAULT_VOICE_ID;
  if (!apiKey && !useProxy) {
    console.warn('ElevenLabs: No API key (EXPO_PUBLIC_ELEVENLABS_API_KEY or app config). Using fallback TTS — set the key for natural voice.');
    await speakFallback(spokenText, onFallback, options);
    return;
  }

  if (iosBlocksMp3) {
    await speakFallback(spokenText, onFallback, options);
    return;
  }

  /** Web Audio / MP3 path only — dev `speakFallback` (expo-speech / web speech) must not require prior unlock. */
  if (Platform.OS === 'web' && !webInterviewAudioUnlocked) {
    throw new WebTtsRequiresUserGestureError(spokenText);
  }

  /**
   * Interview `turn` and tab-restore `replay` lines use HTML `<audio>` so tab-hide can soft-pause and resume mid-utterance.
   * PCM / Web Audio buffer paths cannot seek and always replay from the start after tab return.
   */
  const preferTabResumableHtmlAudio =
    Platform.OS === 'web' && (telemetrySource === 'turn' || telemetrySource === 'replay');

  /** PCM chunks schedule many `AudioBufferSourceNode`s — desktop Chrome still hits static after tab suspend/resume; mobile keeps streaming for earlier audible output on long lines. iOS Safari mobile never uses PCM (HTML audio only — avoids mid-playback pipeline switch / static). */
  const shouldTryPcmStream =
    Platform.OS === 'web' &&
    !preferTabResumableHtmlAudio &&
    !options?.skipPcmStream &&
    !isAnyMobileWebBrowser() &&
    !isIosSafariMobileWeb() &&
    !isIosWebkitMobileWebLike() &&
    !webEmbeddedInAppBrowserDiscouragesPcmStream() &&
    webSpeechShouldDeferToUserGesture() &&
    telemetrySource !== 'greeting' &&
    !options?.prefetchedMpegArrayBuffer &&
    spokenText.trim().length > LONG_TTS_USE_STREAMING_MIN_CHARS;

  try {
    if (shouldTryPcmStream) {
      if (!options?.skipWebPlaybackPriming) {
        await ensureWebPlaybackPrimedForNextTurn(telemetrySource, {
          skipSilentReprime:
            options?.skipSilentWebPlaybackReprime ||
            shouldSkipSilentReprimeForTelemetry(telemetrySource),
        });
      }
      const playedPcm = await tryPlayElevenLabsPcmStream(
        spokenText,
        onPlaybackStarted,
        telemetrySource,
        preInitTriggerDuring,
        playbackRateMultiplier
      );
      if (playedPcm) {
        recordElevenLabsSpokenContext(spokenText);
        return;
      }
    }

    let arrayBuffer: ArrayBuffer;
    if (options?.prefetchedMpegArrayBuffer && options.prefetchedMpegArrayBuffer.byteLength > 0) {
      arrayBuffer = options.prefetchedMpegArrayBuffer;
    } else {
      const downloaded = await fetchElevenLabsMpegArrayBuffer(text);
      if (!downloaded) {
        await speakFallback(spokenText, onFallback, options);
        return;
      }
      arrayBuffer = downloaded;
    }

    if (Platform.OS === 'web') {
      if (!options?.skipWebPlaybackPriming) {
        await ensureWebPlaybackPrimedForNextTurn(telemetrySource, {
          skipSilentReprime:
            options?.skipSilentWebPlaybackReprime ||
            shouldSkipSilentReprimeForTelemetry(telemetrySource),
        });
      }
      const abForWebAudio = arrayBuffer.slice(0);
      const abForHtmlAudio = arrayBuffer.slice(0);
      /**
       * Skip Web Audio decode when mobile web defers gesture (decode/`resume` can be flaky there).
       * Do **not** skip for desktop greeting: that path used to force HTMLAudio after async fetch,
       * which hits autoplay policy (no user gesture) — user must tap. Desktop should use Web Audio
       * after `unlockWebAudioForAutoplay()` in `startInterview` so the first line can speak without a tap.
       */
      const skipWebAudioDecode = webSpeechShouldDeferToUserGesture() || preferTabResumableHtmlAudio;
      const playedViaCtx = skipWebAudioDecode
        ? false
        : await tryPlayElevenLabsMp3WithWebAudio(
            abForWebAudio,
            onPlaybackStarted,
            telemetrySource,
            preInitTriggerDuring,
            playbackRateMultiplier
          );
      if (playedViaCtx) {
        const orphan = takePreAuthorizedAudioElementForTts();
        if (orphan) {
          try {
            orphan.pause();
            orphan.removeAttribute('src');
          } catch {
            /* ignore */
          }
        }
        recordElevenLabsSpokenContext(spokenText);
        return;
      }
      const blob = new Blob([abForHtmlAudio], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const AudioCtor = typeof (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio !== 'undefined'
        ? (globalThis as unknown as { Audio: new (src?: string) => HTMLAudioElement }).Audio
        : undefined;
      if (!AudioCtor) {
        URL.revokeObjectURL(url);
        await speakFallback(spokenText, onFallback, options);
        return;
      }
      const preAuthorizedEl = takePreAuthorizedAudioElementForTts();
      const chainHtmlAudioPlayback = options?.chainHtmlAudioPlayback === true;
      const chainedContinuation = chainHtmlAudioPlayback && options?.skipWebPlaybackPriming === true;
      const useSharedPrimed =
        !preAuthorizedEl &&
        !chainHtmlAudioPlayback &&
        webSpeechShouldDeferToUserGesture() &&
        sharedHtmlAudioForMobileTts !== null;
      let htmlAudio: HTMLAudioElement;
      if (chainHtmlAudioPlayback) {
        const shared = ensureSharedHtmlAudioElementForInterviewTts();
        if (!shared) {
          URL.revokeObjectURL(url);
          await speakFallback(spokenText, onFallback, options);
          return;
        }
        htmlAudio = shared;
        try {
          if (!htmlAudio.paused && !htmlAudio.ended) {
            htmlAudio.pause();
          }
          if (!chainedContinuation) {
            htmlAudio.currentTime = 0;
          }
        } catch {
          /* ignore */
        }
        htmlAudio.muted = false;
        htmlAudio.src = url;
        ensureWebHtmlAudioElementMaxVolume(htmlAudio);
        htmlAudio.playbackRate = playbackRateMultiplier;
      } else if (preAuthorizedEl) {
        htmlAudio = preAuthorizedEl;
        try {
          htmlAudio.pause();
          htmlAudio.currentTime = 0;
        } catch {
          /* ignore */
        }
        htmlAudio.src = url;
        ensureWebHtmlAudioElementMaxVolume(htmlAudio);
        htmlAudio.playbackRate = playbackRateMultiplier;
      } else if (useSharedPrimed && sharedHtmlAudioForMobileTts) {
        htmlAudio = sharedHtmlAudioForMobileTts;
        htmlAudio.src = url;
        ensureWebHtmlAudioElementMaxVolume(htmlAudio);
        htmlAudio.playbackRate = playbackRateMultiplier;
      } else {
        const audio = new AudioCtor(url);
        htmlAudio = audio as HTMLAudioElement;
        htmlAudio.setAttribute('playsinline', '');
        if ('playsInline' in htmlAudio) {
          (htmlAudio as { playsInline: boolean }).playsInline = true;
        }
        htmlAudio.preload = 'auto';
        ensureWebHtmlAudioElementMaxVolume(htmlAudio);
        htmlAudio.playbackRate = playbackRateMultiplier;
      }
      activeWebAudio = htmlAudio;
      activeWebHtmlAudioObjectUrl = url;
      /** HTML `<audio>` does not require a running shared AudioContext — only Web Audio decode does. */
      if (
        !preferTabResumableHtmlAudio &&
        !(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))
      ) {
        activeWebAudio = null;
        URL.revokeObjectURL(url);
        await speakFallback(spokenText, onFallback, options);
        return;
      }
      await new Promise<void>((resolve, reject) => {
        /**
         * Primary completion: `onended`. Safety only: decoded clip length + 3000ms (from `duration` / metadata),
         * never a char-based estimate — avoids clipping when playback runs longer than the text heuristic.
         */
        let settled = false;
        let timeoutId: ReturnType<typeof setTimeout> | null = null;
        const LOOSE_UNTIL_METADATA_MS = 600_000;
        const finish = (action: 'resolve' | 'reject', err?: Error) => {
          if (settled) return;
          settled = true;
          if (abortActiveWebHtmlAudioPlayback === abortThisPlayback) {
            abortActiveWebHtmlAudioPlayback = null;
          }
          if (activeWebHtmlAudioPlaybackHandoff?.objectUrl === url) {
            activeWebHtmlAudioPlaybackHandoff = null;
          }
          if (timeoutId != null) clearTimeout(timeoutId);
          timeoutId = null;
          if (action === 'resolve') resolve();
          else reject(err ?? new Error('Audio playback failed'));
        };
        activeWebHtmlAudioPlaybackHandoff = {
          clearSafetyTimeout: () => {
            if (timeoutId != null) clearTimeout(timeoutId);
            timeoutId = null;
          },
          completePlayback: () => finish('resolve'),
          objectUrl: url,
        };
        const abortThisPlayback = () => {
          try {
            if (!htmlAudio.ended) htmlAudio.pause();
          } catch {
            /* ignore */
          }
          finish('reject', new WebInterviewTtsTabHiddenAbortError());
        };
        abortActiveWebHtmlAudioPlayback = abortThisPlayback;
        const scheduleSafetyTimeout = (reason: string) => {
          if (settled) return;
          if (timeoutId != null) clearTimeout(timeoutId);
          const d = htmlAudio.duration;
          const tabSnap = tabHtmlAudioResumeSnapshot;
          const resumeAt =
            tabSnap && tabSnap.element === htmlAudio && Number.isFinite(tabSnap.resumeSeconds)
              ? tabSnap.resumeSeconds
              : htmlAudio.currentTime;
          let safetyMs = LOOSE_UNTIL_METADATA_MS;
          if (Number.isFinite(d) && d > 0) {
            const remainingSec =
              Number.isFinite(resumeAt) && resumeAt > 0 && d > resumeAt + 0.35
                ? d - resumeAt
                : d;
            if (remainingSec > 0.5) {
              safetyMs = Math.min(600_000, Math.ceil(remainingSec * 1000) + 5000);
            }
          }
          timeoutId = setTimeout(() => {
            if (htmlAudioPausedForTabResume || hasWebInterviewHtmlAudioTabResumePending()) {
              scheduleSafetyTimeout('tab_paused_hold');
              return;
            }
            if (!htmlAudio.ended && !htmlAudio.paused) {
              const d = htmlAudio.duration;
              const ct = htmlAudio.currentTime;
              if (Number.isFinite(d) && d > 0.5 && ct < d - 0.35) {
                scheduleSafetyTimeout('still_playing');
                return;
              }
            }
            try {
              if (!htmlAudio.ended) {
                htmlAudio.pause();
              }
            } catch {
              /* ignore */
            }
            try {
              activeWebAudio = null;
              if (activeWebHtmlAudioObjectUrl === url) activeWebHtmlAudioObjectUrl = null;
              clearHtmlAudioTabResumeState();
              URL.revokeObjectURL(url);
            } catch {
              /* ignore */
            }
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_html_audio',
              outcome: 'playback_timeout',
              telemetrySource,
              errorMessagePreview: `safety_fallback_ms=${safetyMs} reason=${reason}`,
            });
            finish('resolve');
          }, safetyMs);
        };
        htmlAudio.addEventListener('loadedmetadata', () => scheduleSafetyTimeout('loadedmetadata'));
        htmlAudio.addEventListener('durationchange', () => scheduleSafetyTimeout('durationchange'));
        scheduleSafetyTimeout('initial');
        htmlAudio.onended = () => {
          finalizeInterviewMicAmbientOnTtsEnd();
          activeWebAudio = null;
          if (activeWebHtmlAudioObjectUrl === url) activeWebHtmlAudioObjectUrl = null;
          clearHtmlAudioTabResumeState();
          URL.revokeObjectURL(url);
          finish('resolve');
        };
        htmlAudio.onerror = () => {
          activeWebAudio = null;
          if (activeWebHtmlAudioObjectUrl === url) activeWebHtmlAudioObjectUrl = null;
          URL.revokeObjectURL(url);
          finish('reject', new Error('Audio playback failed'));
        };
        void (async () => {
          try {
            const tabResumeSameElement =
              tabHtmlAudioResumeSnapshot?.element === htmlAudio &&
              (htmlAudioPausedForTabResume || hasWebInterviewHtmlAudioTabResumePending());
            if (tabResumeSameElement && !htmlAudio.paused && !htmlAudio.ended) {
              applyTabStashedHtmlAudioVolume(htmlAudio);
              onPlaybackStarted?.();
              logTtsAutoplayPlayOutcome({
                pipeline: 'elevenlabs_web_html_audio',
                outcome: 'play_ok',
                telemetrySource,
                html_audio_volume: htmlAudio.volume,
                errorMessagePreview: `tab_resume_already_audible_at_s=${htmlAudio.currentTime}`,
              });
              return;
            }
            await waitForWebHtmlAudioElementReady(htmlAudio, 8000, {
              skipExplicitLoad: options?.skipWebPlaybackPriming,
              preservePlaybackPosition: tabResumeSameElement,
            });
            await htmlAudio.play();
            onPlaybackStarted?.();
            if (!options?.skipWebPlaybackPriming && !options?.skipMicPreInitDuringPlayback) {
              void kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
            }
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_html_audio',
              outcome: 'play_ok',
              telemetrySource,
              html_audio_volume: htmlAudio.volume,
            });
          } catch (playErr: unknown) {
            if (isWebAudioAutoplayBlockedError(playErr)) {
              pendingWebGestureBlobUrl = url;
              activeWebAudio = htmlAudio;
              logTtsAutoplayPlayOutcome({
                pipeline: 'elevenlabs_web_html_audio',
                outcome: 'play_blocked_autoplay',
                telemetrySource,
              });
              if (
                (telemetrySource === 'turn' || telemetrySource === 'replay') &&
                (preAuthorizedEl || (options?.prefetchedMpegArrayBuffer?.byteLength ?? 0) > 0)
              ) {
                try {
                  ensureWebHtmlAudioElementMaxVolume(htmlAudio);
                  await waitForWebHtmlAudioElementReady(htmlAudio, 8000, {
                    skipExplicitLoad: options?.skipWebPlaybackPriming,
                  });
                  await htmlAudio.play();
                  onPlaybackStarted?.();
                  logTtsAutoplayPlayOutcome({
                    pipeline: 'elevenlabs_web_html_audio',
                    outcome: 'play_ok',
                    telemetrySource,
                    html_audio_volume: htmlAudio.volume,
                  });
                  finish('resolve');
                  return;
                } catch {
                  /* fall through to web speech */
                }
              }
              activeWebAudio = null;
              try {
                const webRes = await speakWithWebSpeechSynthesis(
                  spokenText,
                  onPlaybackStarted,
                  preInitTriggerDuring
                );
                if (webRes.ok) {
                  try {
                    htmlAudio.pause();
                  } catch {
                    /* ignore */
                  }
                  try {
                    URL.revokeObjectURL(url);
                  } catch {
                    /* ignore */
                  }
                  pendingWebGestureBlobUrl = null;
                  logTtsAutoplayPlayOutcome({
                    pipeline: 'web_speech_after_mp3_blocked',
                    outcome: 'play_ok',
                    telemetrySource,
                  });
                  finish('resolve');
                  return;
                }
              } catch {
                /* fall through to gesture error */
              }
              finish('reject', new WebTtsRequiresUserGestureError(spokenText));
              return;
            }
            const err = playErr instanceof Error ? playErr : new Error(String(playErr));
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_html_audio',
              outcome: 'play_error',
              telemetrySource,
              errorName: err.name,
              errorMessagePreview: err.message?.slice(0, 120),
            });
            finish('reject', err);
          }
        })();
      });
      recordElevenLabsSpokenContext(spokenText);
      return;
    }

    // Native: write to temp file, play with expo-av
    const base64 = arrayBufferToBase64(arrayBuffer);
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) {
      await speakFallback(spokenText, onFallback, options);
      return;
    }
    const fileUri = `${dir}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    await logAndApplyPlaybackModeForTts('speakWithElevenLabs:nativeBeforeSoundCreate');
    const Audio = getExpoAvAudio();
    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: false, volume: 1.0, isMuted: false } // shouldPlay: false, play manually below
    );
    activeNativeTtsSound = sound;

    try {
      await new Promise<void>((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded && status.didJustFinish) {
            resolve();
          }
        });
        sound
          .playAsync()
          .then((st) => {
            if (st.isLoaded) {
              onPlaybackStarted?.();
              logTtsAutoplayPlayOutcome({
                pipeline: 'native_expo_av',
                outcome: 'play_ok',
                telemetrySource,
              });
            }
          })
          .catch((e: unknown) => {
            const err = e instanceof Error ? e : new Error(String(e));
            logTtsAutoplayPlayOutcome({
              pipeline: 'native_expo_av',
              outcome: 'play_error',
              telemetrySource,
              errorName: err.name,
              errorMessagePreview: err.message?.slice(0, 120),
            });
            reject(err);
          });
      });
    } finally {
      if (activeNativeTtsSound === sound) {
        activeNativeTtsSound = null;
      }
      try {
        await sound.unloadAsync();
      } catch {
        /* ignore */
      }
    }
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // ignore cleanup errors
    }
    recordElevenLabsSpokenContext(spokenText);
  } catch (err) {
    if (err instanceof WebTtsRequiresUserGestureError || err instanceof WebInterviewTtsTabHiddenAbortError) {
      throw err;
    }
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    await speakFallback(spokenText, onFallback, options);
  }
}

type WebSpeechResult = { ok: true } | { ok: false; error: string };

/** Cached browser voice so fallback TTS does not switch voices mid-interview. */
let cachedWebSpeechVoice: SpeechSynthesisVoice | null = null;

function pickStableWebSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  if (cachedWebSpeechVoice) return cachedWebSpeechVoice;
  const list = window.speechSynthesis.getVoices();
  const prefer =
    list.find((v) => /samantha|google us english|zira|karen|victoria/i.test(v.name) && /^en/i.test(v.lang)) ??
    list.find((v) => (v as SpeechSynthesisVoice & { localService?: boolean }).localService === true && /^en/i.test(v.lang)) ??
    list.find((v) => /^en(-|$)/i.test(v.lang)) ??
    null;
  cachedWebSpeechVoice = prefer;
  return prefer;
}

/** Web (esp. Mobile Safari): expo-speech often calls onError immediately — use the browser Speech Synthesis API instead. */
function speakWithWebSpeechSynthesis(
  spokenText: string,
  onPlaybackStarted?: () => void,
  preInitTriggerDuring: PreInitTriggerDuring = 'tts_playback',
  playbackRateMultiplier: number = 1
): Promise<WebSpeechResult> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || typeof SpeechSynthesisUtterance === 'undefined') {
      resolve({ ok: false, error: 'no-api' });
      return;
    }

    let settled = false;
    const timeoutMs = Math.min(120_000, Math.max(5_000, spokenText.length * 100));
    /** DOM `setTimeout` id is a number; avoid `NodeJS.Timeout` mismatch in mixed typings. */
    let timeoutId: number;
    const settle = (result: WebSpeechResult) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(result);
    };
    timeoutId = window.setTimeout(() => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        /* ignore */
      }
      settle({ ok: false, error: 'timeout' });
    }, timeoutMs);

    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.lang = 'en-US';
    utter.rate = Math.min(4, Math.max(0.5, 0.92 * playbackRateMultiplier));
    utter.pitch = 0.95;
    utter.onstart = () => {
      webSpeechSynthTabResumeState = { fullText: spokenText, startedAtMs: Date.now() };
      onPlaybackStarted?.();
      kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
    };
    utter.onend = () => {
      clearWebSpeechSynthTabResumeState();
      finalizeInterviewMicAmbientOnTtsEnd();
      settle({ ok: true });
    };
    utter.onerror = (ev) => {
      clearWebSpeechSynthTabResumeState();
      const code =
        typeof ev === 'object' && ev !== null && 'error' in ev
          ? String((ev as SpeechSynthesisErrorEvent).error)
          : 'unknown';
      settle({ ok: false, error: code });
    };
    const speakNow = () => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        settle({ ok: false, error: 'throw' });
      }
    };
    const applyVoiceAndSpeak = () => {
      const en = pickStableWebSpeechVoice();
      if (en) utter.voice = en;
      speakNow();
    };
    if (window.speechSynthesis.getVoices().length > 0) {
      applyVoiceAndSpeak();
    } else {
      let voicesReady = false;
      const finishVoices = () => {
        if (voicesReady) return;
        voicesReady = true;
        window.speechSynthesis.removeEventListener?.('voiceschanged', onVc);
        applyVoiceAndSpeak();
      };
      const onVc = () => finishVoices();
      window.speechSynthesis.addEventListener?.('voiceschanged', onVc);
      setTimeout(() => {
        finishVoices();
      }, 400);
    }
  });
}

/**
 * If ElevenLabs MP3 was fetched but `play()` was blocked, the blob URL is stored here — call from a user-gesture
 * handler (`onPressIn` / mic tap) so `play()` succeeds (Brave often blocks `speechSynthesis` too).
 *
 * **onPlaybackStarted** runs only when `HTMLAudioElement.play()` resolves — do not clear duplicate text queues
 * before this; if play() rejects, we restore the blob URL for the next tap and text fallback stays available.
 */
export async function tryPlayPendingWebTtsAudioInUserGesture(
  onDone?: () => void,
  onPlaybackStarted?: () => void,
  telemetry?: { source?: TtsTelemetrySource }
): Promise<boolean> {
  const telemetrySource = telemetry?.source ?? 'other';
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !pendingWebGestureBlobUrl) return false;
  await ensureWebPlaybackPrimedForNextTurn(telemetrySource, {
    skipSilentReprime: shouldSkipSilentReprimeForTelemetry(telemetrySource),
  });
  const url = pendingWebGestureBlobUrl;
  pendingWebGestureBlobUrl = null;
  const AudioCtor = typeof (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio !== 'undefined'
    ? (globalThis as unknown as { Audio: new (src?: string) => HTMLAudioElement }).Audio
    : undefined;
  if (!AudioCtor) {
    pendingWebGestureBlobUrl = url;
    return false;
  }
  const audio = new AudioCtor(url);
  activeWebAudio = audio;
  const htmlAudio = audio as HTMLAudioElement;
  htmlAudio.playbackRate = getLocalDevPlaybackRateMultiplier();
  htmlAudio.setAttribute('playsinline', '');
  if ('playsInline' in htmlAudio) {
    (htmlAudio as { playsInline: boolean }).playsInline = true;
  }
  ensureWebHtmlAudioElementMaxVolume(htmlAudio);
  const finishAfterPlayback = () => {
    finalizeInterviewMicAmbientOnTtsEnd();
    if (activeWebAudio === audio) activeWebAudio = null;
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    onDone?.();
  };
  audio.onended = () => finishAfterPlayback();
  audio.onerror = () => {
    pendingWebGestureBlobUrl = url;
    if (activeWebAudio === audio) activeWebAudio = null;
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_gesture_flush',
      outcome: 'gesture_flush_rejected',
      telemetrySource,
    });
    onDone?.();
  };
  void (async () => {
    try {
      await waitForWebHtmlAudioElementReady(htmlAudio);
      await htmlAudio.play();
      onPlaybackStarted?.();
      kickInterviewMicPreInitForTtsPlayback('tts_playback');
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_gesture_flush',
        outcome: 'gesture_flush_ok',
        telemetrySource,
      });
    } catch {
      pendingWebGestureBlobUrl = url;
      if (activeWebAudio === audio) activeWebAudio = null;
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_gesture_flush',
        outcome: 'gesture_flush_rejected',
        telemetrySource,
      });
      onDone?.();
    }
  })();
  return true;
}

/** Debug / mic handler: whether an ElevenLabs MP3 blob is waiting for a user gesture tap. */
export function hasPendingWebGestureBlobUrl(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && !!pendingWebGestureBlobUrl;
}

/**
 * Call **synchronously** from a tap handler (mic). iOS Safari requires speechSynthesis.speak in the user-gesture stack.
 */
export function trySpeakWebSpeechInUserGesture(spokenText: string, onDone?: () => void): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    void window.speechSynthesis.getVoices();
  } catch {
    /* ignore */
  }
  const utter = new SpeechSynthesisUtterance(spokenText);
  utter.lang = 'en-US';
  utter.rate = Math.min(4, Math.max(0.5, 0.92 * getLocalDevPlaybackRateMultiplier()));
  utter.pitch = 0.95;
  utter.volume = 1;
  utter.onend = () => {
    onDone?.();
  };
  utter.onerror = (ev) => {
    const code =
      typeof ev === 'object' && ev !== null && 'error' in ev
        ? String((ev as SpeechSynthesisErrorEvent).error)
        : 'unknown';
    onDone?.();
  };
  const list = window.speechSynthesis.getVoices();
  const en = list.find((v) => /^en(-|$)/i.test(v.lang));
  if (en) utter.voice = en;
  try {
    window.speechSynthesis.speak(utter);
  } catch {
    onDone?.();
  }
}

function speakFallback(
  text: string,
  onFallback?: () => void,
  playbackOpts?: ElevenLabsSpeakOptions
): Promise<void> {
  /** Expo-speech / Web Speech API — synthesized locally; not a full ElevenLabs buffer before playback. */
  setTtsBufferCompleteBeforePlaybackForNextPlayback(false);
  setTtsPlaybackStrategyForNextPlayback('streaming');
  const onPlaybackStarted = playbackOpts?.onPlaybackStarted;
  onFallback?.();
  return new Promise((resolve, reject) => {
    const run = async () => {
      await stopElevenLabsPlayback();
      if (Platform.OS === 'web') {
        /** `speechSynthesis` does not use the shared `AudioContext`; do not require `unlockWebAudioForAutoplay` here. */
        const playbackRateMultiplier = getEffectivePlaybackRateMultiplier(playbackOpts?.playbackRateMultiplier);
        const webRes = await speakWithWebSpeechSynthesis(
          text,
          onPlaybackStarted,
          playbackOpts?.preInitTriggerDuring ??
            (playbackOpts?.telemetry?.source === 'greeting' ? 'greeting' : 'tts_playback'),
          playbackRateMultiplier
        );
        if (webRes.ok) {
          resolve();
          return;
        }
        if (!webRes.ok && webRes.error === 'not-allowed') {
          throw new WebTtsRequiresUserGestureError(text);
        }
        if (!webRes.ok && webSpeechShouldDeferToUserGesture()) {
          throw new WebTtsRequiresUserGestureError(text);
        }
        resolve();
        return;
      }
      await logAndApplyPlaybackModeForTts('speakFallback:before_expo_speech').catch(() => {});
      onPlaybackStarted?.();
      // iOS: false = AVSpeechSynthesizer uses its own playback session (speaker). true inherits app session (often earpiece after PlayAndRecord/mic).
      const iosSpeechSession = Platform.OS === 'ios' ? { useApplicationAudioSession: false as const } : {};
      Speech.speak(text, {
        language: 'en-US',
        rate: Math.min(2, Math.max(0.4, 0.78 * getLocalDevPlaybackRateMultiplier())),
        pitch: 0.92,
        ...iosSpeechSession,
        onDone: () => {
          resolve();
        },
        onStopped: resolve,
        onError: () => {
          resolve();
        },
      });
    };
    void run().catch((err: unknown) => {
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

/** Stop any current TTS (including native MP3). Safe to fire-and-forget from UI handlers. */
export function stopElevenLabsSpeech(): void {
  void stopElevenLabsPlayback();
}
