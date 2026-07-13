import type { ConflictStyleKey } from "./conflictStyleTypes";
import { CONFLICT_STYLE_KEYS } from "./conflictStyleTypes";

export type ConflictStyleCounts = Record<ConflictStyleKey, number>;

/** Alias matching the forced-choice scoring export name */
export type ConflictStyleScores = ConflictStyleCounts;

const TOTAL_ITEMS = 20;

export function emptyCounts(): ConflictStyleCounts {
  return {
    competing: 0,
    collaborating: 0,
    compromising: 0,
    avoiding: 0,
    accommodating: 0,
  };
}

/** One style per question in order */
export function scoreConflictStyle(answers: ConflictStyleKey[]): ConflictStyleCounts {
  const scores = emptyCounts();
  for (const style of answers) {
    scores[style] += 1;
  }
  return scores;
}

export function tallyResponses(
  answers: { questionIndex: number; style: ConflictStyleKey }[]
): ConflictStyleCounts {
  const sorted = [...answers].sort((a, b) => a.questionIndex - b.questionIndex);
  return scoreConflictStyle(sorted.map((a) => a.style));
}

export function primaryConflictStyle(scores: ConflictStyleCounts): ConflictStyleKey {
  return (CONFLICT_STYLE_KEYS as readonly ConflictStyleKey[]).reduce((a, b) =>
    scores[a] >= scores[b] ? a : b
  );
}

export function hasDominantTie(scores: ConflictStyleCounts): boolean {
  const max = Math.max(...CONFLICT_STYLE_KEYS.map((k) => scores[k]));
  return CONFLICT_STYLE_KEYS.filter((k) => scores[k] === max).length > 1;
}

/** All styles tied for the highest count */
export function tiedForDominant(scores: ConflictStyleCounts): ConflictStyleKey[] {
  const max = Math.max(...CONFLICT_STYLE_KEYS.map((k) => scores[k]));
  return CONFLICT_STYLE_KEYS.filter((k) => scores[k] === max);
}

export function dominantAndSecondary(
  counts: ConflictStyleCounts
): { dominant: ConflictStyleKey; secondary: ConflictStyleKey } {
  const entries = CONFLICT_STYLE_KEYS.map((k) => [k, counts[k]] as const);
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    dominant: entries[0][0],
    secondary: entries[1][0],
  };
}

/** Percentages for display (0–100, 1 decimal ok). */
export function countsToPercentages(counts: ConflictStyleCounts): Record<ConflictStyleKey, number> {
  const out = {} as Record<ConflictStyleKey, number>;
  for (const k of CONFLICT_STYLE_KEYS) {
    out[k] = Math.round((counts[k] / TOTAL_ITEMS) * 1000) / 10;
  }
  return out;
}
