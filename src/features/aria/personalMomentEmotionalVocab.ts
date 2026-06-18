/**
 * Personal-moment-only emotional vocabulary (LLM-counted), distinct from full-interview
 * `language_markers` / communication_style_profiles emotional_vocab_density.
 */

import {
  moment5PersonalNarrativeHasConcreteAnchor,
  moment5ResponseIsAbstract,
} from './probeAndScoringUtils';
import {
  inferMoment4ConcretenessFromText,
  type Moment4ConcretenessLevel,
} from './moment4ConcretenessClassification';
import {
  normalizeResponseConcreteness,
  type ResponseConcretenessLevel,
} from './personalMomentConcreteness';

/** Lexicon for lightweight scenario-side density (user tokens in scenarios 1–3). Align with scorer examples. */
export const PERSONAL_MOMENT_EMOTION_LEXICON: readonly string[] = [
  'angry',
  'anger',
  'hurt',
  'hurting',
  'disappointed',
  'afraid',
  'fear',
  'fearful',
  'ashamed',
  'shame',
  'ashame',
  'proud',
  'relieved',
  'relief',
  'resentful',
  'resentment',
  'numb',
  'overwhelmed',
  'anxious',
  'anxiety',
  'sad',
  'sadness',
  'grief',
  'grieving',
  'joy',
  'joyful',
  'lonely',
  'loneliness',
  'guilty',
  'guilt',
  'embarrassed',
  'embarrassment',
  'nervous',
  'scared',
  'worried',
  'worry',
  'frustrated',
  'frustration',
  'devastated',
  'heartbroken',
  'betrayed',
  'betrayal',
  'vulnerable',
  'helpless',
  'hopeless',
  'hopeful',
  'grateful',
  'gratitude',
  'bitter',
  'bitterness',
  'jealous',
  'jealousy',
  'envious',
  'envy',
  'regret',
  'regretful',
  'remorseful',
  'remorse',
  'conflicted',
  'torn',
  'confused',
  'disgusted',
  'disgust',
  'contemptuous',
  'contempt',
  'exhausted',
  'depleted',
  'raw',
  'empty',
  'hollow',
  'peaceful',
  'calm',
  'content',
  'contented',
  'elated',
  'euphoric',
  'melancholy',
  'depressed',
  'depression',
  'triggered',
  'dread',
  'panicked',
  'panic',
  'unsafe',
  'safe',
  'comforted',
  'uncomfortable',
  'uneasy',
  'irritated',
  'irritation',
  'rage',
  'furious',
  'fury',
  'love',
  'loved',
  'loving',
  'hate',
  'hated',
  'hating',
  'miss',
  'missing',
  'longing',
  'ache',
  'aching',
  'frustrating',
  'tense',
  'upset',
  'upsetting',
  'grudge',
  'grudges',
  'angry',
  'anger',
  'rejected',
  'reject',
  'humiliated',
  'humiliate',
  'deprioritized',
  'deprioritised',
  'deprioritize',
  'deprioritise',
  'resigned',
  'resign',
  'disconnected',
  'disconnect',
  'shutdown',
  'shut',
  'withdrawn',
  'withdraw',
  'inadequate',
  'inadequacy',
  'activated',
  'activate',
  'dysregulated',
  'dysregulate',
  'flooded',
  'flood',
];

export const PERSONAL_MOMENT_EMOTIONAL_VOCAB_SCORING_INSTRUCTION = `Count the number of distinct emotional vocabulary words in the user's response — words that name, describe, or characterize internal emotional states (e.g. angry, hurt, disappointed, afraid, ashamed, proud, relieved, resentful, numb, overwhelmed, anxious). Do not count behavioral descriptions or thought descriptions. Return emotional_vocab_count as an integer and emotional_vocab_words as an array of the detected words.
Also return user_slice_word_count as the total number of words in the user's messages in this slice only (split on whitespace; count all user turns in the transcript slice). This is required to compute personal-moment emotional vocabulary density separately from the full-interview communication-style pipeline.`;

const EMOTION_SET = new Set(PERSONAL_MOMENT_EMOTION_LEXICON);

function tokenNorm(raw: string): string {
  return raw.toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, '');
}

