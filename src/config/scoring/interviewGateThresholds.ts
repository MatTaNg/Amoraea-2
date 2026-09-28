/**
 * Core interview gate: weighted pass threshold, marker weights & floors.
 * Referral signup no longer lowers the pass bar — discounts are handled separately.
 */

import { INTERVIEW_GATE_WEIGHTS_VERSION } from '../algorithmVersions';

export { INTERVIEW_GATE_WEIGHTS_VERSION };

/** Canonical weighted pass threshold — change here only. */
export const GATE_PASS_WEIGHTED_MIN = 6.5;

/** @alias Canonical pass threshold for gate_fail_detail and UI. */
export const PASS_THRESHOLD = GATE_PASS_WEIGHTED_MIN;

/** Research-based weights (must sum to 1.0). Renormalized over assessed constructs only. */
export const GATE_MARKER_BASE_WEIGHTS = {
  destructive_conflict: 0.18,
  accountability: 0.18,
  repair: 0.17,
  regulation: 0.14,
  responsiveness_support: 0.09,
  mentalizing: 0.07,
  commitment_persistence: 0.07,
  appreciation: 0.10,
} as const;

/** Minimum score for an assessed construct; omit a key to disable its floor. */
export const GATE_MARKER_FLOORS: Partial<Record<keyof typeof GATE_MARKER_BASE_WEIGHTS, number>> = {
  destructive_conflict: 5.0,
  accountability: 5.0,
  repair: 5.0,
  regulation: 4.5,
};
