/** OpenAI Whisper transcription API — use everywhere (client + proxy expectations). */
export const WHISPER_MODEL = 'whisper-1' as const;
/** Explicit language; do not rely on autodetection. */
export const WHISPER_LANGUAGE = 'en' as const;
/** Integer 0 per API (multipart sends as string "0"). */
export const WHISPER_TEMPERATURE = 0 as const;
