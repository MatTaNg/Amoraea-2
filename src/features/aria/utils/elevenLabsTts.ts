import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';
import { computeElevenLabsEnabled } from './elevenLabsEnvGating';
import { supabase } from '@data/supabase/client';

/**
 * Jessica — warm, friendly, conversational (ElevenLabs). Override with
 * EXPO_PUBLIC_ELEVENLABS_VOICE_ID or app config elevenLabsVoiceId if needed.
 *
 * **Credits / environment:** ElevenLabs is off in local dev (`__DEV__`) so Metro / `expo start`
 * does not spend API credits. Production/release builds use ElevenLabs when configured.
 * - `EXPO_PUBLIC_ELEVENLABS_TTS_IN_DEV=1` — force ElevenLabs while developing (optional).
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

/** After `unlockWebAudioForAutoplay()` runs in a tap handler — primes AudioContext (silent tick). */
let sharedWebAudioContext: AudioContext | null = null;

/** ElevenLabs MP3 `blob:` URL kept when `play()` hits autoplay policy; replay from mic tap in the user-gesture stack. */
let pendingWebGestureBlobUrl: string | null = null;

/** iOS Safari blocks speechSynthesis unless speak() runs in a user-gesture stack; async LLM/TTS loses the gesture. */
export class WebTtsRequiresUserGestureError extends Error {
  constructor(public readonly text: string) {
    super('WEB_TTS_GESTURE');
    this.name = 'WebTtsRequiresUserGestureError';
  }
}

/**
 * Metro/web may duplicate module scope so `instanceof WebTtsRequiresUserGestureError` is false even for the same
 * logical error — `speakTextSafe` would skip `pendingWebSpeechForGestureRef` and mic tap would do nothing (no T9 logs).
 */
export function isWebTtsRequiresUserGestureError(err: unknown): err is WebTtsRequiresUserGestureError {
  if (err instanceof WebTtsRequiresUserGestureError) return true;
  if (typeof err !== 'object' || err === null) return false;
  const o = err as { name?: string; text?: unknown };
  return o.name === 'WebTtsRequiresUserGestureError' && typeof o.text === 'string';
}

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
  const ua = navigator.userAgent || '';
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  if (/Android/i.test(ua)) return true;
  return false;
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
 * Call **synchronously** from a real user gesture (Start interview, mic `onPressIn`, etc.).
 * Creates/resumes a shared `AudioContext` and plays a silent buffer so later MP3 playback via
 * `decodeAudioData` + `AudioBufferSourceNode` is allowed without another tap (avoids HTMLAudio T12 on Brave/Chrome).
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
    const buf = ctx.createBuffer(1, 1, 8000);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* ignore */
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
};

