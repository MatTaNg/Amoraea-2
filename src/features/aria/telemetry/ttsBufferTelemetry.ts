/** Set by ElevenLabs path immediately before playback after full buffer + duration check. Consumed once at `tts_playback_start`. */
let pendingBufferCompleteBeforePlayback: boolean | null = null;

/** Next `tts_playback_start` — how audio was sourced (ElevenLabs full buffer vs streaming / fallback). */
let pendingPlaybackStrategy: 'streaming' | 'buffered_complete' | null = null;

export function setTtsBufferCompleteBeforePlaybackForNextPlayback(v: boolean): void {
  pendingBufferCompleteBeforePlayback = v;
}

export function consumeTtsBufferCompleteBeforePlaybackFlag(): boolean {
  const v = pendingBufferCompleteBeforePlayback === true;
  pendingBufferCompleteBeforePlayback = null;
  return v;
}

export function setTtsPlaybackStrategyForNextPlayback(s: 'streaming' | 'buffered_complete'): void {
  pendingPlaybackStrategy = s;
}

const LONG_LINE_BUFFERED_STRATEGY_CHAR_THRESHOLD = 100;

/**
 * Set pending {@link setTtsBufferCompleteBeforePlaybackForNextPlayback} / {@link setTtsPlaybackStrategyForNextPlayback}
 * for the line about to be spoken, so `tts_playback_start` consumes the same turn’s strategy.
 * - ≤{LONG_LINE_BUFFERED_STRATEGY_CHAR_THRESHOLD} chars, scenario split segments, or non-web: `buffered_complete` + full buffer.
 * - Web, &gt; threshold, not a greeting: `streaming` (ElevenLabs PCM — playback starts with first network chunk).
 * - Greeting lines: always `buffered_complete` (prefetch/MP3 path; unchanged).
 */
export function prepareTtsPlaybackTelemetryState(args: {
  charCount: number;
  telemetryIsGreeting: boolean;
  isWeb: boolean;
}): void {
  const { charCount, telemetryIsGreeting, isWeb } = args;
  if (telemetryIsGreeting || !isWeb || charCount <= LONG_LINE_BUFFERED_STRATEGY_CHAR_THRESHOLD) {
    setTtsBufferCompleteBeforePlaybackForNextPlayback(true);
    setTtsPlaybackStrategyForNextPlayback('buffered_complete');
  } else {
    setTtsBufferCompleteBeforePlaybackForNextPlayback(false);
    setTtsPlaybackStrategyForNextPlayback('streaming');
  }
}

export function consumeTtsPlaybackStrategyForNextPlayback(): 'streaming' | 'buffered_complete' {
  const s = pendingPlaybackStrategy ?? 'buffered_complete';
  pendingPlaybackStrategy = null;
  return s;
}