/** Exact lexicon hit or shared stem (e.g. frustrating → frustrated family). */
export function tokenMatchesPersonalMomentEmotionLexicon(token: string): boolean {
  const t = tokenNorm(token);
  if (!t || t.length < 3) return false;
  if (EMOTION_SET.has(t)) return true;
  for (const word of PERSONAL_MOMENT_EMOTION_LEXICON) {
    if (t === word || t.startsWith(word) || word.startsWith(t)) return true;
    if (word.length >= 4 && t.length >= 4) {
      const rootLen = Math.min(5, word.length, t.length);
      const root = word.slice(0, rootLen);
      if (t.startsWith(root) || word.startsWith(t.slice(0, rootLen))) return true;
    }
  }
  return false;
}

export function scenarioEmotionalVocabDensityPercentFromTranscript(
  messages: ReadonlyArray<{ role?: string; content?: string; scenarioNumber?: number | null }>,
): number | null {
  let wordTotal = 0;
  let hitTotal = 0;
  for (const m of messages) {
    if (m.role !== 'user') continue;
    const sn = m.scenarioNumber;
    if (sn !== 1 && sn !== 2 && sn !== 3) continue;
    const tokens = (m.content ?? '')
      .toLowerCase()
      .split(/\s+/)
      .map(tokenNorm)
      .filter(Boolean);
    wordTotal += tokens.length;
    for (const t of tokens) {
      if (tokenMatchesPersonalMomentEmotionLexicon(t)) hitTotal++;
    }
  }
  if (wordTotal <= 0) return null;
  return Math.round((hitTotal / wordTotal) * 100 * 1000) / 1000;
}

function parseFiniteInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.max(0, Math.round(v));
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number.parseInt(v.trim(), 10);
    return Number.isFinite(n) ? Math.max(0, n) : null;
  }
  return null;
}

function parseStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((s) => s.trim());
}

export type PersonalMomentEmotionalVocabSliceFields = {
  emotional_vocab_count: number | null;
  emotional_vocab_words: string[];
  user_slice_word_count: number | null;
};

export function extractPersonalMomentEmotionalVocabFromSlice(
  slice: { emotional_vocab_count?: unknown; emotional_vocab_words?: unknown; user_slice_word_count?: unknown } | null | undefined,
): PersonalMomentEmotionalVocabSliceFields {
  if (!slice) {
    return { emotional_vocab_count: null, emotional_vocab_words: [], user_slice_word_count: null };
  }
  return {
    emotional_vocab_count: parseFiniteInt(slice.emotional_vocab_count),
    emotional_vocab_words: parseStringArray(slice.emotional_vocab_words),
    user_slice_word_count: parseFiniteInt(slice.user_slice_word_count),
  };
}

/**
 * Percent of emotional-vocab tokens in personal moments: (count4+count5) / (words4+words5) × 100.
 * Requires both moments to have user_slice_word_count & emotional_vocab_count from the scorer.
 */
export function computePersonalMomentEmotionalVocabDensityPercent(
  m4: PersonalMomentEmotionalVocabSliceFields,
  m5: PersonalMomentEmotionalVocabSliceFields,
): number | null {
  const c4 = m4.emotional_vocab_count;
  const c5 = m5.emotional_vocab_count;
  const w4 = m4.user_slice_word_count;
  const w5 = m5.user_slice_word_count;
  if (c4 == null || c5 == null || w4 == null || w5 == null) return null;
  const words = w4 + w5;
  if (words <= 0) return null;
  const counts = c4 + c5;
  return Math.round((counts / words) * 100 * 1000) / 1000;
}

const VOCAB_LOW_ABS_THRESHOLD = 0.3;
const VOCAB_LOW_RATIO_TO_REFERENCE = 0.4;

/**
 * Low personal-moment emotional vocabulary flag.
 *
 * - **Zero density** (no emotion-lexicon hits across scored moments with user words) is always low.
 * - **Null density** (unscorable / missing scorer fields) → not low.
 * - Below absolute minimum (0.3%) → low.
 * - When scenario (or communication-style) reference density is available and positive, also low if
 *   personal-moment density is a small fraction of that reference (&lt; 40%).
 */
