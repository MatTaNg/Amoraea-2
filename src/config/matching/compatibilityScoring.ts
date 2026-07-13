/**
 * Matchmaking algorithm v2 — weights, limits, and soft adjustments.
 * @see src/features/compatibility/computeCompatibilityScore.ts
 */

/** Max distance (km) before geography hard-blocks when neither user will relocate. */
export const MAX_DISTANCE_KM = 100;

/** Core compatibility blend weights (must sum to 1.0 with baseline). */
export const COMPAT_ATTACHMENT_WEIGHT = 0.4;
export const COMPAT_VALUES_WEIGHT = 0.4;
export const COMPAT_SEMANTIC_WEIGHT = 0.02;
export const COMPAT_FINANCE_WEIGHT = 0.08;
export const COMPAT_INTERVIEW_PROCESS_WEIGHT = 0.05;
export const COMPAT_BASELINE_WEIGHT = 0.05;

/** Relational capacity formula weights (sum ≈ 1.0 before anxiety discount). */
export const CAPACITY_RFQ_WEIGHT = 0.2;
export const CAPACITY_CONTEMPT_WEIGHT = 0.15;
export const CAPACITY_REPAIR_WEIGHT = 0.2;
export const CAPACITY_ACCOUNTABILITY_WEIGHT = 0.14;
export const CAPACITY_REGULATION_WEIGHT = 0.08;
export const CAPACITY_MENTALIZING_WEIGHT = 0.08;
export const CAPACITY_EXTERNALIZE_WEIGHT = 0.08;
export const CAPACITY_SELF_COMPASSION_WEIGHT = 0.03;
export const CAPACITY_RESILIENCE_WEIGHT = 0.02;
export const CAPACITY_DWECK_WEIGHT = 0.02;
export const CAPACITY_ANXIETY_DISCOUNT_FACTOR = 0.1;

/** capacityDiscount = max(0, (CAPACITY_DISCOUNT_BASE - geometricMean) * CAPACITY_DISCOUNT_MULTIPLIER). */
export const CAPACITY_DISCOUNT_BASE = 0.65;
export const CAPACITY_DISCOUNT_MULTIPLIER = 0.3;

/** Attachment style thresholds (ECR-style 1–7 scale). */
export const ATTACHMENT_ANXIOUS_MIN = 4.0;
export const ATTACHMENT_AVOIDANT_MIN = 4.0;
export const ATTACHMENT_DUAL_DISTRESS_MEAN_MIN = 4.5;

/** Values alignment: high-salience PVQ dimensions for absolute similarity. */
export const VALUES_HIGH_SALIENCE_MAX_DIFF = 4.0;
export const VALUES_PEARSON_VS_ABSOLUTE_BLEND = { pearson: 0.6, absolute: 0.4 };
export const VALUES_PROSOCIAL_BLEND = { similarity: 0.8, prosocial: 0.2 };

/** Finance alignment component weights. */
export const FINANCE_POOLING_WEIGHT = 0.55;
export const FINANCE_RISK_WEIGHT = 0.35;
export const FINANCE_INCOME_WEIGHT = 0.1;
export const FINANCE_POOLING_MISMATCH_SCORE = 0.4;

/** Semantic = life domain + narrative fit blend. */
export const SEMANTIC_LIFE_DOMAIN_WEIGHT = 0.4;
export const SEMANTIC_NARRATIVE_FIT_WEIGHT = 0.6;
export const SEMANTIC_DEFAULT_NARRATIVE_FIT = 0.5;

/** Interview process: contempt penalty when max contempt > 0.5 on 0–1 scale. */
export const INTERVIEW_PROCESS_CONTEMPT_PENALTY_THRESHOLD = 0.5;
export const INTERVIEW_PROCESS_CONTEMPT_PENALTY_MULTIPLIER = 0.3;

/** Interview weighted score → confidence discount on values component. */
export const INTERVIEW_DISCOUNT_TIERS = [
  { minWeightedScore: 7.5, discount: 1.0 },
  { minWeightedScore: 7.0, discount: 0.95 },
  { minWeightedScore: 6.5, discount: 0.9 },
  { minWeightedScore: 0, discount: 0.85 },
] as const;

/** Soft pair adjustments (caps enforced in computeCompatibilityScore). */
export const ADJUSTMENT_SEXUAL_COMM_CLOSE_MAX_DIFF = 0.5;
export const ADJUSTMENT_SEXUAL_COMM_FAR_MIN_DIFF = 1.5;
export const ADJUSTMENT_SEXUAL_COMM_CLOSE_BONUS = 0.03;
export const ADJUSTMENT_SEXUAL_COMM_FAR_PENALTY = -0.05;
export const ADJUSTMENT_CONFLICT_STYLE_MAX = 0.03;
export const ADJUSTMENT_CONFLICT_STYLE_MIN = -0.08;
export const ADJUSTMENT_POLITICS_MISMATCH = -0.02;
export const ADJUSTMENT_PSYCHOMETRIC_MIN = -0.1;
export const ADJUSTMENT_PSYCHOMETRIC_MAX = 0.06;

/** NPI entitlement soft adjustment cutoffs. */
export const NPI_ENTITLEMENT_HIGH_PAIR_MIN = 4;
export const NPI_ENTITLEMENT_DIFF_PENALTY_MIN = 3;
export const DWECK_GROWTH_PAIR_MIN = 4.5;
export const SCS_SF_COMPASSION_PAIR_MIN = 4.0;
