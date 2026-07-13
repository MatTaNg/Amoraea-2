/**
 * Programmatic score ceilings when elaboration / specificity is absent (post-LLM heuristics).
 */

export const ELABORATION_MENTALIZING_LEVEL1_CEILING = 5;
/** Level 2 interior/meaning inference must not be scored below this (deflation guard; aligns with rubric 6+ for Level 2). */
export const ELABORATION_MENTALIZING_LEVEL2_FLOOR = 6;
export const ELABORATION_APPRECIATION_CEILING = 6;
export const ELABORATION_REPAIR_CEILING = 5;
export const ELABORATION_MOMENT4_ACCOUNTABILITY_CEILING = 4;

/** Avg user words per turn below this → depth −1 penalty (scenario). */
export const ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN = 20;
export const ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_SINGLE_TURN = 25;

/** Moment 4 slice depth word threshold. */
export const ELABORATION_MOMENT4_DEPTH_WORD_THRESHOLD = 20;

/** Moment 4 low-specificity word-count gate (client metadata). */
export const ELABORATION_MOMENT4_LOW_SPECIFICITY_WORD_COUNT = 55;

/** Logistics-only repair cap when user word count below this. */
export const ELABORATION_LOGISTICS_REPAIR_MAX_WORD_COUNT = 55;

/** Compensatory repair cap when user word count below this. */
export const ELABORATION_COMPENSATORY_REPAIR_MAX_WORD_COUNT = 90;

/** Default depth-modifier threshold when caller omits override. */
export const ELABORATION_DEFAULT_DEPTH_THRESHOLD = 25;

/** keyEvidence length suggesting Level 2 internal-state cues. */
export const ELABORATION_INTERNAL_STATE_EVIDENCE_MIN_LENGTH = 25;
export const ELABORATION_INTERNAL_STATE_TRANSCRIPT_MIN_LENGTH = 15;
