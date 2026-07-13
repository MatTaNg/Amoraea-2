import { Platform } from 'react-native';

import {
  logTtsAutoplayPlayOutcome,
  type TtsAutoplayPipeline,
  type TtsTelemetrySource,
} from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  finalizeInterviewMicAmbientOnTtsEnd,
  type PreInitTriggerDuring,
} from '@features/aria/utils/webInterviewMicPreInit';
import { getSessionLogRuntime } from '@utilities/sessionLogging/sessionLogContext';

import { kickInterviewMicPreInitForTtsPlayback } from './webInterviewMicPreInitKick';
import {
  captureWebInterviewTtsScheduleEpoch,
  registerActivePcmStreamSource,
  stopActiveWebBufferAndPcmPlayback,
  unregisterActivePcmStreamSource,
} from './webInterviewWebAudioPlaybackSurface';
import {
  ensureSharedWebAudioContextResumedForPlayback,
  getSharedWebAudioContext,
  isWebInterviewAudioUnlocked,
} from './webInterviewWebAudioContext';

export const ELEVENLABS_PCM_STREAM_SAMPLE_RATE = 24_000;
export const ELEVENLABS_PCM_MIN_START_BYTES = 4_800;

const TTS_PCM_STREAM_PIPELINE: TtsAutoplayPipeline = 'elevenlabs_web_pcm_stream';

/**
 * Plays L16LE mono PCM at {@link ELEVENLABS_PCM_STREAM_SAMPLE_RATE} from a streaming Response, scheduling
 * `AudioBufferSource` chunks as they arrive. Returns true when the stream finished playing.
 */
export async function playElevenLabsPcmStreamFromResponse(
  res: Response,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource,
  preInitTriggerDuring: PreInitTriggerDuring,
  playbackRateMultiplier: number = 1,
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !res.body) return false;
  const ctx = getSharedWebAudioContext();
  if (!ctx || !isWebInterviewAudioUnlocked()) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;

  const { isStale: pcmEpochStale } = captureWebInterviewTtsScheduleEpoch();

  const reader = res.body.getReader();
  let pending = new Uint8Array(0);
  let nextScheduleTime = 0;
  let pcmPlaybackStarted = false;
  let readComplete = false;
  let totalSourcesScheduled = 0;
  let totalSourcesCompleted = 0;
  let resolveAll: (() => void) | null = null;
  const allDone = new Promise<void>((resolve) => {
    resolveAll = resolve;
  });

  const cleanupPcmEpochAbort = async (): Promise<boolean> => {
    try {
      await reader.cancel();
    } catch {
      /* ignore */
    }
    stopActiveWebBufferAndPcmPlayback();
    resolveAll?.();
    return false;
  };

  const tryFinishIfDone = () => {
    if (readComplete && totalSourcesScheduled > 0 && totalSourcesCompleted >= totalSourcesScheduled) {
      resolveAll?.();
    }
  };

  const schedulePcmChunk = (u8: Uint8Array) => {
    if (pcmEpochStale()) return;
    if (u8.length < 2) return;
    const leBuf = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.length);
    const i16 = new Int16Array(leBuf);
    const abuf = ctx.createBuffer(1, i16.length, ELEVENLABS_PCM_STREAM_SAMPLE_RATE);
    const ch = abuf.getChannelData(0);
    for (let i = 0; i < i16.length; i += 1) {
      ch[i] = i16[i]! / 32768;
    }
    const src = ctx.createBufferSource();
    src.buffer = abuf;
    src.playbackRate.value = playbackRateMultiplier;
    src.connect(ctx.destination);
    const t0 = !pcmPlaybackStarted ? ctx.currentTime + 0.02 : nextScheduleTime;
    nextScheduleTime = t0 + abuf.duration / playbackRateMultiplier;
    if (!pcmPlaybackStarted) {
      pcmPlaybackStarted = true;
      onPlaybackStarted?.();
      kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
      logTtsAutoplayPlayOutcome({
        pipeline: TTS_PCM_STREAM_PIPELINE,
        outcome: 'play_ok',
        telemetrySource,
      });
      void getSessionLogRuntime();
    }
    totalSourcesScheduled += 1;
    const srcNode = src;
    registerActivePcmStreamSource(src);
    src.onended = () => {
      unregisterActivePcmStreamSource(srcNode);
      totalSourcesCompleted += 1;
      if (totalSourcesCompleted === totalSourcesScheduled) {
        finalizeInterviewMicAmbientOnTtsEnd();
      }
      tryFinishIfDone();
    };
    try {
      src.start(t0);
    } catch (e) {
      logTtsAutoplayPlayOutcome({
        pipeline: TTS_PCM_STREAM_PIPELINE,
        outcome: 'play_error',
        telemetrySource,
        errorMessagePreview: (e instanceof Error ? e.message : String(e)).slice(0, 120),
      });
    }
  };

  const takeEvenBytes = (n: number) => {
    if (n < 2) return;
    const take = n - (n % 2);
    if (take < 2) return;
    const chunk = pending.subarray(0, take);
    pending = pending.length > take ? pending.subarray(take) : new Uint8Array(0);
    schedulePcmChunk(chunk);
  };

  try {
    for (;;) {
      if (pcmEpochStale()) {
        return await cleanupPcmEpochAbort();
      }
      const { done, value } = await reader.read();
      if (value && value.length > 0) {
        const merged = new Uint8Array(pending.length + value.length);
        merged.set(pending, 0);
        merged.set(value, pending.length);
        pending = merged;
      }
      for (;;) {
        if (pcmEpochStale()) {
          return await cleanupPcmEpochAbort();
        }
        if (!pcmPlaybackStarted) {
          if (pending.length < ELEVENLABS_PCM_MIN_START_BYTES) break;
          takeEvenBytes(ELEVENLABS_PCM_MIN_START_BYTES);
        } else if (pending.length >= 16384) {
          takeEvenBytes(16384);
        } else {
          break;
        }
      }
      if (done) {
        readComplete = true;
        break;
      }
    }
  } catch {
    stopActiveWebBufferAndPcmPlayback();
    logTtsAutoplayPlayOutcome({
      pipeline: TTS_PCM_STREAM_PIPELINE,
      outcome: 'play_error',
      telemetrySource,
      errorMessagePreview: 'pcm_read_failed',
    });
    return false;
  }

  readComplete = true;
  while (pending.length >= 2) {
    if (pcmEpochStale()) {
      return await cleanupPcmEpochAbort();
    }
    if (pending.length >= 16384) {
      takeEvenBytes(16384);
    } else {
      takeEvenBytes(pending.length);
    }
  }
  if (pcmEpochStale()) {
    return await cleanupPcmEpochAbort();
  }
  if (totalSourcesScheduled === 0) {
    return false;
  }
  await Promise.race([allDone, new Promise<void>((r) => setTimeout(r, 600_000))]);
  return !pcmEpochStale();
}
