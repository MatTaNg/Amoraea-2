import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';
import { runWithThreeAttemptsFixedBackoff } from '@utilities/networkRetry';
import { classifyError } from '@utilities/withRetry';
import {
  setTtsBufferCompleteBeforePlaybackForNextPlayback,
  setTtsPlaybackStrategyForNextPlayback,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { computeElevenLabsEnabled } from './elevenLabsEnvGating';
import { getWebSpeechDeferFromNavigatorSnapshot } from './webSpeechDeferPolicy';
import { WebTtsRequiresUserGestureError } from './webTtsGestureErrors';
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

let activeWebAudio: { pause(): void; currentTime: number } | null = null;

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

/** One listener: resume shared `AudioContext` / reprime HTML audio when the tab becomes visible again (Safari suspends on hide). */
let webInterviewAudioVisibilityListenerAttached = false;

export function debugNoteWebAudioRouteChange(source: string, routeData?: Record<string, unknown>): void {
  if (Platform.OS !== 'web') return;
  const ctx = sharedWebAudioContext;
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
    body: JSON.stringify({
      sessionId: 'c61a43',
      location: 'elevenLabsTts.ts:debugNoteWebAudioRouteChange',
      message: 'web_audio_route_change_observed',
      data: {
        hypothesisId: 'H10',
        source,
        routeData: routeData ?? null,
        hasCtx: !!ctx,
        ctxState: ctx?.state ?? null,
        ctxSampleRate: ctx?.sampleRate ?? null,
        ctxBaseLatency: (ctx as AudioContext | null)?.baseLatency ?? null,
        unlocked: webInterviewAudioUnlocked,
        hasActiveHtmlAudio: activeWebAudio != null,
        hasActiveWebBufferSource: activeWebBufferSource != null,
        activePcmSources: activePcmStreamSources.length,
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
      },
      timestamp: Date.now(),
      runId: 'static-debug-pre',
    }),
  }).catch(() => {});
  // #endregion
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
  const ctx = sharedWebAudioContext;
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
    body: JSON.stringify({
      sessionId: 'c61a43',
      location: 'elevenLabsTts.ts:handleWebInterviewDocumentVisibilityChange',
      message: 'web_visibility_resume_audio_state',
      data: {
        hypothesisId: 'H11',
        hasCtx: !!ctx,
        ctxState: ctx?.state ?? null,
        ctxSampleRate: ctx?.sampleRate ?? null,
        unlocked: webInterviewAudioUnlocked,
        hasSharedHtmlAudio: sharedHtmlAudioForMobileTts != null,
        hasActiveHtmlAudio: activeWebAudio != null,
        hasActiveWebBufferSource: activeWebBufferSource != null,
        activePcmSources: activePcmStreamSources.length,
      },
      timestamp: Date.now(),
      runId: 'static-debug-pre',
    }),
  }).catch(() => {});
  // #endregion
  /** Same path as pre-play: Chrome often suspends on tab hide; some builds use non-`suspended` states before `running`. */
  await ensureSharedWebAudioContextResumedForPlayback('other');
  reprimeSharedHtmlAudioSilentPlay();
}

/** Silent tick on the shared HTMLAudio element — does not replace `src` while that element is playing real TTS. */
function reprimeSharedHtmlAudioSilentPlay(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!sharedHtmlAudioForMobileTts) return;
  try {
    if (activeWebAudio === sharedHtmlAudioForMobileTts) {
      void sharedHtmlAudioForMobileTts.play().catch(() => {});
      return;
    }
    sharedHtmlAudioForMobileTts.src = SILENT_WAV_DATA_URL;
    void sharedHtmlAudioForMobileTts.play().catch(() => {});
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
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
    body: JSON.stringify({
      sessionId: 'c61a43',
      location: 'elevenLabsTts.ts:ensureSharedWebAudioContextResumedForPlayback',
      message: 'web_audio_preplay_ctx_state',
      data: {
        hypothesisId: 'H12',
        telemetrySource,
        hasCtx: !!ctx,
        ctxState: ctx?.state ?? null,
        ctxSampleRate: ctx?.sampleRate ?? null,
        unlocked: webInterviewAudioUnlocked,
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
        hasActiveHtmlAudio: activeWebAudio != null,
        hasActiveWebBufferSource: activeWebBufferSource != null,
        activePcmSources: activePcmStreamSources.length,
      },
      timestamp: Date.now(),
      runId: 'static-debug-pre',
    }),
  }).catch(() => {});
  // #endregion
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

