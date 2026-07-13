/**
 * Core interview gate: weighted pass threshold, referral override, marker weights & floors.
 */

/** Canonical weighted pass threshold — change here only. */
export const GATE_PASS_WEIGHTED_MIN = 6.5;

/** @alias Canonical pass threshold for gate_fail_detail and UI. */
export const PASS_THRESHOLD = GATE_PASS_WEIGHTED_MIN;

/** Weighted pass when referral boost is active (floors unchanged). */
export const REFERRAL_WEIGHTED_PASS_MIN = 6.0;

/** Research-based weights (must sum to 1.0). Renormalized over assessed constructs only. */
export const GATE_MARKER_BASE_WEIGHTS = {
  contempt: 0.2,
  accountability: 0.18,
  repair: 0.18,
  regulation: 0.12,
  attunement: 0.12,
  mentalizing: 0.1,
  commitment_threshold: 0.05,
  appreciation: 0.05,
} as const;

/** Minimum score for an assessed construct; omit a key to disable its floor. */
export const GATE_MARKER_FLOORS: Partial<Record<keyof typeof GATE_MARKER_BASE_WEIGHTS, number>> = {
  contempt: 5.0,
  accountability: 5.0,
  repair: 5.0,
  regulation: 4.5,
};
