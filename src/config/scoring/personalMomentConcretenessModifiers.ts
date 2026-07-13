/**
 * Personal-moment response concreteness (absent | low | moderate | high) — gate & depth-signal modifiers.
 */

/** Combined M4+M5 gate modifier (non-positive). */
export const CONCRETENESS_GATE_MODIFIER_BOTH_ABSENT = -0.3;
export const CONCRETENESS_GATE_MODIFIER_BOTH_LOW = -0.2;
export const CONCRETENESS_GATE_MODIFIER_MIXED_ABSENT_LOW = -0.25;

/** Depth-signal delta from M4×M5 concreteness pair (added to depthSignalModifier). */
export const CONCRETENESS_DEPTH_DELTA_BOTH_ABSENT = -0.5;
export const CONCRETENESS_DEPTH_DELTA_MIXED_ABSENT_LOW = -0.35;
export const CONCRETENESS_DEPTH_DELTA_BOTH_LOW = -0.3;
export const CONCRETENESS_DEPTH_DELTA_LOW_MODERATE = -0.1;
export const CONCRETENESS_DEPTH_DELTA_BOTH_MODERATE = 0;
export const CONCRETENESS_DEPTH_DELTA_HIGH_MODERATE = 0.1;
export const CONCRETENESS_DEPTH_DELTA_BOTH_HIGH = 0.2;
