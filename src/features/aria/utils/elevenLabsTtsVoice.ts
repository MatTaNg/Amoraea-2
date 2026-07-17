import Constants from 'expo-constants';
import { normalizeInterviewTypography } from '@features/aria/interviewTypography';

/** Jessica — warm, friendly, conversational (ElevenLabs). */
export const DEFAULT_ELEVENLABS_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';

export const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.22,
  similarity_boost: 0.82,
  /** Lower style reduces long dramatic pauses at commas / periods within an utterance. */
  style: 0.42,
  use_speaker_boost: true,
} as const;

/**
 * Strip dialogue quote marks so TTS does not say “apostrophe” / “quote”.
 * Keeps contraction and possessive apostrophes (that's, don't, Daniel's).
 */
export function sanitizeQuoteMarksForSpeech(text: string): string {
  let t = normalizeInterviewTypography(text ?? '');
  const protectedParts: string[] = [];
  const protect = (chunk: string): string => {
    const i = protectedParts.length;
    protectedParts.push(chunk);
    return `\u0000P${i}\u0000`;
  };
  // letter'letter contractions and possessives (that's, don't, Daniel's)
  t = t.replace(/([A-Za-z])'([A-Za-z])/g, (_m, a: string, b: string) => protect(`${a}'${b}`));
  // Remaining ASCII ' / " are quotation delimiters — drop for speech.
  t = t.replace(/['"]/g, '');
  t = t.replace(/\u0000P(\d+)\u0000/g, (_m, i: string) => protectedParts[Number(i)] ?? '');
  return t;
}

export function applyAmoraeaPronunciation(text: string): string {
  return sanitizeQuoteMarksForSpeech(text).replace(/\bamoraea\b/gi, 'Ah-mor-AY-ah');
}

/**
 * Device TTS (expo-speech) reads `-` as “hyphen/minus”. Prefer spaced syllables.
 */
export function applyAmoraeaPronunciationForDeviceSpeech(text: string): string {
  return sanitizeQuoteMarksForSpeech(text)
    .replace(/\bAh-mor-AY-ah\b/g, 'Ah mor AY ah')
    .replace(/\bamoraea\b/gi, 'Ah mor AY ah');
}

export function resolveElevenLabsVoiceId(): string {
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  return (
    fromExtra?.elevenLabsVoiceId ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID) ||
    DEFAULT_ELEVENLABS_VOICE_ID
  );
}
