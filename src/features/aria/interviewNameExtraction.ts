import { isNamePromptInterviewMoment } from '@features/aria/interviewLanguageGate';
import { isPlausibleInterviewName } from '@features/aria/interviewNameValidation';

/** Strips terminal punctuation Whisper often attaches to a short name (e.g. "Tiffany."). */
export function stripNameTokenPunctuationForValidation(token: string): string {
  return token.replace(/[.!?,;:]+$/g, '').trim();
}

export type InterviewNameExtractionMethod = 'direct' | 'sentence_stripped' | 'uncertain';
export type InterviewNameExtraction = {
  extractedName: string;
  extractionMethod: InterviewNameExtractionMethod;
  isFalseNameTrigger: boolean;
};

export const FALSE_NAME_TRIGGERS = new Set([
  'hello',
  'hi',
  'hey',
  'yes',
  'yeah',
  'yep',
  'sure',
  'ready',
  'good',
  'ok',
  'okay',
  'manual',
  'fine',
  'great',
  'time',
  'moment',
  'thanks',
  'thank',
  'please',
  'sorry',
  'wait',
  'hold',
  'just',
  'one',
  'you',
  'your',
  'bless',
  'god',
  'that',
  'thats',
  'all',
  'bye',
  'cheers',
  'what',
  'which',
  'who',
  'how',
]);

export function capitalizeNameCandidate(value: string): string {
  const trimmed = stripNameTokenPunctuationForValidation(value).trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

/**
 * True when the transcript looks like a first name (1–2 tokens, letters/apostrophe/hyphen only).
 * Handles "Tiffany." and "I'm called Mary" is not the goal — keep to short name-like replies.
 */
export function looksLikeName(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 50) return false;
  const parts = t
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuationForValidation(p))
    .filter((p) => p.length > 0);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

export function extractInterviewNameFromResponse(text: string): InterviewNameExtraction {
  const raw = text.replace(/\s+/g, ' ').trim();
  const stripped = stripNameTokenPunctuationForValidation(raw);
  let candidate = stripped;
  let extractionMethod: InterviewNameExtractionMethod = 'direct';

  const introPattern =
    /^(?:it\s+(?:will|would|should|can)\s+be|it(?:'s|\s+is)|you\s+can\s+call\s+me|my\s+name\s+is|call\s+me|i\s+go\s+by|people\s+call\s+me|i(?:'m|\s+am)\s+called)\s+/i;
  if (introPattern.test(candidate)) {
    candidate = candidate.replace(introPattern, '').trim();
    extractionMethod = 'sentence_stripped';
  } else if (!looksLikeName(candidate)) {
    extractionMethod = 'uncertain';
  }

  let parts = candidate
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuationForValidation(p))
    .filter((p) => /^[a-zA-Z'-]+$/.test(p));

  if (parts.length === 0) {
    parts = stripped
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => stripNameTokenPunctuationForValidation(p))
      .filter((p) => /^[a-zA-Z'-]+$/.test(p));
    extractionMethod = 'uncertain';
  }

  if (parts.length > 2) {
    if (extractionMethod === 'sentence_stripped') {
      parts = parts.slice(0, 1);
    } else {
      parts = [];
    }
    extractionMethod = 'uncertain';
  }

  const extractedName = parts.map(capitalizeNameCandidate).join(' ').trim();
  const triggerKey = extractedName.toLowerCase().replace(/[^a-z]/g, '');
  const isFalseNameTrigger =
    FALSE_NAME_TRIGGERS.has(triggerKey) ||
    parts.some((p) => FALSE_NAME_TRIGGERS.has(p.toLowerCase().replace(/[^a-z]/g, '')));
  return {
    extractedName,
    extractionMethod,
    isFalseNameTrigger,
  };
}

export function extractInterviewNameFromTranscript(
  messages: ReadonlyArray<{ role: string; content?: string | null }>
): string | null {
  for (let i = 0; i < messages.length - 1; i += 1) {
    const assistant = messages[i];
    const user = messages[i + 1];
    if (assistant.role !== 'assistant' || user.role !== 'user') continue;
    if (!isNamePromptInterviewMoment(assistant.content ?? '')) continue;
    const extracted = extractInterviewNameFromResponse(user.content ?? '');
    if (
      extracted.extractedName &&
      !extracted.isFalseNameTrigger &&
      isPlausibleInterviewName(extracted.extractedName)
    ) {
      return extracted.extractedName;
    }
  }
  return null;
}
