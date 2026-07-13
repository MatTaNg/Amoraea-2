/** Amoraea-voiced and chat error copy for recording, transcription, and API failures. */

/**
 * Amoraea-voiced fallbacks when something goes wrong. Never expose technical language.
 * Used only for recording/transcription retry prompts — not for API errors.
 */
export const AMORAEA_ERROR_MESSAGES = {
  waiting: [
    'Give me just a moment...',
    'One moment...',
    'Bear with me for a second...',
  ],
  conversationFailed: [
    "I need to pause there — something interrupted me. Could you say that again?",
    "I lost my thread for a moment. Can you repeat what you just said?",
    "Something pulled me away briefly. I'm back — what were you saying?",
  ],
  recordingOrTranscriptionRetry: [
    "I didn't quite catch that — could you say it again?",
    "Seems like an interruption happened. Would you mind repeating that?",
    "I missed that — can you say it once more?",
  ],
  recordingOrTranscriptionRetryNative: [
    "I didn't catch that — tap the mic and try again.",
    "Say that again when you're ready.",
    "I missed that — give it another go.",
  ],
  /** Mic/session start failures — do not reuse transcription "interruption" copy (confusing when TTS/mic overlap). */
  recordingMicOrSession: [
    "I'm having trouble starting the microphone — try tapping the mic once more.",
    'The mic did not start cleanly. Tap the mic again when you are ready.',
  ],
};

/** User-facing error messages shown in chat (no TTS). */
export const CHAT_ERROR_MESSAGES = {
  retryExhausted: "I'm having trouble connecting right now. Try tapping the mic again in a moment.",
  badRequest:
    'Something went wrong. Refresh the page and try again, or come back later if the problem continues.',
  unauthorized: "There's an authentication issue. Try closing and reopening the app.",
  serverError: "Something went wrong on our end. Try again in a moment.",
  proxyError: "Having trouble reaching the server. Check your connection and try again.",
  unknown:
    'Something went wrong. Refresh the page and try again, or come back later if the problem continues.',
};

/** Do not surface refresh-page chat errors for recoverable tab/TTS/stale-turn failures. */
export function shouldSuppressRecoverableConversationChatError(
  err: unknown,
  ctx: { turnEpochAtStart: number; turnEpochNow: number },
): boolean {
  if (ctx.turnEpochAtStart !== ctx.turnEpochNow) {
    return true;
  }
  if (err instanceof Error) {
    if (err.name === 'AbortError') return true;
    if (err.name === 'WebTtsRequiresUserGestureError') return true;
    const msg = err.message;
    if (msg === 'WEB_TTS_GESTURE' || msg.includes('WEB_TTS_GESTURE')) return true;
  }
  return false;
}

export function getErrorMessage(err: unknown, retriesExhausted = false): string {
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { status?: number; statusCode?: number })?.statusCode;
  // Only show retry-exhausted message when retries were actually exhausted (never for first 429)
  if (retriesExhausted) return CHAT_ERROR_MESSAGES.retryExhausted;
  if (status === 400) return CHAT_ERROR_MESSAGES.badRequest;
  if (status === 401) return CHAT_ERROR_MESSAGES.unauthorized;
  if (status === 403) return CHAT_ERROR_MESSAGES.unauthorized;
  if (status === 500) return CHAT_ERROR_MESSAGES.serverError;
  return CHAT_ERROR_MESSAGES.unknown;
}
export function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function assistantMessageForRecordingHardwareFailure(useWebCopy: boolean): string {
  const pool = useWebCopy
    ? AMORAEA_ERROR_MESSAGES.recordingMicOrSession
    : AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetryNative;
  return randomFrom(pool);
}

/** Escalating copy for empty/bad transcription — avoids dozens of identical retry lines. */
export function assistantMessageForRecordingOrTranscriptionFailure(streak: number, useWebCopy: boolean): string {
  const shortPool = useWebCopy
    ? AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetry
    : AMORAEA_ERROR_MESSAGES.recordingOrTranscriptionRetryNative;
  if (streak >= 6) {
    return (
      "I'm still having trouble hearing you. You may want to try again in a quieter place with a more stable connection. " +
      'You can close the app and pick up later when you are ready.'
    );
  }
  if (streak === 3) {
    return (
      "It sounds like I might be having trouble hearing you clearly. Would you like to check your microphone, " +
      'or try moving somewhere quieter, then try again?'
    );
  }
  return randomFrom(shortPool);
}

/**
 * After Whisper retries are exhausted: neutral copy only — no subscription/quota/billing wording for users.
 */
export function getWhisperInfraExhaustedUserMessage(_args: {
  lastHttpStatus: number | null;
  failureReason: string;
}): string {
  return INTERVIEW_START_UNAVAILABLE_MESSAGE;
}

/** Shown when the interview cannot start (missing API config, init crash, etc.). */
export const INTERVIEW_START_UNAVAILABLE_MESSAGE =
  'Our servers are down. Please try again later.';

/** Whisper upload filename must match actual container (Safari/desktop often records MP4, not WebM). */
export function pickWhisperUploadFilename(blob: Blob): string {
  const t = (blob.type || '').toLowerCase();
  /** Use `.mp4` for `audio/mp4` — some stacks reject AAC-in-MP4 when mislabeled as `.m4a`. */
  if (t.includes('mp4') && !t.includes('m4a')) return 'recording.mp4';
  if (t.includes('m4a') || t.includes('mp4a') || t.includes('x-m4a')) return 'recording.m4a';
  if (t.includes('ogg')) return 'recording.ogg';
  if (t.includes('wav')) return 'recording.wav';
  if (t.includes('mpeg') || t.includes('mp3')) return 'recording.mp3';
  return 'recording.webm';
}

export function whisperUploadFilePart(blob: Blob): Blob | File {
  const name = pickWhisperUploadFilename(blob);
  const mime = blob.type || 'application/octet-stream';
  if (typeof File !== 'undefined') {
    return new File([blob], name, { type: mime });
  }
  return blob;
}