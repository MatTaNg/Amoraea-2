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

/** Heuristic: moment is likely a short confirmation (yes/no / ready). */
export function isSimpleYesNoInterviewMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase().trim();
  if (!q) return false;
  if (/are you ready\b/.test(q)) return true;
  if (/\bready to (get )?started\b/.test(q)) return true;
  if (/\bready\?\s*$/.test(q) && q.length < 80) return true;
  if (/\byes or no\b/i.test(q)) return true;
  if (/\b(yes|no)\b/.test(q) && q.length < 160) return true;
  return false;
}

/** Resume / re-entry copy — user may answer briefly (yes / repeat / continue). */
export function isResumeReentryWelcomePrompt(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (/welcome back\b/.test(q) && /continue where we left off\b/.test(q)) return true;
  if (/repeat what i said\b/.test(q) && /ready for your response\b/.test(q)) return true;
  return false;
}

/** Client recovery lines must not become the "question" for ratio gating (avoids re-ask loops). */
export function isClientAudioRecoveryAssistantLine(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').trim();
  if (!q) return false;
  if (/^i only caught part of that\b/i.test(q)) return true;
  if (/^i didn't catch any speech on that try\b/i.test(q)) return true;
  if (/^i'm having a little trouble on my end\b/i.test(q)) return true;
  return false;
}

/** Name / identity prompts — one or two words are valid. */
export function isNamePromptInterviewMoment(lastQuestionText: string | null | undefined): boolean {
  const q = (lastQuestionText ?? '').toLowerCase();
  if (/what('?s|\s+is)\s+your\s+name\b/.test(q)) return true;
  if (/\bhow\s+(do\s+you|should\s+i)\s+(call\s+you|address\s+you)\b/.test(q)) return true;
  return false;
}

/** Use for whisper ratio re-ask: short answers are OK (do not require a full sentence). */
export function isShortAnswerOkForWhisperRatioGate(lastQuestionText: string | null | undefined): boolean {
  return (
    isSimpleYesNoInterviewMoment(lastQuestionText) ||
    isResumeReentryWelcomePrompt(lastQuestionText) ||
    isClientAudioRecoveryAssistantLine(lastQuestionText) ||
    isNamePromptInterviewMoment(lastQuestionText)
  );
}
