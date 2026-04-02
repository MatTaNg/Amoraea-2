import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { setPlaybackMode } from './audioModeHelpers';
import { remoteLog } from '@utilities/remoteLog';
import { supabase } from '@data/supabase/client';

/**
 * Jessica — warm, friendly, conversational (ElevenLabs). Override with
 * EXPO_PUBLIC_ELEVENLABS_VOICE_ID or app config elevenLabsVoiceId if needed.
 */
const DEFAULT_VOICE_ID = 'cgSgspJ2msm6clMCkdW9'; // Jessica — warm, friendly

let activeWebAudio: { pause(): void; currentTime: number } | null = null;

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
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-10',hypothesisId:'H-TTS-1',location:'elevenLabsTts.ts:getApiKey',message:'resolved elevenlabs key availability',data:{hasFromProcess:!!(fromProcess||'').trim(),hasFromConfig:!!(fromConfig||'').trim(),hasExpoConfigExtra:!!expoConfigExtra,hasLegacyManifestExtra:!!legacyManifestExtra,hasManifest2Extra:!!manifest2Extra,hasEasConfig:!!easConfig,resolved:!!resolved},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
 * Speak text using ElevenLabs TTS (warm, natural voice).
 * Falls back to expo-speech if API key is missing or request fails.
 * Returns a promise that resolves when playback finishes (or fallback completes).
 */
export async function speakWithElevenLabs(
  text: string,
  onFallback?: () => void
): Promise<void> {
  const spokenText = applyAmoraeaPronunciation(text ?? '');
  const apiKey = getApiKey();
  const proxyUrl = getTtsProxyUrl();
  const useProxy = !apiKey && !!proxyUrl;
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  const voiceId = fromExtra?.elevenLabsVoiceId
    || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID)
    || DEFAULT_VOICE_ID;
  void remoteLog('[AUDIO_ROUTE] tts provider entry', {
    runId: 'audio-route-debug-10',
    platform: Platform.OS,
    hasApiKey: !!apiKey,
    hasProxyUrl: !!proxyUrl,
    useProxy,
    textLength: spokenText.length,
  });
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H3',location:'elevenLabsTts.ts:speakWithElevenLabs:entry',message:'tts start',data:{platform:Platform.OS,textLength:spokenText.length,hasApiKey:!!apiKey,voiceId},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if ((!apiKey && !useProxy) || !spokenText.trim()) {
    void remoteLog('[AUDIO_ROUTE] tts fallback no_key_or_text', {
      runId: 'audio-route-debug-10',
      platform: Platform.OS,
      hasApiKey: !!apiKey,
      hasProxyUrl: !!proxyUrl,
      textLength: spokenText.trim().length,
    });
    if (!apiKey && !useProxy) {
      console.warn('ElevenLabs: No API key (EXPO_PUBLIC_ELEVENLABS_API_KEY or app config). Using fallback TTS — set the key for natural voice.');
    }
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
    const res = await fetch(
      useProxy ? proxyUrl : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      useProxy
        ? {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'audio/mpeg',
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
      void remoteLog('[AUDIO_ROUTE] tts fallback non_ok', {
        runId: 'audio-route-debug-10',
        platform: Platform.OS,
        status: res.status,
        source: useProxy ? 'proxy' : 'direct',
      });
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
    // Force speaker route on iOS immediately before playback (fixes low volume after first mic use)
    await setPlaybackMode();
    void remoteLog('[AUDIO_ROUTE] tts native before play', {
      runId: 'audio-route-debug-10',
      platform: Platform.OS,
    });
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H1',location:'elevenLabsTts.ts:speakWithElevenLabs:beforePlayAsync',message:'native tts playback about to start',data:{platform:Platform.OS,fileUriSuffix:fileUri.slice(-24)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { sound } = await Audio.Sound.createAsync(
      { uri: fileUri },
      { shouldPlay: false, volume: 1.0, isMuted: false } // shouldPlay: false, play manually below
    );
    
    await new Promise<void>((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinishAndNotifyPlaying) {
          resolve();
        }
      });
      sound.playAsync().catch(reject); // clean, no second ensurePlaybackMode
    });
    await sound.unloadAsync();
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // ignore cleanup errors
    }
  } catch (err) {
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    void remoteLog('[AUDIO_ROUTE] tts fallback catch', {
      runId: 'audio-route-debug-10',
      platform: Platform.OS,
      errorName: err instanceof Error ? err.name : 'unknown',
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'062597'},body:JSON.stringify({sessionId:'062597',runId:'audio-route-debug-1',hypothesisId:'H3',location:'elevenLabsTts.ts:speakWithElevenLabs:catch',message:'tts threw, falling back',data:{errorName:err instanceof Error?err.name:'unknown',errorMessage:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    await speakFallback(spokenText, onFallback);
  }
}

function speakFallback(text: string, onFallback?: () => void): Promise<void> {
  onFallback?.();
  return new Promise((resolve) => {
    const run = async () => {
      if (Platform.OS !== 'web') {
        await setPlaybackMode().catch(() => {});
        void remoteLog('[AUDIO_ROUTE] tts fallback setPlaybackMode', {
          runId: 'audio-route-debug-10',
          platform: Platform.OS,
        });
      }
      Speech.speak(text, {
        language: 'en-US',
        rate: 0.78,
        pitch: 0.92,
        onDone: resolve,
        onStopped: resolve,
        onError: () => resolve(),
      });
    };
    run().catch(() => resolve());
  });
}

/** Stop any current ElevenLabs or fallback speech. */
export function stopElevenLabsSpeech(): void {
  if (Platform.OS === 'web' && activeWebAudio) {
    try {
      activeWebAudio.pause();
      activeWebAudio.currentTime = 0;
    } catch {}
    activeWebAudio = null;
  }
  Speech.stop();
}
