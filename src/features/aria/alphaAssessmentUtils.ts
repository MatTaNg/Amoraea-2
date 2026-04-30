/**
 * Alpha-only: Layer 1 & 2 assessment helpers for interview_attempts.
 * Remove before production.
 */

import { INTERVIEW_MARKER_IDS, type InterviewMarkerId } from '@features/aria/interviewMarkers';
import { combinedContemptFromScenarioPillarScores } from '@features/aria/aggregateMarkerScoresFromSlices';
import { isNotAssessedDueToTechnicalInterruption } from '@features/aria/probeAndScoringUtils';

export const CONSTRUCT_IDS = [...INTERVIEW_MARKER_IDS] as InterviewMarkerId[];
export const CONSTRUCT_NAMES = CONSTRUCT_IDS;

export type ScenarioScoresMap = Record<number, { pillarScores: Record<string, number | null> } | undefined>;

type ScenarioPillarSnapshot = Record<string, number | null | undefined> | undefined;

function effectiveConstructValueForConsistency(
  name: (typeof CONSTRUCT_NAMES)[number],
  pillarScores: ScenarioPillarSnapshot,
  keyEvidence: Record<string, string> | null | undefined
): number | null {
  if (name === 'contempt') {
    return combinedContemptFromScenarioPillarScores(pillarScores ?? null, keyEvidence ?? null);
  }
  const ev = keyEvidence?.[name];
  if (isNotAssessedDueToTechnicalInterruption(ev)) return null;
  const raw = pillarScores?.[name];
  if (raw == null || raw === undefined) return null;
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  return raw;
}

export function calculateScoreConsistency(
  s1: ScenarioPillarSnapshot,
  s2: ScenarioPillarSnapshot,
  s3: ScenarioPillarSnapshot,
  keyEvidence1?: Record<string, string> | null,
  keyEvidence2?: Record<string, string> | null,
  keyEvidence3?: Record<string, string> | null
): Record<
  string,
  { s1: number | null; s2: number | null; s3: number | null; mean: number | null; std_dev: number | null }
> {
  const result: Record<
    string,
    { s1: number | null; s2: number | null; s3: number | null; mean: number | null; std_dev: number | null }
  > = {};
  for (const name of CONSTRUCT_NAMES) {
    const v1 = effectiveConstructValueForConsistency(name, s1, keyEvidence1);
    const v2 = effectiveConstructValueForConsistency(name, s2, keyEvidence2);
    const v3 = effectiveConstructValueForConsistency(name, s3, keyEvidence3);
    const vals = [v1, v2, v3].filter((v): v is number => v !== null && v !== undefined);
    const mean =
      vals.length > 0 ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
    const variance =
      vals.length > 0 && mean != null
        ? vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length
        : null;
    const stdDev = variance != null && variance >= 0 ? Math.round(Math.sqrt(variance) * 10) / 10 : null;
    result[name] = {
      s1: v1 ?? null,
      s2: v2 ?? null,
      s3: v3 ?? null,
      mean,
      std_dev: stdDev,
    };
  }
  return result;
}

