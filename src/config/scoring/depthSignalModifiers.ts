/**
 * Depth-signal modifier applied to weighted score before pass/fail comparison.
 * Negative values lower the effective score; positive values raise it.
 */

/** Ego development level (1–5) → modifier added to weighted score. */
export const EGO_DEVELOPMENT_LEVEL_MODIFIERS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: -0.3,
  2: 0,
  3: 0.1,
  4: 0.2,
  5: 0.3,
};

/** Ego level 2 = human review flag (not auto-fail). */
export const EGO_DEVELOPMENT_REVIEW_LEVEL = 2 as const;

export type DefensePatternsForDepthModifier = {
  projection_detected?: boolean;
  rationalization_detected?: boolean;
  splitting_detected?: boolean;
  denial_detected?: boolean;
};

/** Defense flags counted toward depth modifier (projection excluded). */
export function countDefensePatternsForDepthModifier(
  dp: DefensePatternsForDepthModifier | null | undefined,
): number {
  return [
    dp?.rationalization_detected === true,
    dp?.splitting_detected === true,
    dp?.denial_detected === true,
  ].filter(Boolean).length;
}

/** Active defense-pattern flags (0–4, projection excluded) → modifier. */
export const DEFENSE_PATTERN_COUNT_MODIFIERS: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 0,
  1: -0.1,
  2: -0.2,
  3: -0.35,
  4: -0.35,
};

/** Defense flags at exactly this count → human review (projection excluded). */
export const DEFENSE_PATTERN_REVIEW_MIN_COUNT = 2;

/** Mentalizing overcertainty occurrences → modifier (cap at 4+). */
export const MENTALIZING_OVERCERTAINTY_COUNT_MODIFIERS: Record<1 | 2 | 3 | 4, number> = {
  1: 0,
  2: -0.1,
  3: -0.2,
  4: -0.3,
};

/** Overcertainty count at or above this → review flag. */
export const MENTALIZING_OVERCERTAINTY_REVIEW_MIN_COUNT = 2;

/** Emotion recognition proportion correct (0–1): exclusive upper bounds for bands. */
export const EMOTION_RECOGNITION_FLOOR_EXCLUSIVE_MAX = 0.34;
export const EMOTION_RECOGNITION_REVIEW_EXCLUSIVE_MAX = 0.67;

/** Modifiers when emotion battery is complete. */
export const EMOTION_RECOGNITION_MODIFIER_BELOW_FLOOR = -0.2;
export const EMOTION_RECOGNITION_MODIFIER_BELOW_REVIEW = -0.2;
export const EMOTION_RECOGNITION_MODIFIER_PERFECT = 0.1;
export const EMOTION_RECOGNITION_PERFECT_MIN_SCORE = 0.99;

/** Disclosure calibration labels → modifier. */
export const DISCLOSURE_UNDER_MODIFIER = -0.2;
