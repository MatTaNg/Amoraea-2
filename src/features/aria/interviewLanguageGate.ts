/** Fixed copy when Whisper detects a non-English language (see Aria interview flow). */
export const NON_ENGLISH_VOICE_PROMPT =
  "Sounds like you're speaking a different language. I only know English! Can you repeat that in English?";

export function countSpokenWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** True if Whisper's `language` field indicates English. Missing/empty => treat as English (no gate). */
export function whisperLanguageIsEnglish(language: string | null | undefined): boolean {
  if (language == null || language === '') return true;
  const l = language.trim().toLowerCase();
  if (l === 'en' || l.startsWith('en-')) return true;
  if (l === 'english') return true;
  return false;
}

/**
 * When to block interview processing: enough words for reliable language id, and explicit non-English label.
 */
export function shouldRejectVoiceForNonEnglish(
  text: string,
  language: string | null | undefined
): boolean {
  if (countSpokenWords(text) < 5) return false;
  if (language == null || language === '') return false;
  return !whisperLanguageIsEnglish(language);
}

/** Parse Whisper `verbose_json` (or compatible) transcription responses. */
export function parseWhisperTranscriptionPayload(data: unknown): {
  text: string;
  language: string | null;
  /** Best-effort from segments avg_logprob when present. */
  confidence: number | null;
} {
  if (typeof data !== 'object' || data === null) {
    return { text: '', language: null, confidence: null };
  }
  const o = data as {
    text?: unknown;
    language?: unknown;
    segments?: Array<{ avg_logprob?: number }>;
  };
  const text = typeof o.text === 'string' ? o.text.trim() : '';
  const language =
    typeof o.language === 'string' && o.language.trim() !== ''
      ? o.language.trim()
      : null;
  let confidence: number | null = null;
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const logprobs = segs
    .map((s) => (typeof s?.avg_logprob === 'number' && Number.isFinite(s.avg_logprob) ? s.avg_logprob : null))
    .filter((x): x is number => x != null);
  if (logprobs.length > 0) {
    const mean = logprobs.reduce((a, b) => a + b, 0) / logprobs.length;
    confidence = Math.max(0, Math.min(1, (mean + 2) / 4));
  }
  return { text, language, confidence };
}
