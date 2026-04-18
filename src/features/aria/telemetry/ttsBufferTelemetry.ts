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

export function consumeTtsPlaybackStrategyForNextPlayback(): 'streaming' | 'buffered_complete' {
  const s = pendingPlaybackStrategy ?? 'buffered_complete';
  pendingPlaybackStrategy = null;
  return s;
}
