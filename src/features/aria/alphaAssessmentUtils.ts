/**
 * Alpha-only: Layer 1 & 2 assessment helpers for interview_attempts.
 * Remove before production.
 */

export const CONSTRUCT_IDS = ['1', '3', '5', '6'] as const;
export const CONSTRUCT_NAMES = ['conflict_repair', 'accountability', 'responsiveness', 'desire_limits'] as const;
const PILLAR_TO_CONSTRUCT: Record<string, (typeof CONSTRUCT_NAMES)[number]> = {
  '1': 'conflict_repair',
  '3': 'accountability',
  '5': 'responsiveness',
  '6': 'desire_limits',
};

export type ScenarioScoresMap = Record<number, { pillarScores: Record<string, number> } | undefined>;

export function calculateScoreConsistency(
  s1: Record<string, number> | undefined,
  s2: Record<string, number> | undefined,
  s3: Record<string, number> | undefined
): Record<string, { s1: number | null; s2: number | null; s3: number | null; mean: number; std_dev: number }> {
  const result: Record<string, { s1: number | null; s2: number | null; s3: number | null; mean: number; std_dev: number }> = {};
  for (const name of CONSTRUCT_NAMES) {
    const pillarId = CONSTRUCT_IDS[CONSTRUCT_NAMES.indexOf(name)];
    const v1 = s1?.[pillarId] ?? null;
    const v2 = s2?.[pillarId] ?? null;
    const v3 = s3?.[pillarId] ?? null;
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
  const entries = CONSTRUCT_NAMES.map((name) => {
    const id = CONSTRUCT_IDS[CONSTRUCT_NAMES.indexOf(name)];
    return [name, pillarScores[id] ?? 0] as [string, number];
  });
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

  const countPhrases = (phrases: string[]) =>
    phrases.reduce((acc, p) => acc + (fullText.split(p).length - 1), 0);

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
      qualifier_count: countPhrases(qualifierPhrases.slice(0, 3)),
      accountability_phrases: accountabilityPhrases.filter((p) => sText.includes(p)).length,
    };
  }

  return {
    first_person_ratio: Math.round((iCount / totalPronouns) * 100) / 100,
    qualifier_count: countPhrases(qualifierPhrases),
    emotional_vocab_count: emotionalVocabCount,
    accountability_phrases: countPhrases(accountabilityPhrases),
    deflection_phrases: countPhrases(deflectionPhrases),
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
