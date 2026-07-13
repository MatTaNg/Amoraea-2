/**
 * Gaming correction: straight-line flags, psych/interview divergence, uncertainty tiers.
 */

import {
  GAMING_CORRECTION_MAX_PENALTY,
  GAMING_UNCERTAINTY_TIER_MILD_MIN,
  GAMING_UNCERTAINTY_TIER_MODERATE_MIN,
  GAMING_UNCERTAINTY_TIER_SEVERE_MIN,
} from './uncertaintyAndGaming';

export {
  GAMING_CORRECTION_MAX_PENALTY,
  GAMING_UNCERTAINTY_TIER_MILD_MIN,
  GAMING_UNCERTAINTY_TIER_MODERATE_MIN,
  GAMING_UNCERTAINTY_TIER_SEVERE_MIN,
};

export const GAMING_STRAIGHT_LINE_SEVERE_MIN_COUNT = 3;
export const GAMING_DIVERGENCE_SEVERE_MIN_COUNT = 3;
export const GAMING_CORRECTION_LEVEL_SEVERE = 3;

/** Psych vs interview divergence checks (gaming correction). */
export const GAMING_RFQ_STRONG_MIN = 5.0;
export const GAMING_ACCOUNTABILITY_STRONG_MIN = 7.0;
export const GAMING_MENTALIZING_WEAK_MAX = 4.5;
export const GAMING_GASP_LOW_MAX = 2.5;
export const GAMING_ACCOUNTABILITY_WEAK_MAX = 4.5;
export const GAMING_CONTEMPT_WEAK_MAX = 5.0;
export const GAMING_BRS_HIGH_MIN = 4.0;
export const GAMING_REGULATION_WEAK_MAX = 4.5;
export const GAMING_REGULATION_STRONG_MIN = 7.0;
export const GAMING_BRS_FLOOR_MAX = 1.8;
export const GAMING_AAQ2_FLOOR_MIN = 33;
export const GAMING_RSES_FLOOR_MAX = 24;
export const GAMING_SCS_SF_HIGH_MIN = 4.0;
export const GAMING_AAQ2_FLEXIBLE_MAX = 14;
export const GAMING_RSES_HIGH_MIN = 30;
export const GAMING_SD3_LOW_MAX = 2.0;
export const GAMING_DWECK_STRONG_MIN = 4.5;