async function ensureWebPlaybackPrimedForNextTurn(telemetrySource: TtsTelemetrySource): Promise<void> {
  await ensureSharedWebAudioContextResumedForPlayback(telemetrySource);
  reprimeSharedHtmlAudioSilentPlay();
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
export function pauseWebInterviewHtmlAudioForDocumentHidden(): void {
  if (Platform.OS !== 'web') return;
  bumpWebInterviewTtsScheduleEpoch();
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
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (activeWebAudio) {
    try {
      activeWebAudio.pause();
      activeWebAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeWebAudio = null;
  }
}

/**
 * Web: true while interview TTS might still be using Web Audio / HTMLAudio / speechSynthesis output.
 * Use after {@link stopElevenLabsPlayback} to poll until surfaces are idle before opening the mic.
 */
export function isWebInterviewPlaybackSurfaceActive(): boolean {
  if (Platform.OS !== 'web') return false;
  if (activeWebAudio != null || activeWebBufferSource != null || activePcmStreamSources.length > 0) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true) return true;
  return false;
}

export async function stopElevenLabsPlayback(): Promise<void> {
  if (Platform.OS === 'web') {
    bumpWebInterviewTtsScheduleEpoch();
  }
  if (Platform.OS === 'web' && pendingWebGestureBlobUrl) {
    try {
      URL.revokeObjectURL(pendingWebGestureBlobUrl);
    } catch {
      /* ignore */
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
  } catch {
    /* ignore — TTS will throw WebTtsRequiresUserGestureError until a successful unlock */
  }
}

/** Reset at each new interview session so the first gesture in that session must unlock again. */
export function resetWebInterviewAudioSession(): void {
  webInterviewAudioUnlocked = false;
}

/** Whether web audio has been unlocked in the current interview session (shared context is ready). */
export function isWebInterviewAudioUnlocked(): boolean {
  return Platform.OS !== 'web' || webInterviewAudioUnlocked;
}

/**
 * Call synchronously from the same user-gesture stack as mic stop (`onBeforeWebRecorderStop`) or mic press.
 * Plays a silent clip on a shared `HTMLAudioElement` so a later async MP3 `play()` is allowed without an extra tap.
 */
export function primeHtmlAudioForMobileTtsFromMicGesture(): void {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return;
  if (!webSpeechShouldDeferToUserGesture()) return;
  const AudioCtor = (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio;
  if (!AudioCtor) return;
  try {
    if (!sharedHtmlAudioForMobileTts) {
      sharedHtmlAudioForMobileTts = new AudioCtor();
      const el = sharedHtmlAudioForMobileTts;
      el.setAttribute('playsinline', '');
      if ('playsInline' in el) {
        (el as { playsInline: boolean }).playsInline = true;
      }
      el.preload = 'auto';
    }
    sharedHtmlAudioForMobileTts.src = SILENT_WAV_DATA_URL;
    void sharedHtmlAudioForMobileTts.play().catch(() => {});
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
  preInitTriggerDuring: PreInitTriggerDuring
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
    const durSec = decoded.duration;
    /** Safety only: decoded buffer duration + 3000ms — never use char estimate; primary completion is `onended`. */
    const playbackCapMs = Math.min(600_000, Math.max(4_000, Math.ceil((Number.isFinite(durSec) ? durSec : 30) * 1000) + 3_000));

    const decodeDbg = debugSummarizeAudioBufferPeaks(decoded);
    const rt0 = getSessionLogRuntime();
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        location: 'elevenLabsTts.ts:tryPlayElevenLabsMp3WithWebAudio',
        message: 'mp3_decoded_buffer_summary',
        data: {
          hypothesisId: 'H2',
          preInitTriggerDuring,
          telemetrySource,
          ctxSampleRate: ctx.sampleRate,
          ctxState: ctx.state,
          ...decodeDbg,
          recordingSessionActive: rt0.recordingSessionActive,
          ttsPlaybackActive: rt0.ttsPlaybackActive,
        },
        timestamp: Date.now(),
        runId: 'static-debug-pre',
      }),
    }).catch(() => {});
    // #endregion

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
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
          body: JSON.stringify({
            sessionId: 'e70f17',
            location: 'elevenLabsTts.ts:tryPlayElevenLabsMp3WithWebAudio',
            message: 'web_audio_playback_timeout',
            data: { hypothesisId: 'H12', playbackCapMs },
            timestamp: Date.now(),
            runId: 'post-fix',
          }),
        }).catch(() => {});
        // #endregion
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
          src!.onended = () => {
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
              reject(new Error('tts-schedule-aborted'));
              return;
            }
            src!.start(0);
            onPlaybackStarted?.();
            void beginInterviewMicPreInitDuringTts(preInitTriggerDuring);
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_audio_context',
              outcome: 'play_ok',
              telemetrySource,
            });
            // #region agent log
            fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
              body: JSON.stringify({
                sessionId: 'e70f17',
                location: 'elevenLabsTts.ts:tryPlayElevenLabsMp3WithWebAudio',
                message: 'web_audio_context_play_ok',
                data: { hypothesisId: 'H11' },
                timestamp: Date.now(),
                runId: 'post-fix',
              }),
            }).catch(() => {});
            const rt1 = getSessionLogRuntime();
            if (playbackAnalyser && typeof window !== 'undefined') {
              window.setTimeout(() => {
                try {
                  const arr = new Uint8Array(playbackAnalyser!.frequencyBinCount);
                  playbackAnalyser!.getByteFrequencyData(arr);
                  let sum = 0;
                  let mx = 0;
                  for (let i = 0; i < arr.length; i += 1) {
                    sum += arr[i]!;
                    mx = Math.max(mx, arr[i]!);
                  }
                  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
                    body: JSON.stringify({
                      sessionId: 'c61a43',
                      location: 'elevenLabsTts.ts:tryPlayElevenLabsMp3WithWebAudio',
                      message: 'web_audio_post_start_spectrum',
                      data: {
                        hypothesisId: 'H2',
                        freqBinAvg: arr.length ? sum / arr.length : 0,
                        freqBinMax: mx,
                        ctxStateAfterMs: ctx.state,
                        decodePeak: decodeDbg.peak,
                        decodeRms: decodeDbg.rms,
                        recordingSessionActive: rt1.recordingSessionActive,
                        ttsPlaybackActive: rt1.ttsPlaybackActive,
                        visibilityState:
                          typeof document !== 'undefined' ? document.visibilityState : null,
                      },
                      timestamp: Date.now(),
                      runId: 'static-debug-pre',
                    }),
                  }).catch(() => {});
                } catch {
                  /* ignore */
                }
              }, 220);
            }
            // #endregion
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
      const msg = raceErr instanceof Error ? raceErr.message : String(raceErr);
      if (msg === 'tts-schedule-aborted') {
        return false;
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
  /** Web mic pre-init audit: which phase last warmed the inactive MediaRecorder. */
  preInitTriggerDuring?: PreInitTriggerDuring;
  /** Web: force full MP3 download + Web Audio / HTML audio — skip raw PCM stream (retry path after truncated playback). */
  skipPcmStream?: boolean;
};

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
    const bodyPayload = {
      text: spokenText.trim(),
      model_id: modelId,
      voice_settings: {
        stability: 0.22,
        similarity_boost: 0.82,
        style: 0.65,
        use_speaker_boost: true,
      },
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
  const voiceSettings = {
    stability: 0.22,
    similarity_boost: 0.82,
    style: 0.65,
    use_speaker_boost: true,
  };
  const q = new URLSearchParams({
    output_format: 'pcm_24000',
    optimize_streaming_latency: '2',
  });
  const bodyPayload = {
    text: spokenText.trim(),
    model_id: modelId,
    voice_settings: voiceSettings,
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
  preInitTriggerDuring: PreInitTriggerDuring
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
    src.connect(ctx.destination);
    const t0 = !pcmPlaybackStarted ? ctx.currentTime + 0.02 : nextScheduleTime;
    const scheduleSlipSec = t0 - ctx.currentTime;
    const scheduleSlipMs = scheduleSlipSec * 1000;
    // #region agent log
    // Large positive slip is normal while buffering ahead; negative slip means start() in the past → overlap risk.
    if (scheduleSlipMs < -1) {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'elevenLabsTts.ts:schedulePcmChunk',
          message: 'pcm_schedule_slip_anomaly',
          data: {
            hypothesisId: 'H16',
            scheduleSlipMs: Math.round(scheduleSlipMs * 1000) / 1000,
            isFirstChunk: !pcmPlaybackStarted,
            chunkFrames: ch.length,
            ctxState: ctx.state,
            visibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
          },
          timestamp: Date.now(),
          runId: 'static-debug-pre',
        }),
      }).catch(() => {});
    }
    // #endregion
    nextScheduleTime = t0 + abuf.duration;
    if (!pcmPlaybackStarted) {
      pcmPlaybackStarted = true;
      onPlaybackStarted?.();
      void beginInterviewMicPreInitDuringTts(preInitTriggerDuring);
      logTtsAutoplayPlayOutcome({
        pipeline: TTS_PCM_STREAM_PIPELINE,
        outcome: 'play_ok',
        telemetrySource,
      });
      const rtPcm = getSessionLogRuntime();
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'elevenLabsTts.ts:schedulePcmChunk',
          message: 'pcm_stream_first_chunk_energy',
          data: {
            hypothesisId: 'H3',
            preInitTriggerDuring,
            telemetrySource,
            pcmPeak,
            pcmRms,
            pcmFrames: ch.length,
            ctxSampleRate: ctx.sampleRate,
            ctxState: ctx.state,
            recordingSessionActive: rtPcm.recordingSessionActive,
            ttsPlaybackActive: rtPcm.ttsPlaybackActive,
          },
          timestamp: Date.now(),
          runId: 'static-debug-pre',
        }),
      }).catch(() => {});
      // #endregion
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
  preInitTriggerDuring: PreInitTriggerDuring
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const res = await openElevenLabsPcmStreamRequest(spokenText);
  if (!res) return false;
  return playElevenLabsPcmStreamFromResponse(res, onPlaybackStarted, telemetrySource, preInitTriggerDuring);
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
  // #region agent log
  if (Platform.OS === 'web') {
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        location: 'elevenLabsTts.ts:speakWithElevenLabs',
        message: 'tts_call_entry_overlap_state',
        data: {
          hypothesisId: 'H13',
          telemetrySource,
          textLen: (text ?? '').length,
          skipStopBeforeStart: !!options?.skipStopElevenLabsPlaybackBeforeStart,
          hasActiveHtmlAudio: activeWebAudio != null,
          hasActiveWebBufferSource: activeWebBufferSource != null,
          activePcmSources: activePcmStreamSources.length,
          hasCtx: !!sharedWebAudioContext,
          ctxState: sharedWebAudioContext?.state ?? null,
          ctxSampleRate: sharedWebAudioContext?.sampleRate ?? null,
          unlocked: webInterviewAudioUnlocked,
        },
        timestamp: Date.now(),
        runId: 'static-debug-pre',
      }),
    }).catch(() => {});
  }
  // #endregion
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
    // #region agent log
    if (Platform.OS === 'web') {
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'elevenLabsTts.ts:speakWithElevenLabs',
          message: 'elevenlabs_disabled_using_fallback',
          data: {
            hypothesisId: 'H3',
            isDevBundle: typeof __DEV__ !== 'undefined' && __DEV__,
          },
          timestamp: Date.now(),
          runId: 'debug-desktop-tap',
        }),
      }).catch(() => {});
    }
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        location: 'elevenLabsTts.ts:speakWithElevenLabs',
        message: 'throw_web_not_unlocked',
        data: { hypothesisId: 'H2', reason: 'webInterviewAudioUnlocked_false_elevenlabs_path' },
        timestamp: Date.now(),
        runId: 'debug-desktop-tap',
      }),
    }).catch(() => {});
    // #endregion
    throw new WebTtsRequiresUserGestureError(spokenText);
  }

  /** PCM chunks schedule many `AudioBufferSourceNode`s — desktop Chrome still hits static after tab suspend/resume; mobile keeps streaming for earlier audible output on long lines. iOS Safari mobile never uses PCM (HTML audio only — avoids mid-playback pipeline switch / static). */
  const shouldTryPcmStream =
    Platform.OS === 'web' &&
    !options?.skipPcmStream &&
    !isIosSafariMobileWeb() &&
    !webEmbeddedInAppBrowserDiscouragesPcmStream() &&
    webSpeechShouldDeferToUserGesture() &&
    telemetrySource !== 'greeting' &&
    !options?.prefetchedMpegArrayBuffer &&
    spokenText.trim().length > LONG_TTS_USE_STREAMING_MIN_CHARS;
  // #region agent log
  if (Platform.OS === 'web') {
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        location: 'elevenLabsTts.ts:speakWithElevenLabs',
        message: 'tts_pipeline_selection_state',
        data: {
          hypothesisId: 'H14',
          telemetrySource,
          textLen: spokenText.trim().length,
          deferGesture: webSpeechShouldDeferToUserGesture(),
          embeddedBrowserPcmSuppressed: webEmbeddedInAppBrowserDiscouragesPcmStream(),
          shouldTryPcmStream,
          skipStopBeforeStart: !!options?.skipStopElevenLabsPlaybackBeforeStart,
          hasPrefetchedMpeg: !!options?.prefetchedMpegArrayBuffer,
          preInitTriggerDuring,
        },
        timestamp: Date.now(),
        runId: 'static-debug-pre',
      }),
    }).catch(() => {});
  }
  // #endregion

  try {
    if (shouldTryPcmStream) {
      await ensureWebPlaybackPrimedForNextTurn(telemetrySource);
      const playedPcm = await tryPlayElevenLabsPcmStream(
        spokenText,
        onPlaybackStarted,
        telemetrySource,
        preInitTriggerDuring
      );
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'elevenLabsTts.ts:speakWithElevenLabs',
          message: 'tts_pcm_attempt_result',
          data: {
            hypothesisId: 'H15',
            telemetrySource,
            playedPcm,
            activePcmSourcesAfterAttempt: activePcmStreamSources.length,
            hasActiveWebBufferSourceAfterAttempt: activeWebBufferSource != null,
            hasActiveHtmlAudioAfterAttempt: activeWebAudio != null,
          },
          timestamp: Date.now(),
          runId: 'static-debug-pre',
        }),
      }).catch(() => {});
      // #endregion
      if (playedPcm) {
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
      await ensureWebPlaybackPrimedForNextTurn(telemetrySource);
      const abForWebAudio = arrayBuffer.slice(0);
      const abForHtmlAudio = arrayBuffer.slice(0);
      /**
       * Skip Web Audio decode when mobile web defers gesture (decode/`resume` can be flaky there).
       * Do **not** skip for desktop greeting: that path used to force HTMLAudio after async fetch,
       * which hits autoplay policy (no user gesture) — user must tap. Desktop should use Web Audio
       * after `unlockWebAudioForAutoplay()` in `startInterview` so the first line can speak without a tap.
       */
      const skipWebAudioDecode = webSpeechShouldDeferToUserGesture();
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'elevenLabsTts.ts:web_tts_branch',
          message: 'desktop_tts_branch_state',
          data: {
            hypothesisId: 'H1',
            skipWebAudioDecode,
            deferGesture: webSpeechShouldDeferToUserGesture(),
            maxTouchPoints: typeof navigator !== 'undefined' ? navigator.maxTouchPoints : null,
            navPlatform: typeof navigator !== 'undefined' ? navigator.platform : null,
            uaSnippet: (typeof navigator !== 'undefined' ? navigator.userAgent : '').slice(0, 120),
            envAllowsEleven,
            isDevBundle: typeof __DEV__ !== 'undefined' && __DEV__,
          },
          timestamp: Date.now(),
          runId: 'debug-desktop-tap',
        }),
      }).catch(() => {});
      // #endregion
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'elevenLabsTts.ts:web_tts_branch',
          message: 'web_tts_skip_web_audio',
          data: {
            hypothesisId: 'H_SKIP_WA_MOBILE_TURN',
            skipWebAudioDecode,
            telemetrySource,
            deferGesture: webSpeechShouldDeferToUserGesture(),
          },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
      const playedViaCtx = skipWebAudioDecode
        ? false
        : await tryPlayElevenLabsMp3WithWebAudio(
            abForWebAudio,
            onPlaybackStarted,
            telemetrySource,
            preInitTriggerDuring
          );
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          location: 'elevenLabsTts.ts:web_after_web_audio_attempt',
          message: 'played_via_web_audio_context',
          data: {
            hypothesisId: 'H5',
            playedViaCtx,
            skipWebAudioDecode,
            nextPath: playedViaCtx ? 'done' : 'html_audio',
          },
          timestamp: Date.now(),
          runId: 'debug-desktop-tap',
        }),
      }).catch(() => {});
      // #endregion
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
      const useSharedPrimed =
        webSpeechShouldDeferToUserGesture() && sharedHtmlAudioForMobileTts !== null;
      let htmlAudio: HTMLAudioElement;
      if (preAuthorizedEl) {
        htmlAudio = preAuthorizedEl;
        try {
          htmlAudio.pause();
          htmlAudio.currentTime = 0;
        } catch {
          /* ignore */
        }
        htmlAudio.src = url;
        htmlAudio.volume = 1;
      } else if (useSharedPrimed && sharedHtmlAudioForMobileTts) {
        htmlAudio = sharedHtmlAudioForMobileTts;
        htmlAudio.src = url;
        htmlAudio.volume = 1;
      } else {
        const audio = new AudioCtor(url);
        htmlAudio = audio as HTMLAudioElement;
        htmlAudio.setAttribute('playsinline', '');
        if ('playsInline' in htmlAudio) {
          (htmlAudio as { playsInline: boolean }).playsInline = true;
        }
        htmlAudio.preload = 'auto';
      }
      activeWebAudio = htmlAudio;
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'elevenLabsTts.ts:html_audio_element',
          message: 'html_audio_use_shared_primed',
          data: { hypothesisId: 'H_HTML_SHARED_PRIME', useSharedPrimed },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
      /** Context only — do not reprime shared HTMLAudio here; `src` is already the MP3 blob URL. */
      if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) {
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
          if (timeoutId != null) clearTimeout(timeoutId);
          timeoutId = null;
          if (action === 'resolve') resolve();
          else reject(err ?? new Error('Audio playback failed'));
        };
        const scheduleSafetyTimeout = (reason: string) => {
          if (settled) return;
          if (timeoutId != null) clearTimeout(timeoutId);
          const d = htmlAudio.duration;
          const safetyMs =
            Number.isFinite(d) && d > 0
              ? Math.min(600_000, Math.ceil(d * 1000) + 3000)
              : LOOSE_UNTIL_METADATA_MS;
          timeoutId = setTimeout(() => {
            try {
              if (!htmlAudio.ended) {
                htmlAudio.pause();
              }
            } catch {
              /* ignore */
            }
            try {
              activeWebAudio = null;
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
          URL.revokeObjectURL(url);
          finish('resolve');
        };
        htmlAudio.onerror = () => {
          activeWebAudio = null;
          URL.revokeObjectURL(url);
          finish('reject', new Error('Audio playback failed'));
        };
        void htmlAudio
          .play()
          .then(() => {
            onPlaybackStarted?.();
            void beginInterviewMicPreInitDuringTts(preInitTriggerDuring);
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_html_audio',
              outcome: 'play_ok',
              telemetrySource,
            });
          })
          .catch(async (playErr: unknown) => {
            if (isWebAudioAutoplayBlockedError(playErr)) {
              activeWebAudio = null;
              pendingWebGestureBlobUrl = url;
              logTtsAutoplayPlayOutcome({
                pipeline: 'elevenlabs_web_html_audio',
                outcome: 'play_blocked_autoplay',
                telemetrySource,
              });
              // #region agent log
              fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
                body: JSON.stringify({
                  sessionId: 'e70f17',
                  location: 'elevenLabsTts.ts:mp3_blocked',
                  message: 'mp3_autoplay_blocked_trying_web_speech',
                  data: { hypothesisId: 'H6' },
                  timestamp: Date.now(),
                  runId: 'post-fix',
                }),
              }).catch(() => {});
              // #endregion
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
                  // #region agent log
                  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
                    body: JSON.stringify({
                      sessionId: 'e70f17',
                      location: 'elevenLabsTts.ts:web_speech_fallback',
                      message: 'web_speech_fallback_ok',
                      data: { hypothesisId: 'H6' },
                      timestamp: Date.now(),
                      runId: 'post-fix',
                    }),
                  }).catch(() => {});
                  // #endregion
                  finish('resolve');
                  return;
                }
              } catch {
                /* fall through to gesture error */
              }
              // #region agent log
              fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
                body: JSON.stringify({
                  sessionId: 'e70f17',
                  location: 'elevenLabsTts.ts:web_speech_fallback',
                  message: 'web_speech_fallback_failed_gesture_queue',
                  data: { hypothesisId: 'H6' },
                  timestamp: Date.now(),
                  runId: 'post-fix',
                }),
              }).catch(() => {});
              // #endregion
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
          });
      });
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
  } catch (err) {
    if (err instanceof WebTtsRequiresUserGestureError) {
      throw err;
    }
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    await speakFallback(spokenText, onFallback, options);
  }
}

