/** Fixed copy when Whisper detects a non-English language (see Amoraea interview flow). */
export const NON_ENGLISH_VOICE_PROMPT =
  "Sounds like you're speaking a different language. I only know English! Can you repeat that in English?";

/** Clarification / elongating probes — never the "current question" in Show scenario modal. */
const SCENARIO_MODAL_FOLLOW_UP_PROBE_PATTERNS = [
  'can you say more about that',
  'just say whatever comes to mind',
  'say whatever comes to mind',
  'could you say more',
  'can you tell me more',
  "i didn't quite catch that",
  'could you say it again',
  'would you mind repeating that',
  'seems like an interruption happened',
  "sorry, i didn't catch",
  'can you elaborate',
  'go on',
  'tell me more',
  'what else',
  'take your time',
  'still here',
] as const;

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

export type WhisperVerboseStats = {
  segment_count: number;
  /** Mean of per-segment `Math.exp(avg_logprob)` when segments carry logprobs. */
  overall_confidence: number | null;
  min_segment_confidence: number | null;
  max_segment_confidence: number | null;
  avg_segment_confidence: number | null;
};

function logprobToProb(lp: number): number {
  const p = Math.exp(lp);
  if (!Number.isFinite(p)) return 0;
  return Math.max(0, Math.min(1, p));
}

/** Segment-level stats from Whisper `verbose_json` (best-effort). */
export function parseWhisperVerboseStats(data: unknown): WhisperVerboseStats {
  if (typeof data !== 'object' || data === null) {
    return {
      segment_count: 0,
      overall_confidence: null,
      min_segment_confidence: null,
      max_segment_confidence: null,
      avg_segment_confidence: null,
    };
  }
  const o = data as { segments?: Array<{ avg_logprob?: number }> };
  const segs = Array.isArray(o.segments) ? o.segments : [];
  const confs = segs
    .map((s) => (typeof s?.avg_logprob === 'number' && Number.isFinite(s.avg_logprob) ? logprobToProb(s.avg_logprob) : null))
    .filter((x): x is number => x != null);
  if (confs.length === 0) {
    return {
      segment_count: segs.length,
      overall_confidence: null,
      min_segment_confidence: null,
      max_segment_confidence: null,
      avg_segment_confidence: null,
    };
  }
  const minC = Math.min(...confs);
  const maxC = Math.max(...confs);
  const avgC = confs.reduce((a, b) => a + b, 0) / confs.length;
  const overall = avgC;
  return {
    segment_count: segs.length,
    overall_confidence: Math.round(overall * 1000) / 1000,
    min_segment_confidence: Math.round(minC * 1000) / 1000,
    max_segment_confidence: Math.round(maxC * 1000) / 1000,
    avg_segment_confidence: Math.round(avgC * 1000) / 1000,
  };
}
