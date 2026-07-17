import { Platform } from 'react-native';

import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';
import { getEffectivePlaybackRateMultiplier } from './interviewTtsPlaybackRate';
import { speakFallback } from './interviewTtsSpeakFallback';
import { playNativeElevenLabsMpegArrayBuffer } from './nativeElevenLabsMp3Playback';
import { stopElevenLabsPlayback } from './elevenLabsTtsPlaybackStop';
import type { ElevenLabsSpeakOptions } from './elevenLabsSpeakTypes';
import {
  isElevenLabsEnabledForEnvironment,
  iosUseElevenLabsMp3Playback,
} from './elevenLabsTtsAvailability';
import { getElevenLabsApiKey, getTtsProxyUrl } from './elevenLabsTtsCredentials';
import { fetchElevenLabsMpegArrayBuffer } from './elevenLabsTtsFetch';
import { applyAmoraeaPronunciation, applyAmoraeaPronunciationForDeviceSpeech } from './elevenLabsTtsVoice';
import { recordElevenLabsSpokenContext } from './elevenLabsSpokenContext';

/**
 * Speak text using ElevenLabs TTS (warm, natural voice).
 * Native iOS/Android MP3 playback only — browser HTML-audio path removed.
 * Falls back to expo-speech if API key is missing or request fails.
 */
export async function speakWithElevenLabs(
  text: string,
  onFallback?: () => void,
  options?: ElevenLabsSpeakOptions
): Promise<void> {
  const onPlaybackStarted = options?.onPlaybackStarted;
  const telemetrySource = options?.telemetry?.source ?? 'other';
  void getEffectivePlaybackRateMultiplier(options?.playbackRateMultiplier);
  if (!options?.skipStopElevenLabsPlaybackBeforeStart) {
    await stopElevenLabsPlayback();
  }
  await logAndApplyPlaybackModeForTts('speakWithElevenLabs:afterStop');

  const rawText = text ?? '';
  const spokenText = applyAmoraeaPronunciation(rawText);
  const deviceSpeechText = applyAmoraeaPronunciationForDeviceSpeech(rawText);
  const envAllowsEleven = isElevenLabsEnabledForEnvironment();
  const iosBlocksMp3 = Platform.OS === 'ios' && !iosUseElevenLabsMp3Playback();

  if (!spokenText.trim()) {
    await speakFallback(deviceSpeechText, onFallback, options);
    return;
  }

  if (!envAllowsEleven) {
    await speakFallback(deviceSpeechText, onFallback, options);
    return;
  }

  const proxyUrl = getTtsProxyUrl();
  const apiKey = getElevenLabsApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  if (!apiKey && !useProxy) {
    console.warn('ElevenLabs: No API key (EXPO_PUBLIC_ELEVENLABS_API_KEY or app config). Using fallback TTS — set the key for natural voice.');
    await speakFallback(deviceSpeechText, onFallback, options);
    return;
  }

  if (iosBlocksMp3) {
    await speakFallback(deviceSpeechText, onFallback, options);
    return;
  }

  try {
    let arrayBuffer: ArrayBuffer;
    if (options?.prefetchedMpegArrayBuffer && options.prefetchedMpegArrayBuffer.byteLength > 0) {
      arrayBuffer = options.prefetchedMpegArrayBuffer;
    } else {
      const downloaded = await fetchElevenLabsMpegArrayBuffer(text);
      if (!downloaded) {
        await speakFallback(deviceSpeechText, onFallback, options);
        return;
      }
      arrayBuffer = downloaded;
    }

    try {
      await playNativeElevenLabsMpegArrayBuffer(arrayBuffer, onPlaybackStarted, telemetrySource);
    } catch (e) {
      if (e instanceof Error && e.message === 'native_tts_no_cache_dir') {
        await speakFallback(deviceSpeechText, onFallback, options);
        return;
      }
      throw e;
    }
    recordElevenLabsSpokenContext(spokenText);
  } catch (err) {
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    await speakFallback(deviceSpeechText, onFallback, options);
  }
}
