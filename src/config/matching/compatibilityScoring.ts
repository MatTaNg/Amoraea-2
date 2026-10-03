/**
 * Matchmaking algorithm v2 — weights, limits, and soft adjustments.
 * @see src/features/compatibility/computeCompatibilityScore.ts
 */

/** Max distance (km) before geography hard-blocks when neither user will relocate. */
export const MAX_DISTANCE_KM = 100;

/** Legacy v2 blend (kept for historical attribution / tests). Do not use for new ranking. */
export const COMPAT_ATTACHMENT_WEIGHT = 0.4;
export const COMPAT_VALUES_WEIGHT = 0.4;
export const COMPAT_SEMANTIC_WEIGHT = 0.02;
export const COMPAT_FINANCE_WEIGHT = 0.08;
export const COMPAT_INTERVIEW_PROCESS_WEIGHT = 0.05;
export const COMPAT_BASELINE_WEIGHT = 0.05;

/**
 * Production ranking core (compat_v5, unchanged in compat_v6). Weights are
 * priority-chosen, not a proportional leftover of the old Life-Vision / Narrative
 * mix. They sum to 1.00. Sexual-communication pair similarity is not in this sum.
 *
 * 1. concreteLifeFit — largest; pairwise desired-life fields already collected
 * 2. finance — distinct structured pooling / risk / income
 * 3. lifeDomainImportanceAlignment — four abstract importance sliders; not majority
 * 4. valuesSimilarity — generic PVQ, low influence
 * 5. attachmentSimilarity — generic ECR, very low influence
 */
export const COMPAT_V3_CONCRETE_LIFE_FIT_WEIGHT = 0.5;
export const COMPAT_V3_FINANCE_WEIGHT = 0.22;
export const COMPAT_V3_LIFE_DOMAIN_IMPORTANCE_WEIGHT = 0.21;
/** @deprecated Alias for {@link COMPAT_V3_LIFE_DOMAIN_IMPORTANCE_WEIGHT}. */
export const COMPAT_V3_LIFE_DOMAIN_WEIGHT = COMPAT_V3_LIFE_DOMAIN_IMPORTANCE_WEIGHT;
/** Retired from ranking — kept at 0 so call sites can still pass the unused score. */
export const COMPAT_V3_INTERVIEW_PROCESS_WEIGHT = 0;
export const COMPAT_V3_ATTACHMENT_SIMILARITY_WEIGHT = 0.02;
export const COMPAT_V3_VALUES_SIMILARITY_WEIGHT = 0.05;
/**
 * Narrative/semantic fit is not in the production core until a pair-specific LLM job is wired.
 * Kept at 0 so leftover call sites cannot pad ranking with a constant 0.5 stub.
 */
export const COMPAT_V3_SEMANTIC_WEIGHT = 0;
/** Retired from ranking — not used to pad the core to 1.00. */
export const COMPAT_V3_BASELINE_WEIGHT = 0;
/** Amoraea heuristic cap (research-informed direction, not a validated coefficient). */
export const COMPAT_V3_ANXIOUS_AVOIDANT_SOFT_PENALTY_MAX = 0.05;

export const COMPAT_V3_CORE_WEIGHTS = {
  concreteLifeFit: COMPAT_V3_CONCRETE_LIFE_FIT_WEIGHT,
  finance: COMPAT_V3_FINANCE_WEIGHT,
  lifeDomainImportanceAlignment: COMPAT_V3_LIFE_DOMAIN_IMPORTANCE_WEIGHT,
  valuesSimilarity: COMPAT_V3_VALUES_SIMILARITY_WEIGHT,
  attachmentSimilarity: COMPAT_V3_ATTACHMENT_SIMILARITY_WEIGHT,
} as const;

export function compatV3CoreWeightsSum(): number {
  return (
    COMPAT_V3_CORE_WEIGHTS.concreteLifeFit +
    COMPAT_V3_CORE_WEIGHTS.finance +
    COMPAT_V3_CORE_WEIGHTS.lifeDomainImportanceAlignment +
    COMPAT_V3_CORE_WEIGHTS.valuesSimilarity +
    COMPAT_V3_CORE_WEIGHTS.attachmentSimilarity
  );
}

