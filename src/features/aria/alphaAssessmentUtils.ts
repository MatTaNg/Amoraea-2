/**
 * Alpha-only: Layer 1 & 2 assessment helpers for interview_attempts.
 * Remove before production.
 */

import { INTERVIEW_MARKER_IDS, type InterviewMarkerId } from '@features/aria/interviewMarkers';

export const CONSTRUCT_IDS = [...INTERVIEW_MARKER_IDS] as InterviewMarkerId[];
export const CONSTRUCT_NAMES = CONSTRUCT_IDS;

export type ScenarioScoresMap = Record<number, { pillarScores: Record<string, number> } | undefined>;

export function calculateScoreConsistency(
  s1: Record<string, number> | undefined,
  s2: Record<string, number> | undefined,
  s3: Record<string, number> | undefined
): Record<string, { s1: number | null; s2: number | null; s3: number | null; mean: number; std_dev: number }> {
  const result: Record<string, { s1: number | null; s2: number | null; s3: number | null; mean: number; std_dev: number }> = {};
  for (const name of CONSTRUCT_NAMES) {
    const v1 = s1?.[name] ?? null;
    const v2 = s2?.[name] ?? null;
    const v3 = s3?.[name] ?? null;
    const vals = [v1, v2, v3].filter((v): v is number => v !== null && v !== undefined);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const variance = vals.length ? vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length : 0;
    const stdDev = Math.sqrt(variance);
    result[name] = {
      s1: v1 ?? null,
      s2: v2 ?? null,
      s3: v3 ?? null,
      mean: Math.round(mean * 10) / 10,
      std_dev: Math.round(stdDev * 10) / 10,
    };
  }
  return result;
}

export function calculateConstructAsymmetry(pillarScores: Record<string, number>): {
  user_mean: number;
  strongest_construct: string;
  weakest_construct: string;
  gap: number;
  profile_type: string;
} {
  const entries = CONSTRUCT_NAMES.map((name) => [name, pillarScores[name] ?? 0] as [string, number]);
  const values = entries.map(([, v]) => v);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const strongest = entries.reduce((a, b) => (a[1] > b[1] ? a : b));
  const weakest = entries.reduce((a, b) => (a[1] < b[1] ? a : b));
  const gap = strongest[1] - weakest[1];
  const profileType =
    gap > 3
      ? `high_${strongest[0]}_low_${weakest[0]}`
      : gap > 1.5
        ? `moderate_${strongest[0]}_lean`
        : 'balanced';
  return {
    user_mean: Math.round(mean * 10) / 10,
    strongest_construct: strongest[0],
    weakest_construct: weakest[0],
    gap: Math.round(gap * 10) / 10,
    profile_type: profileType,
  };
}

export interface ScenarioBoundaries {
  [k: number]: { start: number; end: number };
}

