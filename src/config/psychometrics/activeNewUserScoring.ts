/**
 * Canonical new-user psychometric scoring inventory.
 * Historical columns/detectors may remain, but only instruments listed here
 * may change a new user's gate modifier, auto-fail, or gaming correction.
 */

/** Pre-interview battery currently collected for new users (`ASSESSMENT_ORDER`). */
export const ACTIVE_PRE_INTERVIEW_ASSESSMENT_IDS = [
  'brs',
  'anxiety_trait',
  'scs_sf',
  'gasp',
  'relationship_growth_beliefs',
  'conflict_catastrophizing',
  'rses',
  'amoraea_entitlement_v1',
  'sexual_communication_comfort',
] as const;

/**
 * Collected and scored, but experimental: no gate floor, no weighted-score modifier,
 * and no pairwise matching effect. sexual_communication_comfort may still add a
 * soft uncertainty flag (see sexualCommunicationSoftModifier).
 */
export const EXPERIMENTAL_NON_GATING_ASSESSMENT_IDS = [
  'amoraea_entitlement_v1',
  'relationship_growth_beliefs',
  'conflict_catastrophizing',
  'sexual_communication_comfort',
] as const;

/** Instruments that may still apply a negative psychometric modifier for new users. */
export const ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS = [
  'gasp',
  'brs',
  'anxiety_trait',
  'rses',
  'scs_sf',
] as const;

/** Straight-line / gaming correction may only strip these live modifier instruments. */
export const GAMING_SCORE_AFFECTING_INSTRUMENTS = ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS;

/** Retired instruments: readable historically, zero new-user scoring influence. */
export const RETIRED_HISTORICAL_ASSESSMENT_IDS = [
  'aaq2',
  'rfq',
  'npi_entitlement',
  'dweck',
  'scs',
  'sd3_narcissism',
  'mspss',
] as const;

/**
 * Score columns that must be non-null before the active battery is complete.
 * Entitlement is stored as `psychometrics_entitlement_score` (experimental placeholder,
 * not the licensed Psychological Entitlement Scale).
 */
export const ACTIVE_BATTERY_SCORE_COLUMNS = {
  brs: 'psychometrics_brs_score',
  anxiety_trait: 'psychometrics_anxiety_trait_score',
  scs_sf: 'psychometrics_scs_sf_score',
  gasp: 'psychometrics_gasp_score',
  relationship_growth_beliefs: 'psychometrics_relationship_growth_beliefs_score',
  conflict_catastrophizing: 'psychometrics_conflict_catastrophizing_score',
  rses: 'psychometrics_rses_score',
  amoraea_entitlement_v1: 'psychometrics_entitlement_score',
  sexual_communication_comfort: 'psychometrics_sexual_communication_comfort_score',
} as const satisfies Record<(typeof ACTIVE_PRE_INTERVIEW_ASSESSMENT_IDS)[number], string>;

/**
 * @deprecated Combined Dweck/RBI score. New batteries write
 * `psychometrics_relationship_growth_beliefs_score` and
 * `psychometrics_conflict_catastrophizing_score` instead. Column kept for historical rows.
 */
export const DEPRECATED_DWECK_SCORE_COLUMN = 'psychometrics_dweck_score';

/**
 * @deprecated AAQ-II was removed from the pre-interview battery.
 * Null on new users is expected. Column kept for historical rows.
 */
export const DEPRECATED_AAQ2_SCORE_COLUMN = 'psychometrics_aaq2_score';

/**
 * @deprecated RFQ-8 was removed from the pre-interview battery.
 * Null on new users is expected. Column kept for historical rows.
 */
export const DEPRECATED_RFQ_SCORE_COLUMN = 'psychometrics_rfq_score';

export type ActiveNewUserModifierInstrument =
  (typeof ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS)[number];

export function isActiveNewUserModifierInstrument(
  instrument: string,
): instrument is ActiveNewUserModifierInstrument {
  return (ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS as readonly string[]).includes(instrument);
}
