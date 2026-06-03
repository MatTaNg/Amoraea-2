/**
 * Name extraction guards for the live interview (ambient speech, plausibility, template interpolation).
 */

const AMBIENT_PHRASES = [
  'have a great time',
  'have a good time',
  'good luck',
  'sounds good',
  'okay',
  'let me',
  'just a second',
  'one moment',
  'hold on',
  'wait',
  'sorry',
  'excuse me',
] as const;

const NON_NAME_WORDS = new Set([
  'time',
  'great',
  'good',
  'okay',
  'yes',
  'yeah',
  'sure',
  'ready',
  'hello',
  'hi',
  'hey',
  'thanks',
  'thank',
  'please',
  'sorry',
  'wait',
  'hold',
  'just',
  'one',
  'moment',
  'the',
  'a',
  'an',
  'is',
  'it',
  'in',
  'of',
  'to',
  'and',
  'or',
  'but',
  'have',
  'has',
  'had',
  'say',
  'let',
]);

/** Whisper often transcribes pre-interview ambient chatter on the name question. */
export function isLikelyAmbientSpeech(transcription: string, _questionContext?: string): boolean {
  const text = transcription.trim().toLowerCase();
  if (!text) return true;

  const wordCount = text.split(/\s+/).filter((w) => w.length > 0).length;
  if (wordCount > 4) return true;

  for (const phrase of AMBIENT_PHRASES) {
    if (text.includes(phrase)) return true;
  }

  const words = transcription.trim().split(/\s+/);
  const couldBeAName = words.some((word) => {
    const normalized = word.replace(/[.!?,;:]+$/g, '').trim();
    return (
      normalized.length >= 2 &&
      normalized.length <= 20 &&
      /^[A-Za-z'-]+$/.test(normalized) &&
      !NON_NAME_WORDS.has(normalized.toLowerCase())
    );
  });

  return !couldBeAName;
}

export function isPlausibleInterviewName(extracted: string | null | undefined): boolean {
  if (!extracted) return false;

  const name = extracted.trim();
  if (name.length > 30 || name.length < 2) return false;
  if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(name)) return false;

  const words = name.split(/\s+/).filter((w) => w.length > 0);
  if (words.length > 3) return false;

  const lowerName = name.toLowerCase();
  if (NON_NAME_WORDS.has(lowerName)) return false;
  if (words.length === 1 && NON_NAME_WORDS.has(words[0]!.toLowerCase())) return false;

  return true;
}

/** Sanitize + plausibility — use before persisting or speaking a participant first name. */
export function resolvePlausibleInterviewFirstName(raw: string | null | undefined): string | null {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) return null;
  const firstToken = trimmed.split(/\s+/).filter(Boolean)[0] ?? '';
  const candidate = firstToken.replace(/[.!?,;:]+$/g, '').trim();
  return isPlausibleInterviewName(candidate) ? candidate : null;
}

export function formatWithName(template: string, name: string | null): string {
  if (!name || !isPlausibleInterviewName(name)) {
    return template.replace(/,?\s*\{name\}/gi, '').replace(/,?\s*\[name\]/gi, '');
  }
  return template.replace(/\{name\}/gi, name).replace(/\[name\]/gi, name);
}

export const INTERVIEW_NAME_AMBIENT_REASK_LINE =
  "Sorry, I didn't quite catch that — what name would you like me to use?";
