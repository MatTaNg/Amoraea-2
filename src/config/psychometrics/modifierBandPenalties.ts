/**
 * Psychometric modifier band penalties and per-instrument score cutoffs.
 * Applied to final gate weighted score (negative modifiers only; floors handled separately).
 */

export const PSYCHOMETRIC_MODIFIER_STRONG = 0;
export const PSYCHOMETRIC_MODIFIER_AVERAGE = -0.1;
export const PSYCHOMETRIC_MODIFIER_POOR = -0.25;
/** SCS-SF below-average band (between strong and low). */
export const PSYCHOMETRIC_MODIFIER_BELOW_AVERAGE = -0.05;
/** RSES low self-esteem band (between average and very low). */
export const PSYCHOMETRIC_MODIFIER_LOW = -0.15;
/** MSPSS isolated / high dependency risk. */
export const PSYCHOMETRIC_MODIFIER_ISOLATED = -0.2;

/** GASP externalization mean bands (4-item subscale). */
export const GASP_STRONG_MAX_MEAN = 3.0;
export const GASP_AVERAGE_MAX_MEAN = 4.0;
export const GASP_PATTERN_OVERRIDE_MAX_MEAN = 3.5;
export const GASP_PATTERN_INTERPERSONAL_MAX = 3;
export const GASP_PATTERN_SITUATIONAL_MAX = 4;
export const GASP_CONSISTENCY_REVIEW_MIN_MEAN = 4.5;

/** BRS (1–6). Floor at BRS_LOW_RESILIENCE_FLOOR_THRESHOLD in floors.ts. */
export const BRS_STRONG_MIN = 3.5;
export const BRS_AVERAGE_MIN = 2.5;

/** Trait anxiety (1–6). Floor at ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD. */
export const ANXIETY_STRONG_MAX = 2.5;
export const ANXIETY_AVERAGE_MAX = 3.5;

/** SCS-SF self-compassion (1–5). */
export const SCS_SF_STRONG_MIN = 3.5;
export const SCS_SF_BELOW_AVERAGE_MIN = 2.5;
export const SCS_SF_LOW_MIN = 2.0;

/** Dweck growth mindset (1–6). */
export const DWECK_STRONG_MIN = 4.5;
export const DWECK_AVERAGE_MIN = 3.5;
export const DWECK_POOR_MIN = 2.4;

/** AAQ-II sum score. Floor at AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD. */
export const AAQ2_STRONG_MAX = 18;
export const AAQ2_AVERAGE_MAX = 28;
export const AAQ2_HIGH_AVOIDANCE_MIN = 25;
export const AAQ2_LOW_AVOIDANCE_MAX = 14;
export const AAQ2_STRAIGHT_LINE_UNIQUE_MAX = 2;

/** RSES sum (10–40). */
export const RSES_STRONG_MIN = 30;
export const RSES_AVERAGE_MIN = 25;
export const RSES_LOW_MIN = 20;
export const RSES_LOW_SELF_ESTEEM_MAX = 19;
export const RSES_STRAIGHT_LINE_UNIQUE_MAX = 2;

/** Retired SCS public/private orientation diff. */
export const SCS_ORIENTATION_STRONG_DIFF_MIN = 2;
export const SCS_ORIENTATION_BALANCED_DIFF_MIN = -2;
export const SCS_STRONGLY_EXTERNAL_DIFF_MAX = -7;
export const SCS_STRAIGHT_LINE_UNIQUE_MAX = 2;

/** MSPSS friends subscale (1–7). */
export const MSPSS_STRONG_MIN = 5.5;
export const MSPSS_ADEQUATE_MIN = 4.0;
export const MSPSS_LIMITED_MIN = 2.5;

/** NPI entitlement (0–7 integer). Floor at NPI_ENTITLEMENT_FLOOR_THRESHOLD. */
export const NPI_STRONG_MAX = 2;
export const NPI_AVERAGE_MAX = 4;
export const NPI_DIVERGENCE_MIN = 4;

/** SD3 narcissism (1–5). Floor at SD3_NARCISSISM_FLOOR_THRESHOLD. */
export const SD3_STRONG_MAX = 2.0;
export const SD3_AVERAGE_MAX = 3.0;
export const SD3_CONTEMPT_DIVERGENCE_MIN = 3.5;

/** RFQ reflective functioning (1–7). Floor at RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD. */
export const RFQ_STRONG_MIN = 5.0;
export const RFQ_AVERAGE_MIN = 3.5;
export const RFQ_POOR_MIN = 2.0;
export const RFQ_MENTALIZING_LOW_SELF_REPORT_MAX = 3.5;
export const RFQ_MENTALIZING_HIGH_SELF_REPORT_MIN = 5.5;
