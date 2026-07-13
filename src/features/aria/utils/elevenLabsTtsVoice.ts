import Constants from 'expo-constants';

/** Jessica — warm, friendly, conversational (ElevenLabs). */
export const DEFAULT_ELEVENLABS_VOICE_ID = 'cgSgspJ2msm6clMCkdW9';

export const ELEVENLABS_VOICE_SETTINGS = {
  stability: 0.22,
  similarity_boost: 0.82,
  /** Lower style reduces long dramatic pauses at commas / periods within an utterance. */
  style: 0.42,
  use_speaker_boost: true,
} as const;

export function applyAmoraeaPronunciation(text: string): string {
  return text.replace(/\bamoraea\b/gi, 'Ah-mor-AY-ah');
}

export function resolveElevenLabsVoiceId(): string {
  const fromExtra = Constants.expoConfig?.extra as { elevenLabsVoiceId?: string } | undefined;
  return (
    fromExtra?.elevenLabsVoiceId ||
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ELEVENLABS_VOICE_ID) ||
    DEFAULT_ELEVENLABS_VOICE_ID
  );
}
