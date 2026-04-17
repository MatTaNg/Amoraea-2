import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import * as Speech from 'expo-speech';
import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';
import { runWithThreeAttemptsFixedBackoff } from '@utilities/networkRetry';
import { classifyError } from '@utilities/withRetry';
import { setTtsBufferCompleteBeforePlaybackForNextPlayback } from '@features/aria/telemetry/ttsBufferTelemetry';
import { computeElevenLabsEnabled } from './elevenLabsEnvGating';
import { getWebSpeechDeferFromNavigatorSnapshot } from './webSpeechDeferPolicy';
import { WebTtsRequiresUserGestureError } from './webTtsGestureErrors';
import { supabase } from '@data/supabase/client';
import {
  logTtsAutoplayPlayOutcome,
  type TtsTelemetrySource,
} from '@features/aria/telemetry/tsAutoplayTelemetry';

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

/** After `unlockWebAudioForAutoplay()` runs in a tap handler — primes AudioContext (silent tick). */
let sharedWebAudioContext: AudioContext | null = null;

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

/** One listener: resume shared `AudioContext` / reprime HTML audio when the tab becomes visible again (Safari suspends on hide). */
let webInterviewAudioVisibilityListenerAttached = false;

function attachWebInterviewAudioVisibilityHandler(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (webInterviewAudioVisibilityListenerAttached) return;
  webInterviewAudioVisibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    void handleWebInterviewDocumentVisibilityChange();
  });
}

async function handleWebInterviewDocumentVisibilityChange(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  const ctx = sharedWebAudioContext;
  if (ctx && ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      /* log but do not block */
    }
  }
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
  if (!ctx || !webInterviewAudioUnlocked) return true;
  if (ctx.state !== 'suspended') return true;
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
export async function stopElevenLabsPlayback(): Promise<void> {
  if (Platform.OS === 'web' && pendingWebGestureBlobUrl) {
    try {
      URL.revokeObjectURL(pendingWebGestureBlobUrl);
    } catch {
      /* ignore */
    }
    pendingWebGestureBlobUrl = null;
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
  telemetrySource: TtsTelemetrySource
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const ctx = sharedWebAudioContext;
  if (!ctx || !webInterviewAudioUnlocked) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;
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
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;
  let src: AudioBufferSourceNode | null = null;
  try {
    src = ctx.createBufferSource();
    src.buffer = decoded;
    const durSec = decoded.duration;
    const playbackCapMs = Math.min(120_000, Math.max(4_000, Math.ceil((Number.isFinite(durSec) ? durSec : 30) * 1000) + 2_000));

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

    src.connect(ctx.destination);
    activeWebBufferSource = src;
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          src!.onended = () => {
            if (activeWebBufferSource === src) activeWebBufferSource = null;
            resolve();
          };
          try {
            src!.start(0);
            onPlaybackStarted?.();
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
};

export async function speakWithElevenLabs(
  text: string,
  onFallback?: () => void,
  options?: ElevenLabsSpeakOptions
): Promise<void> {
  const onPlaybackStarted = options?.onPlaybackStarted;
  const telemetrySource = options?.telemetry?.source ?? 'other';
  await stopElevenLabsPlayback();
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

  try {
    // Use multilingual v2 for more natural, expressive speech (less robotic than flash).
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
      if (name === 'AbortError') {
        await speakFallback(spokenText, onFallback, options);
        return;
      }
      console.warn('ElevenLabs TTS fetch failed after retries:', e);
      await speakFallback(spokenText, onFallback, options);
      return;
    }

    let arrayBuffer: ArrayBuffer;
    try {
      arrayBuffer = await Promise.race([
        res.arrayBuffer(),
        new Promise<ArrayBuffer>((_, reject) => {
          setTimeout(() => reject(new Error('arraybuffer-timeout')), 90000);
        }),
      ]);
    } catch {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'e70f17' },
        body: JSON.stringify({
          sessionId: 'e70f17',
          location: 'elevenLabsTts.ts:tts_body',
          message: 'tts_arraybuffer_timeout',
          data: { hypothesisId: 'H16' },
          timestamp: Date.now(),
          runId: 'post-fix',
        }),
      }).catch(() => {});
      // #endregion
      console.warn('ElevenLabs TTS response body read timed out');
      await speakFallback(spokenText, onFallback, options);
      return;
    }

    /** Full MP3 in memory before any playback path (non-streaming fetch + full arrayBuffer). */
    setTtsBufferCompleteBeforePlaybackForNextPlayback(arrayBuffer.byteLength > 0);

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
            telemetrySource
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
      const useSharedPrimed =
        webSpeechShouldDeferToUserGesture() && sharedHtmlAudioForMobileTts !== null;
      let htmlAudio: HTMLAudioElement;
      if (useSharedPrimed && sharedHtmlAudioForMobileTts) {
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
        htmlAudio.onended = () => {
          activeWebAudio = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        htmlAudio.onerror = () => {
          activeWebAudio = null;
          URL.revokeObjectURL(url);
          reject(new Error('Audio playback failed'));
        };
        void htmlAudio
          .play()
          .then(() => {
            onPlaybackStarted?.();
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
                const webRes = await speakWithWebSpeechSynthesis(spokenText, onPlaybackStarted);
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
                  resolve();
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
              reject(new WebTtsRequiresUserGestureError(spokenText));
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
            reject(err);
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
  onPlaybackStarted?: () => void
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
    };
    utter.onend = () => {
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
  const onPlaybackStarted = playbackOpts?.onPlaybackStarted;
  onFallback?.();
  return new Promise((resolve, reject) => {
    const run = async () => {
      await stopElevenLabsPlayback();
      if (Platform.OS === 'web') {
        /** `speechSynthesis` does not use the shared `AudioContext`; do not require `unlockWebAudioForAutoplay` here. */
        const webRes = await speakWithWebSpeechSynthesis(text, onPlaybackStarted);
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
