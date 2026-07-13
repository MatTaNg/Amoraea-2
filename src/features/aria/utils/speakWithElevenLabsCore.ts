import { Platform } from 'react-native';

import { logAndApplyPlaybackModeForTts } from './audioModeHelpers';
import { type PreInitTriggerDuring } from '@features/aria/utils/webInterviewMicPreInit';
import {
  WebInterviewTtsTabHiddenAbortError,
  WebTtsRequiresUserGestureError,
} from './webTtsGestureErrors';
import { isWebInterviewAudioUnlocked } from './webInterviewWebAudioContext';
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
import { applyAmoraeaPronunciation } from './elevenLabsTtsVoice';
import { recordElevenLabsSpokenContext } from './elevenLabsSpokenContext';
import { speakElevenLabsWebMp3 } from './speakElevenLabsWebMp3';

/**
 * Speak text using ElevenLabs TTS (warm, natural voice).
 * Falls back to expo-speech if API key is missing or request fails.
 * Returns a promise that resolves when playback finishes (or fallback completes).
 */
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
  const apiKey = getElevenLabsApiKey();
  const useProxy = !apiKey && !!proxyUrl;
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
  if (Platform.OS === 'web' && !isWebInterviewAudioUnlocked()) {
    throw new WebTtsRequiresUserGestureError(spokenText);
  }

  try {
    if (Platform.OS === 'web') {
      const webResult = await speakElevenLabsWebMp3({
        text,
        spokenText,
        telemetrySource,
        preInitTriggerDuring,
        playbackRateMultiplier,
        options,
        onPlaybackStarted,
      });
      if (webResult === 'fallback') {
        await speakFallback(spokenText, onFallback, options);
      }
      return;
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

    try {
      await playNativeElevenLabsMpegArrayBuffer(arrayBuffer, onPlaybackStarted, telemetrySource);
    } catch (e) {
      if (e instanceof Error && e.message === 'native_tts_no_cache_dir') {
        await speakFallback(spokenText, onFallback, options);
        return;
      }
      throw e;
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
