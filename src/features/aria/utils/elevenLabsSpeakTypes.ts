import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import type { PreInitTriggerDuring } from '@features/aria/utils/interviewMicPreInitTypes';

/** Options for {@link speakWithElevenLabs} and fallback TTS paths. */
export type ElevenLabsSpeakOptions = {
  /** Called once when audio actually starts (MP3 play() resolved, native playAsync, or fallback speech start). */
  onPlaybackStarted?: () => void;
  /** Baseline: which interviewer line this is (greeting vs mid-interview turn). */
  telemetry?: { source?: TtsTelemetrySource };
  /**
   * Full MP3 from a prior {@link fetchElevenLabsMpegArrayBuffer} — skips network fetch (e.g. prefetched segments).
   */
  prefetchedMpegArrayBuffer?: ArrayBuffer;
  /**
   * When chaining segments, skip `stopElevenLabsPlayback` at entry so the prior segment is not torn down mid-handoff.
   */
  skipStopElevenLabsPlaybackBeforeStart?: boolean;
  /** Parallel-stream 2nd+ sentence: skip silent HTML reprime (avoids Android/BT speaker snap between chunks). */
  skipWebPlaybackPriming?: boolean;
  /** Skip `reprimeSharedHtmlAudioSilentPlay` during priming (post-recording / parallel-stream continuations). */
  skipSilentWebPlaybackReprime?: boolean;
  /** Parallel streaming: never open mic capture during playback (Android speaker duck / route snap). */
  skipMicPreInitDuringPlayback?: boolean;
  /**
   * Parallel-stream handoffs: always play on the shared mobile `<audio>` element so Android Chrome
   * does not re-route speaker output when swapping blob URLs between consecutive chunks.
   */
  chainHtmlAudioPlayback?: boolean;
  /** Web mic pre-init audit: which phase last warmed the inactive MediaRecorder. */
  preInitTriggerDuring?: PreInitTriggerDuring;
  /** Web: force full MP3 download + Web Audio / HTML audio — skip raw PCM stream (retry path after truncated playback). */
  skipPcmStream?: boolean;
  /** Optional playback-rate multiplier for output pipelines that support it. */
  playbackRateMultiplier?: number;
};
