import { Platform } from 'react-native';

import {
  applyNativeTtsPrePlaybackAudioMode,
  logAndApplyPlaybackModeForTts,
  markNativePlaybackBridgeBeforeNextTts,
} from './audioModeHelpers';
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

async function fallbackToDeviceSpeech(
  deviceSpeechText: string,
  onFallback: (() => void) | undefined,
  options: ElevenLabsSpeakOptions | undefined,
): Promise<void> {
  await speakFallback(deviceSpeechText, onFallback, {
    ...options,
    elevenLabsPostBridgeFetchRetried: true,
  });
}

async function fetchElevenLabsBufferWithOptionalAndroidRetry(
  text: string,
  options: ElevenLabsSpeakOptions | undefined,
): Promise<ArrayBuffer | null> {
  let arrayBuffer: ArrayBuffer | null =
    options?.prefetchedMpegArrayBuffer && options.prefetchedMpegArrayBuffer.byteLength > 0
      ? options.prefetchedMpegArrayBuffer
      : await fetchElevenLabsMpegArrayBuffer(text);

  if (
    arrayBuffer ||
    Platform.OS !== 'android' ||
    options?.elevenLabsPostBridgeFetchRetried
  ) {
    return arrayBuffer;
  }

  markNativePlaybackBridgeBeforeNextTts('elevenlabs_android_fetch_retry');
  await applyNativeTtsPrePlaybackAudioMode('speakWithElevenLabs:androidFetchRetry');
  return fetchElevenLabsMpegArrayBuffer(text);
}

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
    await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
    return;
  }

  if (!envAllowsEleven) {
    await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
    return;
  }

  const proxyUrl = getTtsProxyUrl();
  const apiKey = getElevenLabsApiKey();
  const useProxy = !apiKey && !!proxyUrl;
  if (!apiKey && !useProxy) {
    console.warn('ElevenLabs: No API key (EXPO_PUBLIC_ELEVENLABS_API_KEY or app config). Using fallback TTS — set the key for natural voice.');
    await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
    return;
  }

  if (iosBlocksMp3) {
    await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
    return;
  }

  try {
    const arrayBuffer = await fetchElevenLabsBufferWithOptionalAndroidRetry(text, options);
    if (!arrayBuffer) {
      await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
      return;
    }

    try {
      await playNativeElevenLabsMpegArrayBuffer(arrayBuffer, onPlaybackStarted, telemetrySource);
    } catch (e) {
      if (e instanceof Error && e.message === 'native_tts_no_cache_dir') {
        await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
        return;
      }
      throw e;
    }
    recordElevenLabsSpokenContext(spokenText);
  } catch (err) {
    console.warn('ElevenLabs TTS failed, using fallback:', err);
    await fallbackToDeviceSpeech(deviceSpeechText, onFallback, options);
  }
}