export async function speakWithElevenLabs(
  text: string,
  onFallback?: () => void,
  options?: ElevenLabsSpeakOptions
): Promise<void> {
  const onPlaybackStarted = options?.onPlaybackStarted;
  await stopElevenLabsPlayback();
  await logAndApplyPlaybackModeForTts('speakWithElevenLabs:afterStop');

  const spokenText = applyAmoraeaPronunciation(text ?? '');
  const envAllowsEleven = isElevenLabsEnabledForEnvironment();
  const iosBlocksMp3 = Platform.OS === 'ios' && !iosUseElevenLabsMp3Playback();

  if (!spokenText.trim()) {
    await speakFallback(spokenText, onFallback, options);
    return;
  }

  const proxyUrl = getTtsProxyUrl();
  /** __DEV__ normally disables ElevenLabs to save credits; on web we still have a Supabase TTS proxy — use it so mobile browsers get MP3 + tryPlay instead of gesture-only Web Speech for every line. */
  const useElevenLabsInDevWeb =
    typeof __DEV__ !== 'undefined' &&
    __DEV__ &&
    Platform.OS === 'web' &&
    typeof proxyUrl === 'string' &&
    proxyUrl.trim().length > 0;

  if (!envAllowsEleven && !useElevenLabsInDevWeb) {
    await speakFallback(spokenText, onFallback, options);
    return;
  }

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
    const res = await fetch(
      useProxy ? proxyUrl : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      useProxy
        ? {
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
            method: 'POST',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
            },
            body: JSON.stringify(bodyPayload),
          }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn('ElevenLabs TTS error:', res.status, errText);
      await speakFallback(spokenText, onFallback, options);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();

    if (Platform.OS === 'web') {
      // Web Audio decode/play was removed: `await ctx.resume()` / decode could hang forever on some mobile browsers; HTMLAudio + T12/gesture is reliable.
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const AudioCtor = typeof (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio !== 'undefined'
        ? (globalThis as unknown as { Audio: new (src?: string) => HTMLAudioElement }).Audio
        : undefined;
      if (!AudioCtor) {
        URL.revokeObjectURL(url);
        await speakFallback(spokenText, onFallback, options);
        return;
      }
      const audio = new AudioCtor(url);
      activeWebAudio = audio;
      const htmlAudio = audio as HTMLAudioElement;
      htmlAudio.setAttribute('playsinline', '');
      if ('playsInline' in htmlAudio) {
        (htmlAudio as { playsInline: boolean }).playsInline = true;
      }
      htmlAudio.preload = 'auto';
      await new Promise<void>((resolve, reject) => {
        audio.onended = () => {
          activeWebAudio = null;
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          activeWebAudio = null;
          URL.revokeObjectURL(url);
          reject(new Error('Audio playback failed'));
        };
        void htmlAudio
          .play()
          .then(() => {
            onPlaybackStarted?.();
          })
          .catch((playErr: unknown) => {
            if (isWebAudioAutoplayBlockedError(playErr)) {
              activeWebAudio = null;
              pendingWebGestureBlobUrl = url;
              reject(new WebTtsRequiresUserGestureError(spokenText));
              return;
            }
            reject(playErr instanceof Error ? playErr : new Error(String(playErr)));
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
            }
          })
          .catch(reject);
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
      resolve({ ok: true });
    };
    utter.onerror = (ev) => {
      const code =
        typeof ev === 'object' && ev !== null && 'error' in ev
          ? String((ev as SpeechSynthesisErrorEvent).error)
          : 'unknown';
      resolve({ ok: false, error: code });
    };
    const speakNow = () => {
      try {
        window.speechSynthesis.speak(utter);
      } catch {
        resolve({ ok: false, error: 'throw' });
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
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        window.speechSynthesis.removeEventListener?.('voiceschanged', onVc);
        applyVoiceAndSpeak();
      };
      const onVc = () => finish();
      window.speechSynthesis.addEventListener?.('voiceschanged', onVc);
      setTimeout(() => {
        finish();
      }, 400);
    }
  });
}

/**
 * If ElevenLabs MP3 was fetched but `play()` was blocked, the blob URL is stored here — call from the same
 * synchronous path as `onPressIn` / mic tap so `play()` succeeds (Brave often blocks `speechSynthesis` too).
 *
 * **onPlaybackStarted** runs only when `HTMLAudioElement.play()` resolves — do not clear duplicate text queues
 * before this; if play() rejects, we restore the blob URL for the next tap and text fallback stays available.
 */
export function tryPlayPendingWebTtsAudioInUserGesture(
  onDone?: () => void,
  onPlaybackStarted?: () => void
): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !pendingWebGestureBlobUrl) return false;
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
    onDone?.();
  };
  void htmlAudio.play().then(
    () => {
      onPlaybackStarted?.();
    },
    () => {
      pendingWebGestureBlobUrl = url;
      if (activeWebAudio === audio) activeWebAudio = null;
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
        if (webSpeechShouldDeferToUserGesture()) {
          throw new WebTtsRequiresUserGestureError(text);
        }
        const webRes = await speakWithWebSpeechSynthesis(text, onPlaybackStarted);
        if (!webRes.ok && webRes.error === 'not-allowed') {
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