type WebSpeechResult = { ok: true } | { ok: false; error: string };

/** Web (esp. Mobile Safari): expo-speech often calls onError immediately — use the browser Speech Synthesis API instead. */
function speakWithWebSpeechSynthesis(
  spokenText: string,
  onPlaybackStarted?: () => void,
  preInitTriggerDuring: PreInitTriggerDuring = 'tts_playback'
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
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'elevenLabsTts.ts:speakWithWebSpeechSynthesis',
          message: 'web_speech_timeout',
          data: { hypothesisId: 'H_LOAD', timeoutMs, textLen: spokenText.length },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
      settle({ ok: false, error: 'timeout' });
    }, timeoutMs);

    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
    const utter = new SpeechSynthesisUtterance(spokenText);
    utter.lang = 'en-US';
    utter.rate = 0.92;
    utter.pitch = 0.95;
    utter.onstart = () => {
      onPlaybackStarted?.();
      void beginInterviewMicPreInitDuringTts(preInitTriggerDuring);
    };
    utter.onend = () => {
      finalizeInterviewMicAmbientOnTtsEnd();
      settle({ ok: true });
    };
    utter.onerror = (ev) => {
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
      const list = window.speechSynthesis.getVoices();
      const en = list.find((v) => /^en(-|$)/i.test(v.lang));
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
  await ensureWebPlaybackPrimedForNextTurn(telemetrySource);
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
    body: JSON.stringify({
      sessionId: 'c61a43',
      hypothesisId: 'H4',
      location: 'elevenLabsTts.ts:tryPlayPendingWebTtsAudioInUserGesture',
      message: 'pending_elevenlabs_blob_flush',
      data: { telemetrySource },
      timestamp: Date.now(),
      runId: 'pre-fix',
    }),
  }).catch(() => {});
  // #endregion
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
  htmlAudio.setAttribute('playsinline', '');
  if ('playsInline' in htmlAudio) {
    (htmlAudio as { playsInline: boolean }).playsInline = true;
  }
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
  void htmlAudio.play().then(
    () => {
      onPlaybackStarted?.();
      void beginInterviewMicPreInitDuringTts('tts_playback');
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_gesture_flush',
        outcome: 'gesture_flush_ok',
        telemetrySource,
      });
    },
    () => {
      pendingWebGestureBlobUrl = url;
      if (activeWebAudio === audio) activeWebAudio = null;
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_gesture_flush',
        outcome: 'gesture_flush_rejected',
        telemetrySource,
      });
      onDone?.();
    }
  );
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
  utter.rate = 0.92;
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
        const webRes = await speakWithWebSpeechSynthesis(
          text,
          onPlaybackStarted,
          playbackOpts?.preInitTriggerDuring ??
            (playbackOpts?.telemetry?.source === 'greeting' ? 'greeting' : 'tts_playback')
        );
        if (webRes.ok) {
          resolve();
          return;
        }
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
          body: JSON.stringify({
            sessionId: 'c61a43',
            location: 'elevenLabsTts.ts:speakFallback',
            message: 'web_speech_synthesis_result',
            data: {
              hypothesisId: 'H1',
              error: webRes.ok ? null : webRes.error,
              deferGesture: webSpeechShouldDeferToUserGesture(),
            },
            timestamp: Date.now(),
            runId: 'debug-desktop-tap',
          }),
        }).catch(() => {});
        // #endregion
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
        rate: 0.78,
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
