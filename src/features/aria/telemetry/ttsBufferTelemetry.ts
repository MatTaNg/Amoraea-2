/** Set by ElevenLabs path immediately before playback after full buffer + duration check. Consumed once at `tts_playback_start`. */
let pendingBufferCompleteBeforePlayback: boolean | null = null;

export function setTtsBufferCompleteBeforePlaybackForNextPlayback(v: boolean): void {
  pendingBufferCompleteBeforePlayback = v;
}

export function consumeTtsBufferCompleteBeforePlaybackFlag(): boolean {
  const v = pendingBufferCompleteBeforePlayback === true;
  pendingBufferCompleteBeforePlayback = null;
  return v;
}
