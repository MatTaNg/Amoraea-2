import { Platform } from 'react-native';

import { isIosSafariMobileWeb, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import type { PreInitTriggerDuring } from '@features/aria/utils/webInterviewMicPreInit';
import { takePreAuthorizedAudioElementForTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import type { ElevenLabsSpeakOptions } from './elevenLabsSpeakTypes';
import { fetchElevenLabsMpegArrayBuffer, tryPlayElevenLabsPcmStream } from './elevenLabsTtsFetch';
import { recordElevenLabsSpokenContext } from './elevenLabsSpokenContext';
import { tryPlayElevenLabsMp3WithWebAudio } from './playElevenLabsMp3WithWebAudio';
import { playElevenLabsMp3WithWebHtmlAudio } from './playElevenLabsMp3WithWebHtmlAudio';
import { webSpeechShouldDeferToUserGesture } from './webSpeechDeferPolicy';
import { shouldDiscourageElevenLabsPcmStreamOnWeb } from './webInterviewTtsBrowserGuards';
import {
  ensureWebPlaybackPrimedForNextTurn,
  shouldSkipSilentReprimeForTelemetry,
} from './webInterviewWebPlaybackPriming';

const LONG_TTS_USE_STREAMING_MIN_CHARS = 100;

export type SpeakElevenLabsWebMp3Params = {
  text: string;
  spokenText: string;
  telemetrySource: TtsTelemetrySource;
  preInitTriggerDuring: PreInitTriggerDuring;
  playbackRateMultiplier: number;
  options?: ElevenLabsSpeakOptions;
  onPlaybackStarted?: () => void;
};

export type SpeakElevenLabsWebMp3Result = 'played' | 'fallback';

function preferTabResumableHtmlAudio(telemetrySource: TtsTelemetrySource): boolean {
  return telemetrySource === 'turn' || telemetrySource === 'replay';
}

function shouldTryPcmStream(
  spokenText: string,
  telemetrySource: TtsTelemetrySource,
  preferHtml: boolean,
  options?: ElevenLabsSpeakOptions
): boolean {
  return (
    !preferHtml &&
    !options?.skipPcmStream &&
    !shouldDiscourageElevenLabsPcmStreamOnWeb(undefined, { isIosSafariMobileWeb }) &&
    webSpeechShouldDeferToUserGesture() &&
    telemetrySource !== 'greeting' &&
    !options?.prefetchedMpegArrayBuffer &&
    spokenText.trim().length > LONG_TTS_USE_STREAMING_MIN_CHARS
  );
}

/**
 * Web ElevenLabs MP3 playback: optional PCM stream, MP3 fetch, Web Audio decode, then HTML `<audio>`.
 */
export async function speakElevenLabsWebMp3(
  params: SpeakElevenLabsWebMp3Params
): Promise<SpeakElevenLabsWebMp3Result> {
  if (Platform.OS !== 'web') {
    return 'fallback';
  }

  const preferHtml = preferTabResumableHtmlAudio(params.telemetrySource);

  if (shouldTryPcmStream(params.spokenText, params.telemetrySource, preferHtml, params.options)) {
    if (!params.options?.skipWebPlaybackPriming) {
      await ensureWebPlaybackPrimedForNextTurn(params.telemetrySource, {
        skipSilentReprime:
          params.options?.skipSilentWebPlaybackReprime ||
          shouldSkipSilentReprimeForTelemetry(params.telemetrySource),
      });
    }
    const playedPcm = await tryPlayElevenLabsPcmStream(
      params.spokenText,
      params.onPlaybackStarted,
      params.telemetrySource,
      params.preInitTriggerDuring,
      params.playbackRateMultiplier
    );
    if (playedPcm) {
      recordElevenLabsSpokenContext(params.spokenText);
      return 'played';
    }
  }

  let arrayBuffer: ArrayBuffer;
  if (params.options?.prefetchedMpegArrayBuffer && params.options.prefetchedMpegArrayBuffer.byteLength > 0) {
    arrayBuffer = params.options.prefetchedMpegArrayBuffer;
  } else {
    const downloaded = await fetchElevenLabsMpegArrayBuffer(params.text);
    if (!downloaded) {
      return 'fallback';
    }
    arrayBuffer = downloaded;
  }

  if (!params.options?.skipWebPlaybackPriming) {
    await ensureWebPlaybackPrimedForNextTurn(params.telemetrySource, {
      skipSilentReprime:
        params.options?.skipSilentWebPlaybackReprime ||
        shouldSkipSilentReprimeForTelemetry(params.telemetrySource),
    });
  }

  const abForWebAudio = arrayBuffer.slice(0);
  const skipWebAudioDecode = webSpeechShouldDeferToUserGesture() || preferHtml;
  const playedViaCtx = skipWebAudioDecode
    ? false
    : await tryPlayElevenLabsMp3WithWebAudio(
        abForWebAudio,
        params.onPlaybackStarted,
        params.telemetrySource,
        params.preInitTriggerDuring,
        params.playbackRateMultiplier
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
    recordElevenLabsSpokenContext(params.spokenText);
    return 'played';
  }

  try {
    await playElevenLabsMp3WithWebHtmlAudio({
      arrayBuffer,
      spokenText: params.spokenText,
      telemetrySource: params.telemetrySource,
      preInitTriggerDuring: params.preInitTriggerDuring,
      playbackRateMultiplier: params.playbackRateMultiplier,
      preferTabResumableHtmlAudio: preferHtml,
      onPlaybackStarted: params.onPlaybackStarted,
      options: params.options,
    });
    recordElevenLabsSpokenContext(params.spokenText);
    return 'played';
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === 'web_html_audio_prepare_failed' || e.message === 'web_html_audio_context_resume_failed')
    ) {
      return 'fallback';
    }
    throw e;
  }
}
