/**
 * Scenario skip penalties applied after marker weighted score.
 */

/** First confirmed scenario skip (moments 1–3). */
export const SKIP_PENALTY_FIRST = -0.3;

/** Second confirmed skip (additive with first). */
export const SKIP_PENALTY_SECOND = -0.6;

/** Third skip: auto-fail (no numeric penalty — weighted score forced to 0 in gate). */
export const SKIP_AUTO_FAIL_COUNT = 3;
