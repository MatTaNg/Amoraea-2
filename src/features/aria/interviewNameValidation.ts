/**
 * Name extraction guards for the live interview (ambient speech, plausibility, template interpolation).
 */

const AMBIENT_PHRASES = [
  'have a great time',
  'have a good time',
  'good luck',
  'god bless you',
  'bless you',
  'thank you',
  "that's all",
  'all for now',
  'see you next',
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
  'you',
  'your',
  'bless',
  'god',
  'dear',
  'that',
  'thats',
  'all',
  'for',
  'now',
  'bye',
  'cheers',
  'what',
  'which',
  'who',
  'how',
  'why',
  'when',
  'where',
  'name',
  'call',
  'use',
  'catch',
  'quite',
  'didnt',
  'got',
  'this',
  'works',
  'work',
]);

/** Whisper often mishears short first names (e.g. "Matt" → "Maths" / "Mads"). */
const COMMON_NAME_WHISPER_CORRECTIONS: Record<string, string> = {
  maths: 'Matt',
  mads: 'Matt',
  mat: 'Matt',
  maps: 'Matt',
  map: 'Matt',
  max: 'Matt',
};

const NAME_PROMPT_ECHO_WORDS = new Set([
  'what',
  'which',
  'who',
  'how',
  'why',
  'when',
  'where',
  'name',
  'call',
  'use',
  'catch',
  'quite',
  'didnt',
  'sorry',
]);

function stripNameTokenPunctuation(token: string): string {
  return token.replace(/[.!?,;:]+$/g, '').trim();
}

function normalizeNameTokenForBlocklist(token: string): string {
  return token.toLowerCase().replace(/['’]/g, '');
}

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
      !NON_NAME_WORDS.has(normalizeNameTokenForBlocklist(normalized))
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

  const lowerName = normalizeNameTokenForBlocklist(name);
  if (NON_NAME_WORDS.has(lowerName)) return false;
  if (words.some((w) => NON_NAME_WORDS.has(normalizeNameTokenForBlocklist(w)))) return false;

  if (words.length >= 2) {
    const firstNorm = normalizeNameTokenForBlocklist(words[0]!);
    if (words.every((w) => normalizeNameTokenForBlocklist(w) === firstNorm)) return false;
  }

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

export const INTERVIEW_NAME_REPEAT_REASK_LINE =
  'Please say just your first name clearly — what should I call you?';

/** User tapped mic before TTS fully cleared — likely captured speaker bleed, not their voice. */
export const INTERVIEW_NAME_EARLY_MIC_REASK_LINE =
  'Please wait until I finish speaking, then tap the mic and say your first name clearly.';

/** Short mic / VAD retry prompts — duration estimation often overshoots; must not replay on web. */
export function isInterviewRecordingRetryLine(text: string): boolean {
  const stripped = text.trim();
  if (stripped === INTERVIEW_NAME_AMBIENT_REASK_LINE) return true;
  if (stripped === INTERVIEW_NAME_REPEAT_REASK_LINE) return true;
  if (stripped === INTERVIEW_NAME_EARLY_MIC_REASK_LINE) return true;
  if (/^i didn't catch any speech on that try\b/i.test(stripped)) return true;
  return false;
}

/** Swap re-ask wording when consecutive TTS dedup would suppress audio. */
export function pickAlternateInterviewRecordingRetryLine(message: string): string | null {
  const stripped = message.trim();
  if (stripped === INTERVIEW_NAME_AMBIENT_REASK_LINE) return INTERVIEW_NAME_REPEAT_REASK_LINE;
  if (stripped === INTERVIEW_NAME_REPEAT_REASK_LINE) return INTERVIEW_NAME_AMBIENT_REASK_LINE;
  return null;
}

/** Correct common Whisper mishears when the user is giving a single-word first name. */
export function applyInterviewNameWhisperCorrection(transcription: string): string {
  const words = transcription.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 1) return transcription;
  const token = normalizeNameTokenForBlocklist(stripNameTokenPunctuation(words[0]!));
  const corrected = COMMON_NAME_WHISPER_CORRECTIONS[token];
  return corrected ?? transcription;
}

/** Single-word reply that echoes the name prompt (e.g. "What" from "what name would you like…"). */
export function isInterviewNameWhisperEcho(
  transcription: string,
  lastQuestionText: string | null | undefined,
): boolean {
  const words = transcription.trim().split(/\s+/).filter(Boolean);
  if (words.length !== 1) return false;
  const token = normalizeNameTokenForBlocklist(stripNameTokenPunctuation(words[0]!));
  if (NAME_PROMPT_ECHO_WORDS.has(token)) return true;
  const questionWords = (lastQuestionText ?? '')
    .toLowerCase()
    .split(/[^a-z']+/i)
    .filter((w) => w.length >= 3)
    .map((w) => normalizeNameTokenForBlocklist(w));
  return questionWords.includes(token);
}