export function computePersonalMomentEmotionalVocabLow(args: {
  personalMomentDensityPercent: number | null;
  scenarioEmotionalVocabDensityPercent: number | null;
  communicationStyleEmotionalVocabDensityPercent: number | null;
}): boolean {
  const personalMomentVocabDensity = args.personalMomentDensityPercent;
  const scenarioVocabDensity = args.scenarioEmotionalVocabDensityPercent;
  const styleVocabDensity = args.communicationStyleEmotionalVocabDensityPercent;

  if (personalMomentVocabDensity === 0 || Object.is(personalMomentVocabDensity, -0)) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      console.log('[VocabFlag] zero density — flagging as low');
    }
    return true;
  }
  if (personalMomentVocabDensity == null) return false;
  if (personalMomentVocabDensity < VOCAB_LOW_ABS_THRESHOLD) return true;

  if (scenarioVocabDensity != null && Number.isFinite(scenarioVocabDensity) && scenarioVocabDensity > 0) {
    const ratio = personalMomentVocabDensity / scenarioVocabDensity;
    if (ratio < VOCAB_LOW_RATIO_TO_REFERENCE) return true;
  }
  if (styleVocabDensity != null && Number.isFinite(styleVocabDensity) && styleVocabDensity > 0) {
    const ratio = personalMomentVocabDensity / styleVocabDensity;
    if (ratio < VOCAB_LOW_RATIO_TO_REFERENCE) return true;
  }
  return false;
}

export type PersonalMomentTranscriptTurn = {
  role?: string;
  content?: string;
  interviewMoment?: number;
};

