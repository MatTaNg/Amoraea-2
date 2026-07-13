import { Platform } from 'react-native';

import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { finalizeInterviewMicAmbientOnTtsEnd } from '@features/aria/utils/webInterviewMicPreInit';

import { getLocalDevPlaybackRateMultiplier } from './interviewTtsPlaybackRate';
import { kickInterviewMicPreInitForTtsPlayback } from './webInterviewMicPreInitKick';
import {
  assignActiveWebHtmlAudio,
  clearActiveWebHtmlAudio,
  getActiveWebHtmlAudioRef,
} from './webInterviewActiveHtmlAudio';
import { ensureWebHtmlAudioElementMaxVolume, waitForWebHtmlAudioElementReady } from './webInterviewHtmlAudioVolume';
import {
  assignPendingWebGestureBlobUrl,
  getPendingWebGestureBlobUrl,
} from './webInterviewPendingGestureBlob';
import {
  ensureWebPlaybackPrimedForNextTurn,
  shouldSkipSilentReprimeForTelemetry,
} from './webInterviewWebPlaybackPriming';

/**
 * If ElevenLabs MP3 was fetched but `play()` was blocked, the blob URL is stored — call from a user-gesture
 * handler (`onPressIn` / mic tap) so `play()` succeeds.
 */
export async function tryPlayPendingWebTtsAudioInUserGesture(
  onDone?: () => void,
  onPlaybackStarted?: () => void,
  telemetry?: { source?: TtsTelemetrySource },
): Promise<boolean> {
  const telemetrySource = telemetry?.source ?? 'other';
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !getPendingWebGestureBlobUrl()) return false;
  await ensureWebPlaybackPrimedForNextTurn(telemetrySource, {
    skipSilentReprime: shouldSkipSilentReprimeForTelemetry(telemetrySource),
  });
  const url = getPendingWebGestureBlobUrl();
  if (!url) return false;
  assignPendingWebGestureBlobUrl(null);
  const AudioCtor =
    typeof (globalThis as unknown as { Audio?: new (src?: string) => HTMLAudioElement }).Audio !==
    'undefined'
      ? (globalThis as unknown as { Audio: new (src?: string) => HTMLAudioElement }).Audio
      : undefined;
  if (!AudioCtor) {
    assignPendingWebGestureBlobUrl(url);
    return false;
  }
  const audio = new AudioCtor(url);
  assignActiveWebHtmlAudio(audio);
  const htmlAudio = audio as HTMLAudioElement;
  htmlAudio.playbackRate = getLocalDevPlaybackRateMultiplier();
  htmlAudio.setAttribute('playsinline', '');
  if ('playsInline' in htmlAudio) {
    (htmlAudio as { playsInline: boolean }).playsInline = true;
  }
  ensureWebHtmlAudioElementMaxVolume(htmlAudio);
  const finishAfterPlayback = () => {
    finalizeInterviewMicAmbientOnTtsEnd();
    if (getActiveWebHtmlAudioRef() === audio) clearActiveWebHtmlAudio();
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    onDone?.();
  };
  audio.onended = () => finishAfterPlayback();
  audio.onerror = () => {
    assignPendingWebGestureBlobUrl(url);
    if (getActiveWebHtmlAudioRef() === audio) clearActiveWebHtmlAudio();
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_gesture_flush',
      outcome: 'gesture_flush_rejected',
      telemetrySource,
    });
    onDone?.();
  };
  void (async () => {
    try {
      await waitForWebHtmlAudioElementReady(htmlAudio);
      await htmlAudio.play();
      onPlaybackStarted?.();
      kickInterviewMicPreInitForTtsPlayback('tts_playback');
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_gesture_flush',
        outcome: 'gesture_flush_ok',
        telemetrySource,
      });
    } catch {
      assignPendingWebGestureBlobUrl(url);
      if (getActiveWebHtmlAudioRef() === audio) clearActiveWebHtmlAudio();
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_gesture_flush',
        outcome: 'gesture_flush_rejected',
        telemetrySource,
      });
      onDone?.();
    }
  })();
  return true;
}
