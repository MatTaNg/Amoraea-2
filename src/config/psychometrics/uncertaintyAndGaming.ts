/**
 * Uncertainty routing and gaming-correction thresholds.
 */

/** Route to clarification battery when uncertainty ≥ this (0–1). */
export const UNCERTAINTY_ROUTING_THRESHOLD = 0.6;

/** Weighted score used for “near threshold” proximity in uncertainty (legacy; gate pass is 6.5). */
export const UNCERTAINTY_GATE_PROXIMITY_SCORE = 6.0;

/** Max penalty when gaming correction level ≥ 3 or uncertainty ≥ 0.8. */
export const GAMING_CORRECTION_MAX_PENALTY = -0.3;

/** Uncertainty tiers for gaming correction (inclusive lower bound). */
export const GAMING_UNCERTAINTY_TIER_MILD_MIN = 0.6;
export const GAMING_UNCERTAINTY_TIER_MODERATE_MIN = 0.7;
export const GAMING_UNCERTAINTY_TIER_SEVERE_MIN = 0.8;
