/**
 * Per-scenario composite and pillar-specific floors (scenarios 1–3).
 */

/** Minimum mean pillar score per scenario for gate pass. */
export const SCENARIO_COMPOSITE_PASS_MIN = 5.0;

/** Per-scenario mentalizing / repair must be ≥ this unless fewer than 2 scenarios breach. */
export const MENTALIZING_REPAIR_SCENARIO_PASS_MIN = 4;

/** Fail when this many scenarios have mentalizing or repair strictly below the pass min. */
export const MENTALIZING_REPAIR_LOW_SCENARIO_COUNT_FAIL = 2;
