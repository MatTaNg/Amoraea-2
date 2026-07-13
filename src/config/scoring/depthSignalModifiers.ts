/**
 * Depth-signal modifier applied to weighted score before pass/fail comparison.
 * Negative values lower the effective score; positive values raise it.
 */

/** Ego development level (1–5) → modifier added to weighted score. Level 1 also triggers auto-fail. */
export const EGO_DEVELOPMENT_LEVEL_MODIFIERS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: -0.8,
  2: -0.3,
  3: 0,
  4: 0.2,
  5: 0.3,
};

/** Ego level 1 = automatic gate fail (in addition to modifier). */
export const EGO_DEVELOPMENT_AUTO_FAIL_LEVEL = 1 as const;

/** Ego level 2 = human review flag (not auto-fail). */
export const EGO_DEVELOPMENT_REVIEW_LEVEL = 2 as const;

/** Active defense-pattern flags (0–4) → modifier. */
export const DEFENSE_PATTERN_COUNT_MODIFIERS: Record<0 | 1 | 2 | 3 | 4, number> = {
  0: 0,
  1: -0.15,
  2: -0.35,
  3: -0.6,
  4: -0.8,
};

/** Defense flags at exactly this count → human review (not when fail threshold reached). */
export const DEFENSE_PATTERN_REVIEW_MIN_COUNT = 2;

/** Defense flags at or above this count → immature_defense_pattern gate fail. */
export const DEFENSE_PATTERN_FAIL_MIN_COUNT = 3;

/** Mentalizing overcertainty occurrences → modifier (cap at 4+). */
export const MENTALIZING_OVERCERTAINTY_COUNT_MODIFIERS: Record<1 | 2 | 3 | 4, number> = {
  1: -0.1,
  2: -0.2,
  3: -0.35,
  4: -0.5,
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
export const DISCLOSURE_OVER_MODIFIER = -0.15;

/** Personal-moment emotional vocabulary flagged low. */
export const EMOTIONAL_VOCAB_LOW_MODIFIER = -0.15;
