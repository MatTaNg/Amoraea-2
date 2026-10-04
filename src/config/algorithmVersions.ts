/**
 * Version identifiers for consequential scoring / matching changes.
 * Stamp these onto persisted user/attempt rows so historical results stay attributable.
 */

/**
 * Active pre-interview psychometric battery (order + instruments).
 * v3 adds sexual_communication_comfort. It does not reinterpret
 * psychometrics_sexual_communication_* rows from the post-interview typology flow.
 */
export const PSYCHOMETRIC_BATTERY_VERSION = 'pre_interview_v3_sexual_communication_comfort_2026_09';

/** Battery before sexual communication comfort moved into pre-interview collection. */
export const PSYCHOMETRIC_BATTERY_VERSION_V2 = 'pre_interview_v2_2026_08';

/** Prior battery that included AAQ-II, RFQ-8, NPI entitlement, and combined Dweck. */
export const PSYCHOMETRIC_BATTERY_VERSION_LEGACY_V1 = 'pre_interview_v1';

/** Relationship-growth / destiny experimental items (not Knee ITR). */
export const RELATIONSHIP_GROWTH_BELIEFS_ASSESSMENT_VERSION = 'amoraea_rgb_v1';

/** Conflict-catastrophizing subscale split out of historical Dweck items 7–10. */
export const CONFLICT_CATASTROPHIZING_ASSESSMENT_VERSION = 'amoraea_cc_v1';

/** Amoraea-original experimental entitlement (not PES). */
export const AMORAEA_ENTITLEMENT_ASSESSMENT_VERSION = 'amoraea_entitlement_v1';

/**
 * Pre-interview sexual communication comfort (Amoraea-original, 10 items).
 * Distinct from historical post-interview typology id `sexual_communication`.
 */
export const SEXUAL_COMMUNICATION_COMFORT_ASSESSMENT_VERSION = 'amoraea_scc_v1';

/** Historical post-interview typology sexual communication. Not the pre-interview instrument. */
export const SEXUAL_COMMUNICATION_TYPOLOGY_VERSION = 'post_interview_typology_sexual_communication_v1';

/** Interview pillar rollup (moments, aliases, regulation pooling, repair-null vs poor). */
export const PILLAR_ROLLUP_ALGORITHM_VERSION_CURRENT =
  'pillars_v6_s1_hypothetical_repair';

/**
 * Persisted repair source signals (not a pillar-weight change).
 * v2: hypothetical repair is Scenario 3. v3: hypothetical repair is Scenario 1.
 * Stored rows keep the version that produced them.
 */
export const REPAIR_SOURCE_SIGNALS_VERSION_V2 = 'repair_sources_v2_2026_08';
export const REPAIR_SOURCE_SIGNALS_VERSION = 'repair_sources_v3_s1_hypothetical_2026_09';

/** Interview gate weights. */
export const INTERVIEW_GATE_WEIGHTS_VERSION = 'gate_weights_v4_2026_08';

/**
 * Compatibility ranking algorithm.
 * v6 drops sexual-communication pair inputs. Core weights are unchanged from v5
 * because that signal was already coefficient 0 and was not in the core sum.
 */
export const COMPATIBILITY_ALGORITHM_VERSION = 'compat_v6_sexual_communication_individual_2026_09';

/** v5 concrete-life ranking. Historical pair rows keep this stamp. */
export const COMPATIBILITY_ALGORITHM_VERSION_V5 = 'compat_v5_concrete_life_2026_08';

/** Compatibility evidence registry snapshot. */
export const COMPATIBILITY_EVIDENCE_REGISTRY_VERSION = 'compat_evidence_v4_2026_09';

/** Registry snapshot before sexual-communication matching was marked retired. */
export const COMPATIBILITY_EVIDENCE_REGISTRY_VERSION_V3 = 'compat_evidence_v3_2026_08';

export const EXPERIMENTAL_INSTRUMENT_META = {
  confidence: 'experimental' as const,
  amoraeaValidationStatus: 'not_validated' as const,
};
