/** OpenAI Whisper transcription model — only ASR model valid for /v1/audio/transcriptions. */
export const WHISPER_TRANSCRIPTION_MODEL = 'whisper-1' as const;

/** Non-whisper models (chat/TTS) return HTTP 404 "Invalid URL" from OpenAI on this endpoint. */
export function resolveWhisperTranscriptionModel(incoming: { get(key: string): unknown }): {
  model: typeof WHISPER_TRANSCRIPTION_MODEL;
  incomingModel: string | null;
  ignoredIncomingModel: boolean;
} {
  const raw = incoming.get('model');
  const incomingModel =
    raw == null
      ? null
      : typeof raw === 'string'
        ? raw.trim() || null
        : String(raw).trim() || null;
  const ignoredIncomingModel =
    incomingModel != null && incomingModel !== WHISPER_TRANSCRIPTION_MODEL;
  return {
    model: WHISPER_TRANSCRIPTION_MODEL,
    incomingModel,
    ignoredIncomingModel,
  };
}