/** Lexicon hits + word count from concatenated user text (scoring slice fallback). */
export function personalMomentLexiconStatsFromUserText(userText: string): PersonalMomentEmotionalVocabSliceFields {
  const tokens: string[] = [];
  const hitWords = new Set<string>();
  for (const tok of (userText ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map(tokenNorm)
    .filter(Boolean)) {
    tokens.push(tok);
    if (tokenMatchesPersonalMomentEmotionLexicon(tok)) {
      hitWords.add(tok);
    }
  }
  const user_slice_word_count = tokens.length > 0 ? tokens.length : null;
  const emotional_vocab_words = [...hitWords].sort();
  const emotional_vocab_count =
    user_slice_word_count != null ? emotional_vocab_words.length : null;
  return { emotional_vocab_count, emotional_vocab_words, user_slice_word_count };
}

/** Lexicon hits + word count for one personal moment from stored transcript (legacy rows without scorer fields). */
export function personalMomentLexiconStatsFromInterviewMoment(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
): PersonalMomentEmotionalVocabSliceFields {
  const tx = Array.isArray(transcript) ? transcript : [];
  const tokens: string[] = [];
  const hitWords = new Set<string>();
  for (const t of tx) {
    if (t.role !== 'user' || t.interviewMoment !== moment) continue;
    const turnTokens = (t.content ?? '')
      .toLowerCase()
      .split(/\s+/)
      .map(tokenNorm)
      .filter(Boolean);
    for (const tok of turnTokens) {
      tokens.push(tok);
      if (tokenMatchesPersonalMomentEmotionLexicon(tok)) {
        hitWords.add(tok);
      }
    }
  }
  const user_slice_word_count = tokens.length > 0 ? tokens.length : null;
  const emotional_vocab_words = [...hitWords].sort();
  const emotional_vocab_count =
    user_slice_word_count != null ? emotional_vocab_words.length : null;
  return { emotional_vocab_count, emotional_vocab_words, user_slice_word_count };
}

export function combineUserTextForPersonalMoment(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): string {
  const parts: string[] = [];
  if (Array.isArray(transcript)) {
    for (const t of transcript) {
      if (t.role !== 'user' || t.interviewMoment !== moment) continue;
      const c = (t.content ?? '').trim();
      if (c) parts.push(c);
    }
  }
  if (parts.length > 0) return parts.join(' ');
  return (scoringSliceUserText ?? '').trim();
}

/** Heuristic concreteness from transcript when the scorer JSON omits `response_concreteness`. */
export function inferResponseConcretenessFromTranscript(
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): ResponseConcretenessLevel | Moment4ConcretenessLevel | null {
  const combined = combineUserTextForPersonalMoment(transcript, moment, scoringSliceUserText);
  if (!combined) return null;

  if (moment === 4) {
    return inferMoment4ConcretenessFromText(combined);
  }

  const wc = combined.split(/\s+/).filter(Boolean).length;
  if (wc === 0) return null;
  const lower = combined.toLowerCase();

  if (moment5ResponseIsAbstract(combined) && wc < 50) return 'low';
  if (moment5PersonalNarrativeHasConcreteAnchor(combined)) {
    const hasEmotion = /\b(felt|feel|angry|hurt|frustrated|upset|scared|ashamed|tense|anxious|resentful)\b/i.test(
      lower,
    );
    if (wc >= 60 && hasEmotion) return 'high';
    return 'moderate';
  }
  if (wc >= 80) return 'moderate';
  if (wc >= 25) return 'low';
  return 'low';
}

/** Fill legacy `specificity`, word counts, lexicon, and concreteness before depth aggregation. */
export function enrichPersonalMomentSliceForDepth(
  slice: Record<string, unknown> | null | undefined,
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
  moment: 4 | 5,
  scoringSliceUserText?: string,
): Record<string, unknown> | null {
  const fromTx = personalMomentLexiconStatsFromInterviewMoment(transcript, moment);
  const fromSliceText = scoringSliceUserText?.trim()
    ? personalMomentLexiconStatsFromUserText(scoringSliceUserText)
    : null;
  const lexicon =
    fromTx.user_slice_word_count != null
      ? fromTx
      : fromSliceText?.user_slice_word_count != null
        ? fromSliceText
        : fromTx;
  const base =
    slice != null && typeof slice === 'object' && !Array.isArray(slice) ? { ...slice } : {};
  if (base.response_concreteness == null && typeof base.specificity === 'string') {
    base.response_concreteness = base.specificity;
  }
  if (base.user_slice_word_count == null && lexicon.user_slice_word_count != null) {
    base.user_slice_word_count = lexicon.user_slice_word_count;
  }
  if (base.emotional_vocab_count == null && lexicon.emotional_vocab_count != null) {
    base.emotional_vocab_count = lexicon.emotional_vocab_count;
    base.emotional_vocab_words = lexicon.emotional_vocab_words;
  }
  if (base.response_concreteness == null) {
    const inferred = inferResponseConcretenessFromTranscript(
      transcript,
      moment,
      scoringSliceUserText,
    );
    if (inferred != null) base.response_concreteness = inferred;
  }
  if (Object.keys(base).length === 0) return null;
  return base;
}

export function depthEnrichedMarkerSlices<T extends {
  response_concreteness?: string | null;
  user_slice_word_count?: number | null;
  emotional_vocab_count?: number | null;
  emotional_vocab_words?: string[] | null;
} | null | undefined>(
  slices: Array<T>,
  transcript: readonly PersonalMomentTranscriptTurn[] | null | undefined,
): Array<T> {
  const out = [...slices] as Array<T>;
  for (const moment of [4, 5] as const) {
    const i = moment - 1;
    const enriched = enrichPersonalMomentSliceForDepth(
      out[i] as Record<string, unknown> | null | undefined,
      transcript,
      moment,
    );
    if (!enriched) continue;
    out[i] = { ...(out[i] ?? {}), ...enriched } as T;
  }
  return out;
}

export type PersonalMomentEmotionalVocabAggregate = {
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean;
};

export function aggregatePersonalMomentEmotionalVocab(
  slice4: unknown,
  slice5: unknown,
  opts: {
    scenarioEmotionalVocabDensityPercent?: number | null;
    communicationStyleEmotionalVocabDensityPercent?: number | null;
  },
): PersonalMomentEmotionalVocabAggregate {
  const m4 = extractPersonalMomentEmotionalVocabFromSlice(
    slice4 as { emotional_vocab_count?: unknown; emotional_vocab_words?: unknown; user_slice_word_count?: unknown } | null,
  );
  const m5 = extractPersonalMomentEmotionalVocabFromSlice(
    slice5 as { emotional_vocab_count?: unknown; emotional_vocab_words?: unknown; user_slice_word_count?: unknown } | null,
  );
  let personal_moment_emotional_vocab_density = computePersonalMomentEmotionalVocabDensityPercent(m4, m5);
  if (
    personal_moment_emotional_vocab_density == null &&
    m4.emotional_vocab_count === 0 &&
    m5.emotional_vocab_count === 0 &&
    m4.user_slice_word_count != null &&
    m5.user_slice_word_count != null &&
    m4.user_slice_word_count + m5.user_slice_word_count > 0
  ) {
    personal_moment_emotional_vocab_density = 0;
  }
  const personal_moment_emotional_vocab_low = computePersonalMomentEmotionalVocabLow({
    personalMomentDensityPercent: personal_moment_emotional_vocab_density,
    scenarioEmotionalVocabDensityPercent: opts.scenarioEmotionalVocabDensityPercent ?? null,
    communicationStyleEmotionalVocabDensityPercent: opts.communicationStyleEmotionalVocabDensityPercent ?? null,
  });
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[VocabFlag] density:', personal_moment_emotional_vocab_density, 'threshold:', VOCAB_LOW_ABS_THRESHOLD, 'flag:', personal_moment_emotional_vocab_low);
  }
  return { personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low };
}
