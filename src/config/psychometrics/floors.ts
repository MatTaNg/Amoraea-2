/**
 * Psychometric auto-fail floor thresholds.
 * Scores at or beyond these limits trigger gate fail (instrument-specific direction).
 * Floors sit strictly beyond {@link REFERENCE_PSYCHOMETRIC_CALIBRATION} so that profile does not auto-fail.
 */

export { REFERENCE_PSYCHOMETRIC_CALIBRATION } from './referencePsychometricCalibration';

export const RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_THRESHOLD = 2.0;
export const GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD = 4.6;
export const DWECK_EXTREME_FIXED_MINDSET_FLOOR_THRESHOLD = 2.4;
/** SCS-SF mean (1–5). Auto-fail strictly below 2.5; 2.50 is admissible with a modifier. */
export const SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD = 2.5;
/** BRS mean on the production 1–5 Likert scale. Auto-fail at or below 1.8. */
export const BRS_LOW_RESILIENCE_FLOOR_THRESHOLD = 1.8;
/** Historical detector only — trait anxiety is not a new-user auto-fail. */
export const ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD = 4.9;
/** Historical detector only — AAQ-II is retired from new-user scoring. */
export const AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD = 33;
/**
 * RSES sum score (10 items × 1–4); range 10–40.
 * Amoraea admissions threshold: fail at or below 20 (pass at 21).
 * This is an Amoraea admissions threshold, not a clinically validated universal partner-suitability cutoff.
 */
export const RSES_LOW_SELF_ESTEEM_FLOOR_THRESHOLD = 20;

/** @deprecated Retired SCS instrument — legacy gate_fail_detail only. */
export const SCS_PUBLIC_HIGH_SELF_CONSCIOUSNESS_FLOOR_THRESHOLD = 17;
/** @deprecated Retired SCS instrument — legacy gate_fail_detail only. */
export const SCS_PRIVATE_LOW_SELF_AWARENESS_FLOOR_THRESHOLD = 10;

export const SD3_NARCISSISM_FLOOR_THRESHOLD = 4.0;
export const NPI_ENTITLEMENT_FLOOR_THRESHOLD = 5;