/** Raw finance fields owned exclusively by the Finance core component. */
export const FINANCE_OWNED_INPUT_FIELDS = [
  'financesPooled',
  'financialRiskComfort',
  'yearlyIncome',
  'financialSupportExpectation',
  'financialStructure',
  'incomeRange',
  'partnerSharesFinancialValuesImportance',
  'partnerSharesFinancialStructureImportance',
  'partnerSimilarFinancialPositionImportance',
  'debtAmount',
  'debtPayoffPlan',
] as const;

/**
 * Diagnostic relational-capacity weights (sum = 1.0 before anxiety discount).
 * RFQ and Dweck were removed — they are not in the live battery and capacity is not a ranking input.
 * Remaining mass was scaled from the prior 0.78 unique-signal total onto 1.00.
 */
export const CAPACITY_CONTEMPT_WEIGHT = 0.19;
export const CAPACITY_REPAIR_WEIGHT = 0.26;
export const CAPACITY_ACCOUNTABILITY_WEIGHT = 0.18;
export const CAPACITY_REGULATION_WEIGHT = 0.1;
export const CAPACITY_MENTALIZING_WEIGHT = 0.1;
export const CAPACITY_EXTERNALIZE_WEIGHT = 0.1;
export const CAPACITY_SELF_COMPASSION_WEIGHT = 0.04;
export const CAPACITY_RESILIENCE_WEIGHT = 0.03;
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

/**
 * @deprecated Narrative fit is unavailable in production ranking.
 * The historical stub returned 0.5 for every pair; do not use that constant as a score.
 */
export const SEMANTIC_LIFE_DOMAIN_WEIGHT = 0;
/** @deprecated Unused. Narrative is not an active core component. */
export const SEMANTIC_NARRATIVE_FIT_WEIGHT = 0;
/** @deprecated Historical stub default. Must not enter production ranking. */
export const SEMANTIC_DEFAULT_NARRATIVE_FIT = 0.5;

/** @deprecated Interview process is not a ranking input. Helpers may still compute a diagnostic score. */
export const INTERVIEW_PROCESS_CONTEMPT_PENALTY_THRESHOLD = 0.5;
export const INTERVIEW_PROCESS_CONTEMPT_PENALTY_MULTIPLIER = 0.3;

/** @deprecated Values confidence is no longer discounted by interview score. */
export const INTERVIEW_DISCOUNT_TIERS = [
  { minWeightedScore: 7.5, discount: 1.0 },
  { minWeightedScore: 7.0, discount: 0.95 },
  { minWeightedScore: 6.5, discount: 0.9 },
  { minWeightedScore: 0, discount: 0.85 },
] as const;

/** Soft pair adjustments (caps enforced in computeCompatibilityScore). */
export const ADJUSTMENT_CONFLICT_STYLE_MAX = 0.03;
export const ADJUSTMENT_CONFLICT_STYLE_MIN = -0.08;
export const ADJUSTMENT_POLITICS_MISMATCH = -0.02;
export const ADJUSTMENT_PSYCHOMETRIC_MIN = -0.1;
export const ADJUSTMENT_PSYCHOMETRIC_MAX = 0.06;

/** Explicit partner-alignment importance (onboarding “how much of a dealbreaker”). */
export const ADJUSTMENT_ALIGNMENT_VERY_IMPORTANT = -0.04;
export const ADJUSTMENT_ALIGNMENT_PREFERENCE = -0.012;
export const ADJUSTMENT_ALIGNMENT_RANKING_CAP = -0.12;

/** NPI entitlement soft adjustment cutoffs. */
export const NPI_ENTITLEMENT_HIGH_PAIR_MIN = 4;
export const NPI_ENTITLEMENT_DIFF_PENALTY_MIN = 3;
export const DWECK_GROWTH_PAIR_MIN = 4.5;
export const SCS_SF_COMPASSION_PAIR_MIN = 4.0;
