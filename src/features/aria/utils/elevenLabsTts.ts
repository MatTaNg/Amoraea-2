import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';

/**
 * Jessica — warm, friendly, conversational (ElevenLabs). Override with
 * EXPO_PUBLIC_ELEVENLABS_VOICE_ID or app config elevenLabsVoiceId if needed.
 */
const DEFAULT_VOICE_ID = 'cgSgspJ2msm6clMCkdW9'; // Jessica — warm, friendly

let activeWebAudio: { pause(): void; currentTime: number } | null = null;

const getApiKey = (): string => {
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsApiKey?: string } | undefined;
  if (fromExtra?.elevenLabsApiKey) return fromExtra.elevenLabsApiKey;
  return (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_API_KEY) || '';
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
  const apiKey = getApiKey();
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  const voiceId = fromExtra?.elevenLabsVoiceId
    || (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID)
    || DEFAULT_VOICE_ID;

  if (!apiKey || !text.trim()) {
    if (!apiKey) {
      console.warn('ElevenLabs: No API key (EXPO_PUBLIC_ELEVENLABS_API_KEY or app config). Using fallback TTS — set the key for natural voice.');
    }
    await speakFallback(text, onFallback);
    return;
  }

  try {
    // Use multilingual v2 for more natural, expressive speech (less robotic than flash).
    const modelId = 'eleven_multilingual_v2';
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        body: JSON.stringify({
          text: text.trim(),
          model_id: modelId,
          voice_settings: {
            stability: 0.22,
            similarity_boost: 0.82,
            style: 0.65,
            use_speaker_boost: true,
          },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.warn('ElevenLabs TTS error:', res.status, errText);
      await speakFallback(text, onFallback);
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
        await speakFallback(text, onFallback);
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
      await speakFallback(text, onFallback);
      return;
    }
    const fileUri = `${dir}tts_${Date.now()}.mp3`;
    await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });
    const { sound } = await Audio.Sound.createAsync({ uri: fileUri });
    await new Promise<void>((resolve, reject) => {
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinishAndNotifyPlaying) {
          resolve();
        }
      });
      sound.playAsync().catch(reject);
    });
    await sound.unloadAsync();
    try {
      await FileSystem.deleteAsync(fileUri, { idempotent: true });
    } catch {
      // ignore cleanup errors
    }
  } catch (err) {
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    await speakFallback(text, onFallback);
  }
}

function speakFallback(text: string, onFallback?: () => void): Promise<void> {
  onFallback?.();
  return new Promise((resolve) => {
    Speech.speak(text, {
      language: 'en-US',
      rate: 0.78,
      pitch: 0.92,
      onDone: resolve,
      onStopped: resolve,
      onError: resolve,
    });
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
