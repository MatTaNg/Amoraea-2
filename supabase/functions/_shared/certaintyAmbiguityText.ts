/**
 * Text-axis `certainty_ambiguity_score` for user interview corpus (user turns joined).
 *
 * DIRECTION (matches `describeCertaintyAmbiguityAxis` in styleTranslations):
 *   **Higher numeric value → more hedging / openness to ambiguity / epistemic humility.**
 *   **Lower → more closure / decisive / definitive wording.**
 * This is NOT a "certainty index" (high ≠ maximum certainty); the column name pairs both poles.
 *
 * **Production path:** `supabase/functions/analyze-interview-text/index.ts` imports this module.
 * Changes here only affect stored profiles after **redeploying** that Edge function (and re-running
 * analysis / upsert). Client bundles do not execute this file.
 */

function countPhraseHits(text: string, phrases: string[]): number {
  return phrases.reduce((acc, phrase) => acc + Math.max(0, text.split(phrase).length - 1), 0);
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

/** Hedging around claims + first-person uncertainty about one's own patterns (not only "maybe/possibly"). */
export const CERTAINTY_AMBIGUITY_QUALIFIER_PHRASES: string[] = [
  'maybe',
  'perhaps',
  'possibly',
  'i think',
  'i guess',
  'sort of',
  'kind of',
  'not sure',
  'might',
  'could be',
  'it depends',
  'both things',
  'at the same time',
  'complicated',
  'nuanced',
  'complex',
  // Personal pattern / self-knowledge uncertainty (often missed by generic hedging lists)
  'i tend to',
  'i tend not to',
  'i often find myself',
  'i find it hard',
  'i find it difficult',
  "i'm working on",
  'im working on',
  'working on learning',
  'working on figuring',
  'still working on',
  'still trying to',
  'still figuring',
  'trying to figure',
  'trying to learn',
  'hard to walk away',
  'hard to know',
  'hard to tell',
  'probably should',
  'probably would',
  'probably could',
  'not sure if i',
  'not sure how i',
  'unsure how',
  'unsure if',
  'versus when i',
  "versus when i'm",
  'versus when im',
  'afraid of conflict',
  'afraid to',
  "i'm afraid",
  'im afraid',
  'just afraid of',
  'genuinely irrecoverable versus',
  'could be wrong',
  'i could be wrong',
  "don't fully understand",
  "don't totally know",
  'still learning',
  'learning to tell',
  // Additional first-person pattern / self-knowledge hedges (interview speech)
  'i struggle',
  'i struggle with',
  'struggle to',
  "i've noticed i",
  'ive noticed i',
  'my tendency',
  'a tendency',
  'pattern for me',
  "i'm not great at",
  'im not great at',
  'not great at',
  'i fall into',
  'i default to',
  "i'm trying to be",
  'im trying to be',
  "i've been trying",
  'ive been trying',
  'trying to be better',
  'hard for me to',
  'difficult for me to',
  'on me to',
  'something i need to work on',
  'i need to work on',
  'still figuring out',
  'learning how to',
];

/** Multi-word or unambiguous closure cues (substring match). */
const CERTAINTY_AMBIGUITY_CLOSURE_PHRASES_MULTI: string[] = [
  'without doubt',
  'the problem is',
  'the issue is',
  'they need to',
  'he needs to',
  'she needs to',
  'you need to',
];

/**
 * Single-token closure lexicon: use **word boundaries** so we do not match inside e.g. "alright", "bright".
 * Omitted: bare `should have` (hits first-person accountability "I should have…" and depresses the ambiguity pole).
 */
const CLOSURE_SINGLE_WORD_RE = /\b(clearly|obviously|definitely|certainly|absolutely|always|never|wrong|right)\b/gi;

function countClosureHits(text: string): number {
  let n = countPhraseHits(text, CERTAINTY_AMBIGUITY_CLOSURE_PHRASES_MULTI);
  const m = text.match(CLOSURE_SINGLE_WORD_RE);
  if (m) n += m.length;
  return n;
}

/** Pseudocount per bucket so qual>0 and closure=0 does not snap to 1.0 from a single hedge hit. */
const SMOOTHING_ALPHA = 3;

export function normalizeCorpusForCertaintyAmbiguity(corpus: string): string {
  return corpus
    .toLowerCase()
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .normalize('NFKC');
}

/**
 * Returns `certainty_ambiguity_score` ∈ [0,1] for style profile.
 * Uses (qualifiers + α) / (qualifiers + closure + 2α) with α = SMOOTHING_ALPHA.
 */
export function certaintyAmbiguityFromUserCorpus(corpusRaw: string): number {
  const corpus = normalizeCorpusForCertaintyAmbiguity(corpusRaw);
  const q = countPhraseHits(corpus, CERTAINTY_AMBIGUITY_QUALIFIER_PHRASES);
  const c = countClosureHits(corpus);
  const num = q + SMOOTHING_ALPHA;
  const den = q + c + 2 * SMOOTHING_ALPHA;
  if (den <= 0) return 0.5;
  return clamp01(num / den);
}

export function certaintyAmbiguityQualifierAndClosureCounts(corpusRaw: string): {
  qualifierCount: number;
  closureCount: number;
} {
  const corpus = normalizeCorpusForCertaintyAmbiguity(corpusRaw);
  const q = countPhraseHits(corpus, CERTAINTY_AMBIGUITY_QUALIFIER_PHRASES);
  const c = countClosureHits(corpus);
  return { qualifierCount: q, closureCount: c };
}
