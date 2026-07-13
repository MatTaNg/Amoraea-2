import { Platform } from 'react-native';

import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  finalizeInterviewMicAmbientOnTtsEnd,
  type PreInitTriggerDuring,
} from '@features/aria/utils/webInterviewMicPreInit';
import { getSessionLogRuntime } from '@utilities/sessionLogging/sessionLogContext';

import {
  assignAbortActiveWebBufferAudioPlayback,
  clearAbortActiveWebBufferAudioPlaybackIfMatches,
} from './webInterviewHtmlAudioPlaybackHooks';
import { kickInterviewMicPreInitForTtsPlayback } from './webInterviewMicPreInitKick';
import {
  assignActiveWebBufferSource,
  captureWebInterviewTtsScheduleEpoch,
  clearActiveWebBufferSourceIfMatches,
} from './webInterviewWebAudioPlaybackSurface';
import {
  ensureSharedWebAudioContextResumedForPlayback,
  getSharedWebAudioContext,
  isWebInterviewAudioUnlocked,
} from './webInterviewWebAudioContext';
import { WebInterviewTtsTabHiddenAbortError } from './webTtsGestureErrors';

function debugSummarizeAudioBufferPeaks(buf: AudioBuffer): {
  durationSec: number;
  sampleRate: number;
  channels: number;
  peak: number;
  rms: number;
} {
  const ch0 = buf.getChannelData(0);
  const n = Math.min(ch0.length, 96_000);
  let peak = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const v = ch0[i]!;
    const a = Math.abs(v);
    if (a > peak) peak = a;
    sumSq += v * v;
  }
  return {
    durationSec: buf.duration,
    sampleRate: buf.sampleRate,
    channels: buf.numberOfChannels,
    peak,
    rms: Math.sqrt(sumSq / Math.max(1, n)),
  };
}

/**
 * ElevenLabs MP3 via `decodeAudioData` + `AudioBufferSourceNode` on the shared `AudioContext`
 * primed by `unlockWebAudioForAutoplay()` (mic / start interview).
 */
export async function tryPlayElevenLabsMp3WithWebAudio(
  arrayBuffer: ArrayBuffer,
  onPlaybackStarted: (() => void) | undefined,
  telemetrySource: TtsTelemetrySource,
  preInitTriggerDuring: PreInitTriggerDuring,
  playbackRateMultiplier: number = 1,
): Promise<boolean> {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  const ctx = getSharedWebAudioContext();
  if (!ctx || !isWebInterviewAudioUnlocked()) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;
  const { isStale: epochStale } = captureWebInterviewTtsScheduleEpoch();
  const decodeTimeoutMs = 15000;
  let decoded: AudioBuffer;
  try {
    decoded = await Promise.race([
      ctx.decodeAudioData(arrayBuffer.slice(0)),
      new Promise<AudioBuffer>((_, reject) => {
        setTimeout(() => reject(new Error('decode-timeout')), decodeTimeoutMs);
      }),
    ]);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_web_audio_context',
      outcome: 'play_error',
      telemetrySource,
      errorName: 'decode',
      errorMessagePreview: msg.slice(0, 120),
    });
    return false;
  }
  if (epochStale()) return false;
  if (!(await ensureSharedWebAudioContextResumedForPlayback(telemetrySource))) return false;
  if (epochStale()) return false;
  let src: AudioBufferSourceNode | null = null;
  try {
    src = ctx.createBufferSource();
    src.buffer = decoded;
    src.playbackRate.value = playbackRateMultiplier;
    const durSec = decoded.duration;
    const playbackCapMs = Math.min(
      600_000,
      Math.max(4_000, Math.ceil(((Number.isFinite(durSec) ? durSec : 30) * 1000) / playbackRateMultiplier) + 3_000),
    );

    void debugSummarizeAudioBufferPeaks(decoded);
    void getSessionLogRuntime();

    const handlePlaybackRaceError = (raceErr: unknown): false => {
      const msg = raceErr instanceof Error ? raceErr.message : String(raceErr);
      if (msg === 'playback-timeout' && src) {
        try {
          src.stop(0);
        } catch {
          /* ignore */
        }
        clearActiveWebBufferSourceIfMatches(src);
        logTtsAutoplayPlayOutcome({
          pipeline: 'elevenlabs_web_audio_context',
          outcome: 'play_error',
          telemetrySource,
          errorName: 'playback-timeout',
          errorMessagePreview: `capMs=${playbackCapMs}`,
        });
        return false;
      }
      throw raceErr;
    };

    let playbackAnalyser: AnalyserNode | null = null;
    try {
      playbackAnalyser = ctx.createAnalyser();
      playbackAnalyser.fftSize = 512;
      src.connect(playbackAnalyser);
      playbackAnalyser.connect(ctx.destination);
    } catch {
      src.connect(ctx.destination);
      playbackAnalyser = null;
    }
    assignActiveWebBufferSource(src);
    try {
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          const clearBufferAbort = () => {
            clearAbortActiveWebBufferAudioPlaybackIfMatches(abortBufferPlayback);
          };
          const abortBufferPlayback = () => {
            clearBufferAbort();
            try {
              src!.stop(0);
            } catch {
              /* ignore */
            }
            clearActiveWebBufferSourceIfMatches(src!);
            reject(new WebInterviewTtsTabHiddenAbortError());
          };
          assignAbortActiveWebBufferAudioPlayback(abortBufferPlayback);
          src!.onended = () => {
            clearBufferAbort();
            finalizeInterviewMicAmbientOnTtsEnd();
            clearActiveWebBufferSourceIfMatches(src!);
            resolve();
          };
          try {
            if (epochStale()) {
              clearActiveWebBufferSourceIfMatches(src!);
              try {
                src!.disconnect();
              } catch {
                /* ignore */
              }
              try {
                playbackAnalyser?.disconnect();
              } catch {
                /* ignore */
              }
              reject(new WebInterviewTtsTabHiddenAbortError());
              return;
            }
            src!.start(0);
            onPlaybackStarted?.();
            void kickInterviewMicPreInitForTtsPlayback(preInitTriggerDuring);
            logTtsAutoplayPlayOutcome({
              pipeline: 'elevenlabs_web_audio_context',
              outcome: 'play_ok',
              telemetrySource,
            });
          } catch (e) {
            clearActiveWebBufferSourceIfMatches(src!);
            reject(e instanceof Error ? e : new Error(String(e)));
          }
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error('playback-timeout')), playbackCapMs);
        }),
      ]);
      return true;
    } catch (raceErr) {
      if (raceErr instanceof WebInterviewTtsTabHiddenAbortError) {
        throw raceErr;
      }
      const msg = raceErr instanceof Error ? raceErr.message : String(raceErr);
      if (msg === 'tts-schedule-aborted') {
        throw new WebInterviewTtsTabHiddenAbortError();
      }
      return handlePlaybackRaceError(raceErr);
    }
  } catch (err) {
    if (src) clearActiveWebBufferSourceIfMatches(src);
    const e = err instanceof Error ? err : new Error(String(err));
    logTtsAutoplayPlayOutcome({
      pipeline: 'elevenlabs_web_audio_context',
      outcome: 'play_error',
      telemetrySource,
      errorName: e.name,
      errorMessagePreview: e.message?.slice(0, 120),
    });
    return false;
  }
}
