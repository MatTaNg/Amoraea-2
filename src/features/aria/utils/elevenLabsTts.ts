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
  if (Platform.OS === 'web' && activeWebAudio) {
    try {
      activeWebAudio.pause();
      activeWebAudio.currentTime = 0;
    } catch {
      /* ignore */
    }
    activeWebAudio = null;
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
 * Speak text using ElevenLabs TTS (warm, natural voice).
 * Falls back to expo-speech if API key is missing or request fails.
 * Returns a promise that resolves when playback finishes (or fallback completes).
 */
export async function speakWithElevenLabs(
  text: string,
  onFallback?: () => void
): Promise<void> {
  await stopElevenLabsPlayback();
  await logAndApplyPlaybackModeForTts('speakWithElevenLabs:afterStop');

  const spokenText = applyAmoraeaPronunciation(text ?? '');
  if (!spokenText.trim()) {
    await speakFallback(spokenText, onFallback);
    return;
  }

  if (!isElevenLabsEnabledForEnvironment()) {
    await speakFallback(spokenText, onFallback);
    return;
  }

  const apiKey = getApiKey();
  const proxyUrl = getTtsProxyUrl();
  const useProxy = !apiKey && !!proxyUrl;
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  const voiceId = fromExtra?.elevenLabsVoiceId
    || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID)
    || DEFAULT_VOICE_ID;
  if (!apiKey && !useProxy) {
    console.warn('ElevenLabs: No API key (EXPO_PUBLIC_ELEVENLABS_API_KEY or app config). Using fallback TTS — set the key for natural voice.');
    await speakFallback(spokenText, onFallback);
    return;
  }

  if (Platform.OS === 'ios' && !iosUseElevenLabsMp3Playback()) {
    await speakFallback(spokenText, onFallback);
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
      await speakFallback(spokenText, onFallback);
      return;
    }

    const arrayBuffer = await res.arrayBuffer();

    if (Platform.OS === 'web') {
      const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const AudioCtor = typeof (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio !== 'undefined'
        ? (globalThis as unknown as { Audio: new (src?: string) => HTMLAudioElement }).Audio
        : undefined;
      if (!AudioCtor) {
        URL.revokeObjectURL(url);
        await speakFallback(spokenText, onFallback);
        return;
      }
      const audio = new AudioCtor(url);
      activeWebAudio = audio;
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
        audio.play().catch(reject);
      });
      return;
    }

    // Native: write to temp file, play with expo-av
    const base64 = arrayBufferToBase64(arrayBuffer);
    const dir = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
    if (!dir) {
      await speakFallback(spokenText, onFallback);
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
        sound.playAsync().catch(reject);
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
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    await speakFallback(spokenText, onFallback);
  }
}

function speakFallback(text: string, onFallback?: () => void): Promise<void> {
  onFallback?.();
  return new Promise((resolve) => {
    const run = async () => {
      await stopElevenLabsPlayback();
      if (Platform.OS !== 'web') {
        await logAndApplyPlaybackModeForTts('speakFallback:before_expo_speech').catch(() => {});
      }
      // iOS: false = AVSpeechSynthesizer uses its own playback session (speaker). true inherits app session (often earpiece after PlayAndRecord/mic).
      const iosSpeechSession = Platform.OS === 'ios' ? { useApplicationAudioSession: false as const } : {};
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.78,
        pitch: 0.92,
        ...iosSpeechSession,
        onDone: resolve,
        onStopped: resolve,
        onError: () => resolve(),
      });
    };
    run().catch(() => resolve());
  });
}

/** Stop any current TTS (including native MP3). Safe to fire-and-forget from UI handlers. */
export function stopElevenLabsSpeech(): void {
  void stopElevenLabsPlayback();
}
