/**
 * Psychometric modifier band penalties and per-instrument score cutoffs.
 * Applied to final gate weighted score (negative modifiers only; floors handled separately).
 *
 * Live modifier instruments: BRS, trait anxiety, SCS-SF, GASP, RSES.
 * Floor breaches fail independently and contribute 0 for that instrument.
 * The summed live modifier is clamped to {@link PSYCHOMETRIC_MODIFIER_MIN} (Amoraea heuristic).
 */

export {
  REFERENCE_PSYCHOMETRIC_CALIBRATION,
  type ReferencePsychometricCalibration,
} from './referencePsychometricCalibration';

export const PSYCHOMETRIC_MODIFIER_STRONG = 0;
export const PSYCHOMETRIC_MODIFIER_AVERAGE = -0.1;
export const PSYCHOMETRIC_MODIFIER_POOR = -0.25;
/** SCS-SF mild-concern band (still above the admission floor). */
export const PSYCHOMETRIC_MODIFIER_BELOW_AVERAGE = -0.05;
/** Strong-concern band for still-admissible scores (e.g. RSES 21). */
export const PSYCHOMETRIC_MODIFIER_LOW = -0.15;
/** MSPSS isolated / high dependency risk. */
export const PSYCHOMETRIC_MODIFIER_ISOLATED = -0.2;
/**
 * Lower bound on the summed live psychometric modifier (BRS + anxiety + SCS-SF + GASP + RSES).
 * Amoraea heuristic — not a research-derived coefficient. Hard floors still fail independently.
 */
export const PSYCHOMETRIC_MODIFIER_MIN = -0.35;
export const PSYCHOMETRIC_MODIFIER_CAP_SOURCE = 'amoraea_heuristic' as const;

/** GASP externalization mean bands (4-item subscale, 1–7). Strong requires mean &lt; reference (4.0). */
export const GASP_STRONG_MAX_MEAN = 3.99;
/** Average band through reference (4.0); poor begins above 4.2 (floor unchanged at 4.6). */
export const GASP_AVERAGE_MAX_MEAN = 4.2;
export const GASP_PATTERN_OVERRIDE_MAX_MEAN = 3.5;
export const GASP_PATTERN_INTERPERSONAL_MAX = 3;
export const GASP_PATTERN_SITUATIONAL_MAX = 4;
export const GASP_CONSISTENCY_REVIEW_MIN_MEAN = 4.5;

/** BRS (1–5 mean). Strong requires score &gt; reference (2.667). */
export const BRS_STRONG_MIN = 2.7;
export const BRS_AVERAGE_MIN = 2.5;

/** Trait anxiety (1–5 mean). Strong requires score &lt; reference (3.0). Poor from 3.5 (floor unchanged at 4.9). */
export const ANXIETY_STRONG_MAX = 3;
export const ANXIETY_AVERAGE_MAX = 3.5;

/**
 * SCS-SF self-compassion (1–5 mean). Modifier bands sit entirely above the admission floor (&lt; 2.5).
 * Strong requires score ≥ 3.3 (above reference 3.25).
 */
export const SCS_SF_STRONG_MIN = 3.3;
/** Mild concern: 2.90–3.29. */
export const SCS_SF_BELOW_AVERAGE_MIN = 2.9;
/** Moderate concern: 2.50–2.89. Below 2.50 is the hard floor, not a modifier band. */
export const SCS_SF_LOW_MIN = 2.5;

/** Dweck growth mindset (1–6 mean). Strong requires score &gt; reference (3.1). Average widened to 3.0–3.24. */
export const DWECK_STRONG_MIN = 3.25;
export const DWECK_AVERAGE_MIN = 3.0;
export const DWECK_POOR_MIN = 2.4;

/** AAQ-II sum score (7–49). Strong requires score &lt; reference (31). Average through 32; floor at 33 (no poor band). */
export const AAQ2_STRONG_MAX = 30;
/** @deprecated Average band now extends to {@link AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD} in compute logic. */
export const AAQ2_AVERAGE_MAX = 32;
export const AAQ2_HIGH_AVOIDANCE_MIN = 25;
export const AAQ2_LOW_AVOIDANCE_MAX = 14;
export const AAQ2_STRAIGHT_LINE_UNIQUE_MAX = 2;

/**
 * RSES sum (10–40). Modifier bands sit entirely above the Amoraea admissions floor (≤ 20).
 * Strong / healthy: ≥ 24. Reference calibration (21) is the last admissible modifier band.
 */
export const RSES_STRONG_MIN = 24;
/** Moderate concern: 22–23. */
export const RSES_AVERAGE_MIN = 22;
/** Strong concern: 21 only. ≤ 20 is the hard floor, not a modifier band. */
export const RSES_LOW_MIN = 21;
export const RSES_LOW_SELF_ESTEEM_MAX = 18;
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

/** RFQ reflective functioning (1–7 mean). Strong requires score &gt; reference (3.25). */
export const RFQ_STRONG_MIN = 3.3;
export const RFQ_AVERAGE_MIN = 3.0;
export const RFQ_POOR_MIN = 2.0;
export const RFQ_MENTALIZING_LOW_SELF_REPORT_MAX = 3.5;
export const RFQ_MENTALIZING_HIGH_SELF_REPORT_MIN = 5.5;
