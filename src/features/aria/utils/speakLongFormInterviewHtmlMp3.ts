import { Platform } from 'react-native';

import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { substituteCanonicalInterviewScenarioBodiesForTts } from '@features/aria/substituteCanonicalInterviewScenarioBodiesForTts';
import { isElevenLabsEnabledForEnvironment } from '@features/aria/utils/elevenLabsTtsAvailability';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { shouldUseDefaultVoiceInsteadOfElevenLabs } from '@features/aria/utils/interviewTtsDevAccount';
import { getEffectivePlaybackRateMultiplier } from '@features/aria/utils/interviewTtsPlaybackRate';
import { trySpeakWebSpeechInUserGesture } from '@features/aria/utils/interviewWebSpeechSynthesis';
import { playElevenLabsMp3WithWebHtmlAudio } from '@features/aria/utils/playElevenLabsMp3WithWebHtmlAudio';
import { takePreAuthorizedAudioElementForTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';

export type SpeakLongFormInterviewHtmlMp3Args = {
  text: string;
  telemetrySource: TtsTelemetrySource;
  prefetchedBuffer?: ArrayBuffer | null;
  onPlaybackStarted?: () => void;
};

/** Long interviewer lines (scenario vignettes, tab-restore replay) via ElevenLabs HTML MP3 — avoids silent web-speech fallback. */
export async function speakLongFormInterviewHtmlMp3(
  args: SpeakLongFormInterviewHtmlMp3Args,
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const raw = args.text.trim();
  if (!raw) return false;
  const text = substituteCanonicalInterviewScenarioBodiesForTts(raw);
  if (!text) return false;

  if (shouldUseDefaultVoiceInsteadOfElevenLabs()) {
    await new Promise<void>((resolve) => {
      trySpeakWebSpeechInUserGesture(text, resolve);
    });
    return true;
  }

  if (!isElevenLabsEnabledForEnvironment()) {
    return false;
  }

  /** Prefetch was for the raw string — drop it if canonical rewrite changed the spoken body. */
  let buffer =
    text === raw ? args.prefetchedBuffer : null;
  if (!buffer?.byteLength) {
    buffer = (await fetchElevenLabsMpegArrayBuffer(text)) ?? undefined;
  }
  if (!buffer?.byteLength) {
    return false;
  }

  const preAuthEl = takePreAuthorizedAudioElementForTts();
  try {
    await playElevenLabsMp3WithWebHtmlAudio({
      arrayBuffer: buffer,
      spokenText: text,
      telemetrySource: args.telemetrySource,
      preInitTriggerDuring: 'tts_playback',
      playbackRateMultiplier: getEffectivePlaybackRateMultiplier(),
      preferTabResumableHtmlAudio: args.telemetrySource === 'turn' || args.telemetrySource === 'replay',
      onPlaybackStarted: args.onPlaybackStarted,
      options: {
        skipMicPreInitDuringPlayback: true,
        prefetchedMpegArrayBuffer: buffer,
        ...(preAuthEl ? { skipWebPlaybackPriming: false } : {}),
      },
    });
    return true;
  } catch {
    return false;
  }
}