export function calculateConstructAsymmetry(
  pillarScores: Record<string, number | null | undefined>,
  excludedMarkerIds: readonly string[] = [],
  options?: { contributorCounts?: Record<string, number> | null }
): {
  user_mean: number;
  strongest_construct: string;
  weakest_construct: string;
  gap: number;
  profile_type: string;
  low_data_warning: Record<string, boolean>;
} {
  const excluded = new Set(excludedMarkerIds);
  const contributorCounts = options?.contributorCounts;
  const hasContributorInfo = contributorCounts != null;

  const maxContrib = hasContributorInfo
    ? Math.max(0, ...CONSTRUCT_NAMES.map((n) => contributorCounts![n] ?? 0))
    : 0;

  const low_data_warning: Record<string, boolean> = Object.fromEntries(
    CONSTRUCT_NAMES.map((n) => {
      if (!hasContributorInfo) return [n, false] as [string, boolean];
      const c = contributorCounts![n];
      if (c === undefined) return [n, false] as [string, boolean];
      return [n, c === 1 && maxContrib >= 2] as [string, boolean];
    })
  ) as Record<string, boolean>;

  const eligible = (name: string): boolean => {
    if (excluded.has(name)) return false;
    if (!hasContributorInfo) return true;
    const c = contributorCounts![name];
    if (c === undefined) return true;
    if (c === 0) return false;
    if (c >= 2) return true;
    return maxContrib <= 1;
  };

  const entries = CONSTRUCT_NAMES.map((name) => [name, pillarScores[name]] as const)
    .filter(
      ([name, v]) =>
        eligible(name) && typeof v === 'number' && Number.isFinite(v) && (v as number) > 0
    )
    .map(([name, v]) => [name, v as number] as [string, number]);

  if (entries.length < 2) {
    return {
      user_mean: 0,
      strongest_construct: '',
      weakest_construct: '',
      gap: 0,
      profile_type: '',
      low_data_warning,
    };
  }

  const values = entries.map(([, val]) => val);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
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
    low_data_warning,
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
    "i'd own",
    "i'll own",
    'i own up',
    'i own it',
    'i was wrong',
    'i am wrong',
    "i've been wrong",
    'my fault',
    'my mistake',
    'my bad',
    'i should have',
    "i should've",
    'i could have',
    "i could've",
    'i messed up',
    'i screwed up',
    'i blew it',
    "that's on me",
    'this is on me',
    'i dropped the ball',
    'i let them down',
    'i let him down',
    'i let her down',
    'i let you down',
    'i overreacted',
    'i was unfair',
    "i wasn't fair",
    "i hadn't been paying attention",
    'i missed what you actually needed',
    'i cut them off without saying why',
    'i cut her off without saying why',
    'i cut him off without saying why',
  ];
  const accountabilityRegexes = [
    /\bi\s+would\s+own\b/i,
    /\bi\s+own\s+that\b/i,
    /\b(?:that|this)\s+was\s+my\s+fault\b/i,
    /\bi\s+(?:take|taking|took)\s+(?:full\s+)?responsibility\b/i,
    /\bi\s+accept\s+(?:full\s+)?responsibility\b/i,
    /\bi\s+accept\s+that\s+i\b/i,
    /\bi\s+acknowledge\s+that\s+i\b/i,
    /\bi\s+admit\s+(?:that\s+)?i\b/i,
    /\bi\s+was\s+partly\s+(?:to\s+blame|at\s+fault|responsible)\b/i,
    /\bi\s+had\s+a\s+hand\s+in\b/i,
    /\bi\s+had\s+it\s+wrong\b/i,
    /\bi\s+missed\s+(?:what|how)\b/i,
    /\bi\s+missed\s+it\b/i,
    /\bi\s+missed\s+that\s+(?:you|they|he|she|we)\b/i,
    /\bi\s+missed\s+the\s+(?:cue|signal|point|mark)\b/i,
    /\bi\s+missed\s+the\s+fact\s+that\b/i,
    /\bi\s+failed\s+(?:to|him|her|them)\b/i,
    /\bi\s+fell\s+short\b/i,
    /\bi\s+was\s+partly (protecting|defending) myself\b/i,
    /\bi (had not|hadn't|was not|wasn't) (really )?(paying attention|showing up)\b/i,
    /\bi missed (what|that|the fact that) (you|they|he|she) (needed|were asking|was asking)\b/i,
    /\bi contributed(?:\s+(?:to|here|there|in this))?\b/i,
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
    'frustrated',
    'hurt',
    'hurting',
    'angry',
    'sad',
    'confused',
    'scared',
    'anxious',
    'lonely',
    'disconnected',
    'overwhelmed',
    'flooded',
    'grateful',
    'happy',
    'excited',
    'afraid',
    'ashamed',
    'guilty',
    'proud',
    'embarrassed',
    'nervous',
    'disappointed',
    'devastated',
    'tender',
    'vulnerable',
    'healing',
    'resentment',
    'resentful',
    'contempt',
    'grief',
    'shame',
    'warmth',
    'dread',
    'longing',
    'raw',
    'exhausted',
    'invisible',
    'heartbroken',
    'numb',
    'aching',
    'ache',
    'hopeless',
    'hopeful',
    'bitter',
    'tears',
    'crying',
    'pain',
    'joy',
    'sinking',
    'tightness',
    'weight',
    'heavy',
  ];

  const fullText = userMessages.map((m) => (m.content ?? '').toLowerCase()).join(' ');
  const words = fullText.split(/\s+/).filter(Boolean);

  const iCount = words.filter((w) => w === 'i' || w === "i'm" || w === "i've").length;
  const weCount = words.filter((w) => w === 'we' || w === "we've" || w === "we're").length;
  const theyCount = words.filter((w) => w === 'they' || w === "they're").length;
  const totalPronouns = iCount + weCount + theyCount || 1;

  const countPhrasesInText = (text: string, phrases: string[]) =>
    phrases.reduce((acc, p) => acc + (text.split(p).length - 1), 0);
  /** Count every match (same as phrase split counting), not one hit per pattern. */
  const countRegexMatchesInText = (text: string, patterns: readonly RegExp[]) =>
    patterns.reduce((acc, re) => {
      const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
      const globalRe = new RegExp(re.source, flags);
      const matches = text.match(globalRe);
      return acc + (matches?.length ?? 0);
    }, 0);
  const accountabilityCountForText = (text: string) => {
    const t = text.toLowerCase().replace(/\u2019/g, "'");
    return countPhrasesInText(t, accountabilityPhrases) + countRegexMatchesInText(t, accountabilityRegexes);
  };

  // Distinct emotion lexicon hits across all user turns (full interview), not per-scenario slices.
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
