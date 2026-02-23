import * as Speech from 'expo-speech';
import type { Gender } from '@domain/models/Profile';
import type { Voice } from 'expo-speech';

/**
 * Warm, friendly TTS tuned to sound human and inviting (not robotic).
 * Slower rate = calmer, more conversational; slight pitch down = warmer tone.
 */
const WARM_RATE = 0.78;   // Slower pace (0.8–0.9) sounds much more natural in browser
const WARM_PITCH = 0.95;  // Slight drop avoids flat “robot” tone
const WARM_VOLUME = 1.0;

/** Preferred voice gender for Aria: opposite of user (female for male user, male for female user) */
export type AriaVoiceGender = 'female' | 'male';

export function getPreferredAriaVoiceGender(userGender: Gender | null): AriaVoiceGender {
  if (userGender === 'Man') return 'female';
  if (userGender === 'Woman') return 'male';
  return 'female'; // Non-binary or unknown: default to female
}

/**
 * English voice name fragments: female (warm, friendly).
 * Used on iOS (Samantha, Karen), web (Zira, Google US English), and Android.
 */
const FEMALE_VOICE_NAMES = [
  'Samantha',  // iOS / Safari
  'Karen',     // iOS
  'Victoria',  // iOS
  'Nicky',     // iOS
  'Kate',      // iOS
  'Tessa',     // iOS
  'Zira',      // Windows / Edge / Chrome (Microsoft Zira)
  'Google US English',
  'Google UK English Female',
  'Microsoft Zira',
];

/**
 * English voice name fragments: male (warm, friendly).
 * Used on iOS (Alex, Daniel), web (David), and Android.
 */
const MALE_VOICE_NAMES = [
  'Alex',   // iOS / Safari
  'Daniel', // iOS
  'Fred',   // iOS
  'Aaron',  // iOS
  'Oliver', // iOS
  'David',  // Windows / Edge / Chrome (Microsoft David)
  'Microsoft David',
  'Google UK English Male',
];

/** Android/web: identifiers or URIs often encode gender (e.g. #female_1 or "Zira") */
function identifierSuggestsGender(identifier: string, gender: AriaVoiceGender): boolean {
  const id = identifier.toLowerCase();
  if (gender === 'female') return id.includes('female') || id.includes('woman') || id.includes('zira');
  return id.includes('male') || id.includes('man') || id.includes('david');
}

function voiceNameMatchesList(voiceName: string, list: string[]): boolean {
  const n = voiceName.toLowerCase();
  return list.some((v) => n.includes(v.toLowerCase()));
}

/** On web, prefer local/system voices (localService) — they sound more natural than cloud defaults */
function isLocalVoice(v: Voice): boolean {
  return (v as { localService?: boolean }).localService === true;
}

function findVoiceIndex(voices: Voice[], target: Voice): number {
  const idx = voices.indexOf(target);
  return idx >= 0 ? idx : 0;
}

function pickBestVoice(
  voices: Voice[],
  preferredGender: AriaVoiceGender,
): { identifier: string; index: number } | undefined {
  const enVoices = voices.filter(
    (v) => v.language === 'en-US' || v.language === 'en' || v.language?.startsWith('en-'),
  );
  if (enVoices.length === 0) return undefined;

  const names = preferredGender === 'female' ? FEMALE_VOICE_NAMES : MALE_VOICE_NAMES;
  const isEnhanced = (v: Voice) => String((v as { quality?: string }).quality ?? v.quality) === 'Enhanced';
  const localEn = enVoices.filter(isLocalVoice);
  const enhanced = enVoices.filter(isEnhanced);
  const pool = localEn.length > 0 ? localEn : enhanced.length > 0 ? enhanced : enVoices;

  // 1) Name match in preferred pool
  for (const v of pool) {
    if (voiceNameMatchesList(v.name, names)) {
      return { identifier: v.identifier, index: findVoiceIndex(voices, v) };
    }
  }
  // 2) Identifier/URI gender hint
  for (const v of enVoices) {
    if (identifierSuggestsGender(v.identifier, preferredGender)) {
      return { identifier: v.identifier, index: findVoiceIndex(voices, v) };
    }
  }
  // 3) First from pool, then any English (always return index so web never gets undefined voice)
  const chosen = pool.length > 0 ? pool[0] : enVoices[0];
  return { identifier: chosen.identifier, index: findVoiceIndex(voices, chosen) };
}

export interface AriaSpeechOptions {
  voice?: string;
  /** On web, use this index so the voice is always set (avoids Chrome/Brave robotic default) */
  voiceIndex?: number;
  language: string;
  rate: number;
  pitch: number;
  volume: number;
}

/**
 * Resolves TTS options for Aria: warm, friendly voice opposite to user gender.
 * Female voice for male users, male voice for female users.
 * Works on iOS, Android, and web (npm run web): uses expo-speech and the
 * browser’s Speech Synthesis API when running in the browser.
 */
export async function getAriaVoiceOptions(userGender: Gender | null): Promise<AriaSpeechOptions> {
  const preferredGender = getPreferredAriaVoiceGender(userGender);
  let voice: string | undefined;
  let voiceIndex: number | undefined;
  try {
    const voices = await Speech.getAvailableVoicesAsync();
    const picked = pickBestVoice(voices, preferredGender);
    if (picked) {
      voice = picked.identifier;
      voiceIndex = picked.index;
    }
  } catch {
    voice = undefined;
    voiceIndex = undefined;
  }
  return {
    voice,
    voiceIndex,
    language: 'en-US',
    rate: WARM_RATE,
    pitch: WARM_PITCH,
    volume: WARM_VOLUME,
  };
}