export function analyzeLanguageMarkers(
  messages: Array<{ role: string; content?: string }>,
  scenarioBoundaries: ScenarioBoundaries
): {
  first_person_ratio: number;
  qualifier_count: number;
  emotional_vocab_count: number;
  accountability_phrases: number;
  deflection_phrases: number;
  per_scenario: Record<number, { word_count: number; qualifier_count: number; accountability_phrases: number }>;
} {
  const userMessages = messages.filter(
    (m) => m.role === 'user' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
  );
  const qualifierPhrases = [
    'kind of', 'sort of', 'i guess', 'maybe', 'i think',
    'probably', "i don't know", 'i suppose', 'like,',
  ];
  const accountabilityPhrases = [
    'my fault', 'i should have', 'i was wrong', 'i messed up',
    'i take responsibility', 'i could have', "that's on me",
    'i was partly protecting myself',
    "i hadn't been paying attention",
    'i missed what you actually needed',
    'i can see i contributed',
    'i contributed',
    'i cut them off without saying why',
    'i cut her off without saying why',
    'i cut him off without saying why',
  ];
  const accountabilityRegexes = [
    /\bi was partly (protecting|defending) myself\b/i,
    /\bi (had not|hadn't|was not|wasn't) (really )?(paying attention|showing up)\b/i,
    /\bi missed (what|that|the fact that) (you|they|he|she) (needed|were asking|was asking)\b/i,
    /\bi can see (that )?i contributed\b/i,
    /\bi contributed (to|here|there|in this)\b/i,
    /\bi cut (them|her|him) off without (saying|explaining) why\b/i,
    /\bi (withdrew|shut down|pulled away|avoided)\b/i,
    /\bmy role in (this|it|the conflict|the breakdown)\b/i,
    /\bi made (it|things) worse\b/i,
    /\bi escalated (it|things|the conflict)\b/i,
    /\bi own (my|that) part\b/i,
    /\bi should have (listened|asked|paused|checked in)\b/i,
  ];
  const deflectionPhrases = [
    'they always', 'they never', "it's just that", 'but they',
    'because they', "if they hadn't",
  ];
  const emotionWords = [
    'frustrated', 'hurt', 'angry', 'sad', 'confused', 'scared',
    'anxious', 'lonely', 'disconnected', 'overwhelmed', 'grateful',
    'happy', 'excited', 'afraid', 'ashamed', 'guilty', 'proud',
    'embarrassed', 'nervous', 'disappointed',
  ];

  const fullText = userMessages.map((m) => (m.content ?? '').toLowerCase()).join(' ');
  const words = fullText.split(/\s+/).filter(Boolean);

  const iCount = words.filter((w) => w === 'i' || w === "i'm" || w === "i've").length;
  const weCount = words.filter((w) => w === 'we' || w === "we've" || w === "we're").length;
  const theyCount = words.filter((w) => w === 'they' || w === "they're").length;
  const totalPronouns = iCount + weCount + theyCount || 1;

  const countPhrasesInText = (text: string, phrases: string[]) =>
    phrases.reduce((acc, p) => acc + (text.split(p).length - 1), 0);
  const countRegexesInText = (text: string, patterns: RegExp[]) =>
    patterns.reduce((acc, re) => acc + (re.test(text) ? 1 : 0), 0);
  const accountabilityCountForText = (text: string) =>
    countPhrasesInText(text, accountabilityPhrases) + countRegexesInText(text, accountabilityRegexes);

  const emotionalVocabCount = [...new Set(emotionWords.filter((w) => fullText.includes(w)))].length;

  const perScenario: Record<number, { word_count: number; qualifier_count: number; accountability_phrases: number }> = {};
  for (const s of [1, 2, 3]) {
    const bounds = scenarioBoundaries[s];
    if (!bounds) {
      perScenario[s] = { word_count: 0, qualifier_count: 0, accountability_phrases: 0 };
      continue;
    }
    const slice = userMessages.slice(bounds.start, bounds.end);
    const sText = slice.map((m) => (m.content ?? '').toLowerCase()).join(' ');
    perScenario[s] = {
      word_count: sText.split(/\s+/).filter(Boolean).length,
      qualifier_count: countPhrasesInText(sText, qualifierPhrases.slice(0, 3)),
      accountability_phrases: accountabilityCountForText(sText),
    };
  }

  return {
    first_person_ratio: Math.round((iCount / totalPronouns) * 100) / 100,
    qualifier_count: countPhrasesInText(fullText, qualifierPhrases),
    emotional_vocab_count: emotionalVocabCount,
    accountability_phrases: accountabilityCountForText(fullText),
    deflection_phrases: countPhrasesInText(fullText, deflectionPhrases),
    per_scenario: perScenario,
  };
}

/** Build scenario boundaries: for each scenario, start/end index in userMessages (0-based). */
export function buildScenarioBoundaries(
  messages: Array<{ role: string; content?: string }>,
  _scenariosCompleted: number[]
): ScenarioBoundaries {
  const userMessages = messages.filter(
    (m) => m.role === 'user' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack
  );
  const n = userMessages.length;
  const third = Math.max(1, Math.floor(n / 3));
  return {
    1: { start: 0, end: third },
    2: { start: third, end: third * 2 },
    3: { start: third * 2, end: n },
  };
}
