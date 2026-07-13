/**
 * Deterministic pairwise compatibility scoring (matchmaking algorithm v2).
 * Pure functions — no I/O except computeNarrativeFitScore (TODO stub).
 */

export { MAX_DISTANCE_KM } from '@config/matching/compatibilityScoring';
import {
  ADJUSTMENT_CONFLICT_STYLE_MAX,
  ADJUSTMENT_CONFLICT_STYLE_MIN,
  ADJUSTMENT_POLITICS_MISMATCH,
  ADJUSTMENT_PSYCHOMETRIC_MAX,
  ADJUSTMENT_PSYCHOMETRIC_MIN,
  ADJUSTMENT_SEXUAL_COMM_CLOSE_BONUS,
  ADJUSTMENT_SEXUAL_COMM_CLOSE_MAX_DIFF,
  ADJUSTMENT_SEXUAL_COMM_FAR_MIN_DIFF,
  ADJUSTMENT_SEXUAL_COMM_FAR_PENALTY,
  ATTACHMENT_ANXIOUS_MIN,
  ATTACHMENT_AVOIDANT_MIN,
  ATTACHMENT_DUAL_DISTRESS_MEAN_MIN,
  CAPACITY_ACCOUNTABILITY_WEIGHT,
  CAPACITY_ANXIETY_DISCOUNT_FACTOR,
  CAPACITY_CONTEMPT_WEIGHT,
  CAPACITY_DISCOUNT_BASE,
  CAPACITY_DISCOUNT_MULTIPLIER,
  CAPACITY_DWECK_WEIGHT,
  CAPACITY_EXTERNALIZE_WEIGHT,
  CAPACITY_MENTALIZING_WEIGHT,
  CAPACITY_REGULATION_WEIGHT,
  CAPACITY_REPAIR_WEIGHT,
  CAPACITY_RESILIENCE_WEIGHT,
  CAPACITY_RFQ_WEIGHT,
  CAPACITY_SELF_COMPASSION_WEIGHT,
  COMPAT_ATTACHMENT_WEIGHT,
  COMPAT_BASELINE_WEIGHT,
  COMPAT_FINANCE_WEIGHT,
  COMPAT_INTERVIEW_PROCESS_WEIGHT,
  COMPAT_SEMANTIC_WEIGHT,
  COMPAT_VALUES_WEIGHT,
  DWECK_GROWTH_PAIR_MIN,
  FINANCE_INCOME_WEIGHT,
  FINANCE_POOLING_MISMATCH_SCORE,
  FINANCE_POOLING_WEIGHT,
  FINANCE_RISK_WEIGHT,
  INTERVIEW_DISCOUNT_TIERS,
  INTERVIEW_PROCESS_CONTEMPT_PENALTY_MULTIPLIER,
  INTERVIEW_PROCESS_CONTEMPT_PENALTY_THRESHOLD,
  MAX_DISTANCE_KM,
  NPI_ENTITLEMENT_DIFF_PENALTY_MIN,
  NPI_ENTITLEMENT_HIGH_PAIR_MIN,
  SCS_SF_COMPASSION_PAIR_MIN,
  SEMANTIC_DEFAULT_NARRATIVE_FIT,
  SEMANTIC_LIFE_DOMAIN_WEIGHT,
  SEMANTIC_NARRATIVE_FIT_WEIGHT,
  VALUES_HIGH_SALIENCE_MAX_DIFF,
  VALUES_PEARSON_VS_ABSOLUTE_BLEND,
  VALUES_PROSOCIAL_BLEND,
} from '@config/matching/compatibilityScoring';

export type AttachmentProfile = {
  anxiety: number;
  avoidance: number;
};

export type ValuesProfile = Record<string, number>;

export type RelationalCapacityInput = {
  repair: number | null;
  regulation: number | null;
  contempt: number | null;
  accountability: number | null;
  mentalizing: number | null;
  /** Reflective functioning (1–7). */
  rfqScore: number | null;
  /** GASP externalization (1–7), inverted in capacity formula. */
  gaspExternalizationScore: number | null;
  /** Self-compassion SCS-SF (1–5). */
  scsSfScore: number | null;
  /** Brief Resilience Scale (1–6). */
  brsScore: number | null;
  /** Trait anxiety (1–6), inverted in capacity formula. */
  anxietyTraitScore: number | null;
  /** Growth mindset / Dweck (1–6). */
  dweckScore: number | null;
};

export type FinanceProfile = {
  /** Life-domain answer: "Pooled" | "Separate" | "Hybrid". */
  financesPooled: string | null;
  /** compatibility_data.financialRiskComfort (1–7). */
  financialRiskComfort: number | null;
  /** Life-domain yearlyIncome bracket label. */
  yearlyIncome: string | null;
};

export type ConflictStyleScores = {
  competing: number;
  collaborating: number;
  compromising: number;
  avoiding: number;
  accommodating: number;
};

export type PoliticsProfile = {
  politics: string | null;
};

export type PsychometricProfile = {
  /** users.psychometrics_npi_entitlement_score (0–7 integer). */
  npiEntitlementScore: number | null;
  dweckScore: number | null;
  scsSfScore: number | null;
};

export type SubstanceUseProfile = {
  alcoholFrequency?: string | null;
  cigaretteFrequency?: string | null;
  cannabisTobaccoFrequency?: string | null;
  recreationalDrugsFrequency?: string | null;
  partnerDrinksComfort?: string | null;
  partnerCigarettesComfort?: string | null;
  partnerCannabisTobaccoComfort?: string | null;
  partnerRecreationalDrugsComfort?: string | null;
};

export type DealbreakerProfile = {
  /** Profile / matchPreferences: "Want kids" | "Don't want kids" | "Undecided". */
  wantKids?: string | null;
  /** matchPreferences.partnerSameReligionRequired === "Yes" or explicit flag. */
  requireSameReligion?: boolean | null;
  partnerSameReligionRequired?: string | null;
  religion?: string | null;
  relationshipStyle?: string | null;
  /** compatibility_data.willingToRelocate or matchPreferences.relocationPreference === "Yes". */
  willingToRelocate?: boolean | null;
  relocationPreference?: string | null;
  requiresPoliticalAlignment?: boolean | null;
  /** Profile prefPartnerPoliticalAlignmentImportance === "Yes". */
  prefPartnerPoliticalAlignmentImportance?: string | null;
  politics?: string | null;
  location?: { lat: number; lng: number } | null;
  substance?: SubstanceUseProfile | null;
};

export type InterviewProcessPillars = {
  repair: number;
  accountability: number;
  contempt: number;
};

export type CompatibilityResult = {
  finalScore: number;
  breakdown: {
    attachment: number;
    values: number;
    semantic: number;
    finance: number;
    interviewProcess: number;
    baseline: number;
    capacityDiscount: number;
    interviewDiscount: number;
    adjustments: number;
  };
};

const VALUE_DIMS = [
  'self_direction',
  'stimulation',
  'hedonism',
  'achievement',
  'power',
  'security',
  'conformity',
  'tradition',
  'benevolence',
  'universalism',
] as const;

const LIFE_DOMAIN_KEYS = ['intimacy', 'finance', 'spirituality', 'family', 'physicalHealth'] as const;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function normPsychOrNeutral(
  score: number | null | undefined,
  normalize: (v: number) => number,
): number {
  if (score == null || !Number.isFinite(score)) return 0.5;
  return clamp01(normalize(score));
}

function normPillar(score: number | null | undefined, invert = false): number {
  if (score == null || !Number.isFinite(score)) return 0.5;
  const n = clamp01(score / 10);
  return invert ? 1 - n : n;
}

function normalizeReligionKey(v: string | null | undefined): string {
  return String(v ?? '')
    .trim()
    .toLowerCase();
}

function normalizeRelationshipStyle(v: string | null | undefined): string {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!s) return '';
  if (/mono/i.test(s)) return 'monogamous';
  if (/poly|open|enm/i.test(s)) return 'non_monogamous';
  return s;
}

function wantsChildrenExplicitly(v: string | null | undefined): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === 'want kids' || s === 'yes' || /^want/.test(s);
}

function doesNotWantChildrenExplicitly(v: string | null | undefined): boolean {
  const s = String(v ?? '')
    .trim()
    .toLowerCase();
  return s === "don't want kids" || s === 'no' || /don'?t want/.test(s);
}

function userRequiresSameReligion(p: DealbreakerProfile): boolean {
  if (p.requireSameReligion === true) return true;
  return String(p.partnerSameReligionRequired ?? '')
    .trim()
    .toLowerCase() === 'yes';
}

function userRequiresPoliticalAlignment(p: DealbreakerProfile): boolean {
  if (p.requiresPoliticalAlignment === true) return true;
  return String(p.prefPartnerPoliticalAlignmentImportance ?? '')
    .trim()
    .toLowerCase() === 'yes';
}

function userWillingToRelocate(p: DealbreakerProfile): boolean {
  if (p.willingToRelocate === true) return true;
  return String(p.relocationPreference ?? '')
    .trim()
    .toLowerCase() === 'yes';
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function substanceUses(frequency: string | null | undefined): boolean {
  const f = String(frequency ?? '')
    .trim()
    .toLowerCase();
  if (!f || f === 'never') return false;
  if (f === 'only_ceremonially') return false;
  return true;
}

function hardSubstanceIncompatibility(
  userComfort: string | null | undefined,
  partnerFrequency: string | null | undefined,
): boolean {
  const comfort = String(userComfort ?? '')
    .trim()
    .toLowerCase();
  if (comfort !== 'no') return false;
  return substanceUses(partnerFrequency);
}

function substanceHardBlock(a: DealbreakerProfile, b: DealbreakerProfile): boolean {
  const sa = a.substance ?? {};
  const sb = b.substance ?? {};
  const pairs: [string | null | undefined, string | null | undefined][] = [
    [sa.partnerDrinksComfort, sb.alcoholFrequency],
    [sb.partnerDrinksComfort, sa.alcoholFrequency],
    [sa.partnerCigarettesComfort, sb.cigaretteFrequency],
    [sb.partnerCigarettesComfort, sa.cigaretteFrequency],
    [sa.partnerCannabisTobaccoComfort, sb.cannabisTobaccoFrequency],
    [sb.partnerCannabisTobaccoComfort, sa.cannabisTobaccoFrequency],
    [sa.partnerRecreationalDrugsComfort, sb.recreationalDrugsFrequency],
    [sb.partnerRecreationalDrugsComfort, sa.recreationalDrugsFrequency],
  ];
  return pairs.some(([comfort, freq]) => hardSubstanceIncompatibility(comfort, freq));
}

/** Hard dealbreaker multiplier: 0 blocks the pair, 1 allows full score. */
export function computeDealbreakerMultiplier(a: DealbreakerProfile, b: DealbreakerProfile): 0 | 1 {
  const aWants = wantsChildrenExplicitly(a.wantKids);
  const aNo = doesNotWantChildrenExplicitly(a.wantKids);
  const bWants = wantsChildrenExplicitly(b.wantKids);
  const bNo = doesNotWantChildrenExplicitly(b.wantKids);
  if ((aWants && bNo) || (aNo && bWants)) return 0;

  if (userRequiresSameReligion(a) || userRequiresSameReligion(b)) {
    const relA = normalizeReligionKey(a.religion);
    const relB = normalizeReligionKey(b.religion);
    if (relA && relB && relA !== relB) return 0;
  }

  const styleA = normalizeRelationshipStyle(a.relationshipStyle);
  const styleB = normalizeRelationshipStyle(b.relationshipStyle);
  if (styleA && styleB && styleA !== styleB) return 0;

  if (!userWillingToRelocate(a) && !userWillingToRelocate(b)) {
    if (a.location && b.location) {
      const distanceKm = haversineKm(a.location, b.location);
      if (distanceKm > MAX_DISTANCE_KM) return 0;
    }
  }

  if (userRequiresPoliticalAlignment(a) || userRequiresPoliticalAlignment(b)) {
    const polA = normalizeReligionKey(a.politics);
    const polB = normalizeReligionKey(b.politics);
    if (polA && polB && polA !== polB) return 0;
  }

  if (substanceHardBlock(a, b)) return 0;

  return 1;
}

/** Single-user relational capacity from interview pillars and psychometrics. */
export function computeRelationalCapacity(user: RelationalCapacityInput): number {
  const repairNorm = normPillar(user.repair);
  const regulationNorm = normPillar(user.regulation);
  const contemptNorm = normPillar(user.contempt, true);
  const accountabilityNorm = normPillar(user.accountability);
  const mentalizingNorm = normPillar(user.mentalizing);

  const rfq = normPsychOrNeutral(user.rfqScore, (s) => (s - 1) / 6);
  const externalize = normPsychOrNeutral(user.gaspExternalizationScore, (s) => 1 - (s - 1) / 6);
  const selfCompassion = normPsychOrNeutral(user.scsSfScore, (s) => (s - 1) / 4);
  const resilience = normPsychOrNeutral(user.brsScore, (s) => (s - 1) / 5);
  const lowAnxiety = normPsychOrNeutral(user.anxietyTraitScore, (s) => 1 - (s - 1) / 5);
  const dweck = normPsychOrNeutral(user.dweckScore, (s) => (s - 1) / 5);

  const capacity =
    CAPACITY_RFQ_WEIGHT * rfq +
    CAPACITY_CONTEMPT_WEIGHT * contemptNorm +
    CAPACITY_REPAIR_WEIGHT * repairNorm +
    CAPACITY_ACCOUNTABILITY_WEIGHT * accountabilityNorm +
    CAPACITY_REGULATION_WEIGHT * regulationNorm +
    CAPACITY_MENTALIZING_WEIGHT * mentalizingNorm +
    CAPACITY_EXTERNALIZE_WEIGHT * externalize +
    CAPACITY_SELF_COMPASSION_WEIGHT * selfCompassion +
    CAPACITY_RESILIENCE_WEIGHT * resilience +
    CAPACITY_DWECK_WEIGHT * dweck;

  const anxietyDiscount = 1 - CAPACITY_ANXIETY_DISCOUNT_FACTOR * (1 - lowAnxiety);
  return clamp01(capacity * anxietyDiscount);
}

export function computeCapacityDiscount(capacityA: number, capacityB: number): number {
  const geometric = Math.sqrt(clamp01(capacityA) * clamp01(capacityB));
  return Math.max(0, (CAPACITY_DISCOUNT_BASE - geometric) * CAPACITY_DISCOUNT_MULTIPLIER);
}

export function computeAttachmentScore(
  a: AttachmentProfile,
  b: AttachmentProfile,
): number {
  const Ssec =
    1 -
    (Math.max(0, a.anxiety - 1) +
      Math.max(0, b.anxiety - 1) +
      Math.max(0, a.avoidance - 1) +
      Math.max(0, b.avoidance - 1)) /
      24;

  const Ssim =
    1 -
    (0.45 * Math.abs(a.anxiety - b.anxiety) +
      0.55 * Math.abs(a.avoidance - b.avoidance)) /
      6;

  const aAnxious = a.anxiety >= ATTACHMENT_ANXIOUS_MIN && a.avoidance < ATTACHMENT_ANXIOUS_MIN;
  const aAvoidant = a.avoidance >= ATTACHMENT_AVOIDANT_MIN && a.anxiety < ATTACHMENT_ANXIOUS_MIN;
  const bAnxious = b.anxiety >= ATTACHMENT_ANXIOUS_MIN && b.avoidance < ATTACHMENT_ANXIOUS_MIN;
  const bAvoidant = b.avoidance >= ATTACHMENT_AVOIDANT_MIN && b.anxiety < ATTACHMENT_ANXIOUS_MIN;
  const isAA = (aAnxious && bAvoidant) || (aAvoidant && bAnxious);

  const Panx_avo = isAA
    ? 0.25 *
      Math.max(
        (Math.max(0, (aAnxious ? a.anxiety : b.anxiety) - 4.0) / 3.0) *
          (Math.max(0, (aAvoidant ? a.avoidance : b.avoidance) - 4.0) / 3.0),
        (Math.max(0, (bAnxious ? b.anxiety : a.anxiety) - 4.0) / 3.0) *
          (Math.max(0, (bAvoidant ? b.avoidance : a.avoidance) - 4.0) / 3.0),
      )
    : 0;

  const Pavo_hom =
    a.avoidance >= 4.0 && b.avoidance >= 4.0
      ? 0.35 *
        (Math.max(0, a.avoidance - 4.0) / 3.0) *
        (Math.max(0, b.avoidance - 4.0) / 3.0)
      : 0;

  const aMean = (a.anxiety + a.avoidance) / 2;
  const bMean = (b.anxiety + b.avoidance) / 2;
  const Pdual =
    aMean > ATTACHMENT_DUAL_DISTRESS_MEAN_MIN && bMean > ATTACHMENT_DUAL_DISTRESS_MEAN_MIN
      ? 0.07 * Math.min(1, (aMean - ATTACHMENT_DUAL_DISTRESS_MEAN_MIN + bMean - ATTACHMENT_DUAL_DISTRESS_MEAN_MIN) / 3.0)
      : 0;

  const simBonus = a.avoidance >= 4.0 && b.avoidance >= 4.0 ? 0 : 0.15 * Ssim;
  return clamp01(Ssec + simBonus - Panx_avo - Pavo_hom - Pdual);
}

export function computeValuesScore(aScores: ValuesProfile, bScores: ValuesProfile): number {
  const aVals = VALUE_DIMS.map((d) => aScores[d] ?? 0);
  const bVals = VALUE_DIMS.map((d) => bScores[d] ?? 0);

  const aMean = aVals.reduce((s, v) => s + v, 0) / 10;
  const bMean = bVals.reduce((s, v) => s + v, 0) / 10;

  let cov = 0;
  let aVar = 0;
  let bVar = 0;
  for (let i = 0; i < 10; i++) {
    const ad = aVals[i] - aMean;
    const bd = bVals[i] - bMean;
    cov += ad * bd;
    aVar += ad * ad;
    bVar += bd * bd;
  }

  const denom = Math.sqrt(aVar * bVar);
  const r = denom < 0.0001 ? 0 : cov / denom;
  const pearsonSimilarity = (r + 1) / 2;

  const highSalienceDims = ['self_direction', 'tradition', 'conformity', 'security'] as const;
  const MAX_DIFF = VALUES_HIGH_SALIENCE_MAX_DIFF;
  const absoluteSimilarity =
    1 -
    highSalienceDims.reduce((sum, dim) => {
      return sum + Math.abs((aScores[dim] ?? 0) - (bScores[dim] ?? 0));
    }, 0) /
      (highSalienceDims.length * MAX_DIFF);

  const Sval_sim = VALUES_PEARSON_VS_ABSOLUTE_BLEND.pearson * pearsonSimilarity + VALUES_PEARSON_VS_ABSOLUTE_BLEND.absolute * absoluteSimilarity;

  const maxV = 2.0;
  const minV = -2.0;
  const range = 4.0;
  const Spro_A = clamp01(
    ((aScores.benevolence ?? 0) + (aScores.universalism ?? 0) - 2 * minV) / (2 * range),
  );
  const Spro_B = clamp01(
    ((bScores.benevolence ?? 0) + (bScores.universalism ?? 0) - 2 * minV) / (2 * range),
  );
  const Sprosocial = (Spro_A + Spro_B) / 2;

  return clamp01(VALUES_PROSOCIAL_BLEND.similarity * Sval_sim + VALUES_PROSOCIAL_BLEND.prosocial * Sprosocial);
}

export function incomeToMidpoint(bracket: string | null | undefined): number | null {
  if (!bracket) return null;
  const map: Record<string, number> = {
    'Under $25,000': 12500,
    '$25,000 – $49,999': 37500,
    '$50,000 – $74,999': 62500,
    '$75,000 – $99,999': 87500,
    '$100,000 – $149,999': 125000,
    '$150,000 – $249,999': 200000,
    '$250,000 – $499,999': 375000,
    '$500,000 or more': 600000,
  };
  return map[bracket] ?? null;
}

export function computeFinanceAlignment(a: FinanceProfile, b: FinanceProfile): number {
  const poolingMatch =
    a.financesPooled != null && b.financesPooled != null
      ? a.financesPooled === b.financesPooled
        ? 1.0
        : FINANCE_POOLING_MISMATCH_SCORE
      : 0.5;

  const riskSimilarity =
    a.financialRiskComfort != null && b.financialRiskComfort != null
      ? 1 - Math.abs(a.financialRiskComfort - b.financialRiskComfort) / 9
      : 0.5;

  const aInc = incomeToMidpoint(a.yearlyIncome);
  const bInc = incomeToMidpoint(b.yearlyIncome);
  const incomeRatio =
    aInc != null && bInc != null && Math.max(aInc, bInc) > 0
      ? Math.log(1 + Math.min(aInc, bInc) / (Math.max(aInc, bInc) + 1))
      : 0.5;

  return clamp01(FINANCE_POOLING_WEIGHT * poolingMatch + FINANCE_RISK_WEIGHT * riskSimilarity + FINANCE_INCOME_WEIGHT * incomeRatio);
}

export function computeLifeDomainAlignment(
  aSettings: Record<string, number>,
  bSettings: Record<string, number>,
): number {
  let total = 0;
  for (const d of LIFE_DOMAIN_KEYS) {
    const aVal = (aSettings[d] ?? 50) / 100;
    const bVal = (bSettings[d] ?? 50) / 100;
    total += 1 - Math.abs(aVal - bVal);
  }
  return total / LIFE_DOMAIN_KEYS.length;
}

/**
 * TODO: Wire LLM call for narrative fit scoring.
 * Inputs: matchmaker_summary from communication_style_profiles,
 *         life_domain_answers free text, hobbies from profile_json
 * Cache result in pair_compatibility_cache keyed by sorted user ID pair
 * Prompt focus: goal congruence, life stage alignment, lifestyle compatibility
 * Return score 0-1, default 0.5 when insufficient data
 */
export async function computeNarrativeFitScore(_userIdA: string, _userIdB: string): Promise<number> {
  return SEMANTIC_DEFAULT_NARRATIVE_FIT;
}

export function computeSemanticScore(lifeDomainAlignment: number, narrativeFitScore: number): number {
  return clamp01(lifeDomainAlignment * SEMANTIC_LIFE_DOMAIN_WEIGHT + narrativeFitScore * SEMANTIC_NARRATIVE_FIT_WEIGHT);
}

export function computeInterviewProcessScore(
  a: InterviewProcessPillars,
  b: InterviewProcessPillars,
): number {
  const repairAlignment = 1 - Math.abs(a.repair - b.repair) / 10;
  const accountabilityAlignment = 1 - Math.abs(a.accountability - b.accountability) / 10;
  const contemptRisk = Math.max(a.contempt, b.contempt) / 10;
  const contemptPenalty =
    contemptRisk > INTERVIEW_PROCESS_CONTEMPT_PENALTY_THRESHOLD
      ? (contemptRisk - INTERVIEW_PROCESS_CONTEMPT_PENALTY_THRESHOLD) * INTERVIEW_PROCESS_CONTEMPT_PENALTY_MULTIPLIER
      : 0;
  const base = repairAlignment * 0.5 + accountabilityAlignment * 0.5;
  return clamp01(base - contemptPenalty);
}

export function computeConflictStyleAdjustment(
  a: ConflictStyleScores,
  b: ConflictStyleScores,
  scoreMax: number,
): number {
  const maxProduct = scoreMax * scoreMax;
  const Cdw = a.competing * b.avoiding + b.competing * a.avoiding;
  const dwPenalty = (Cdw / (2 * maxProduct)) * 0.08;
  const Bcollab = (a.collaborating * b.collaborating) / maxProduct;
  const collabBonus = Bcollab * 0.03;
  return Math.max(ADJUSTMENT_CONFLICT_STYLE_MIN, Math.min(ADJUSTMENT_CONFLICT_STYLE_MAX, collabBonus - dwPenalty));
}

export function computePoliticsAdjustment(a: PoliticsProfile, b: PoliticsProfile): number {
  const polA = normalizeReligionKey(a.politics);
  const polB = normalizeReligionKey(b.politics);
  if (!polA || !polB) return 0;
  return polA !== polB ? ADJUSTMENT_POLITICS_MISMATCH : 0;
}

export function computeSexualCommAdjustment(scoreA: number, scoreB: number): number {
  const diff = Math.abs(scoreA - scoreB);
  if (diff <= ADJUSTMENT_SEXUAL_COMM_CLOSE_MAX_DIFF) return ADJUSTMENT_SEXUAL_COMM_CLOSE_BONUS;
  if (diff > ADJUSTMENT_SEXUAL_COMM_FAR_MIN_DIFF) return ADJUSTMENT_SEXUAL_COMM_FAR_PENALTY;
  return 0;
}

export function computePsychometricSoftAdjustments(
  a: PsychometricProfile,
  b: PsychometricProfile,
): number {
  let adj = 0;

  if (a.npiEntitlementScore != null && b.npiEntitlementScore != null) {
    if (a.npiEntitlementScore >= NPI_ENTITLEMENT_HIGH_PAIR_MIN && b.npiEntitlementScore >= NPI_ENTITLEMENT_HIGH_PAIR_MIN) {
      adj -= 0.04;
    }
    if (Math.abs(a.npiEntitlementScore - b.npiEntitlementScore) > NPI_ENTITLEMENT_DIFF_PENALTY_MIN) adj -= 0.03;
  }

  if (a.dweckScore != null && b.dweckScore != null) {
    if (a.dweckScore >= DWECK_GROWTH_PAIR_MIN && b.dweckScore >= DWECK_GROWTH_PAIR_MIN) adj += 0.02;
  }

  if (a.scsSfScore != null && b.scsSfScore != null) {
    if (a.scsSfScore >= SCS_SF_COMPASSION_PAIR_MIN && b.scsSfScore >= SCS_SF_COMPASSION_PAIR_MIN) adj += 0.02;
  }

  return Math.max(ADJUSTMENT_PSYCHOMETRIC_MIN, Math.min(ADJUSTMENT_PSYCHOMETRIC_MAX, adj));
}

export function computeInterviewConfidenceDiscount(weightedScore: number): number {
  for (const tier of INTERVIEW_DISCOUNT_TIERS) {
    if (weightedScore >= tier.minWeightedScore) return tier.discount;
  }
  return INTERVIEW_DISCOUNT_TIERS[INTERVIEW_DISCOUNT_TIERS.length - 1]!.discount;
}

export function computeFinalCompatibilityScore(params: {
  attachmentScore: number;
  valuesScore: number;
  semanticScore: number;
  financeScore: number;
  interviewProcessScore: number;
  capacityA: number;
  capacityB: number;
  interviewWeightedScoreA: number;
  interviewWeightedScoreB: number;
  sexualCommAdjustment: number;
  conflictStyleAdjustment: number;
  politicsAdjustment: number;
  psychometricSoftAdjustment: number;
  dealbreakerMultiplier: 0 | 1;
}): CompatibilityResult {
  const discountA = computeInterviewConfidenceDiscount(params.interviewWeightedScoreA);
  const discountB = computeInterviewConfidenceDiscount(params.interviewWeightedScoreB);
  const interviewDiscount = (discountA + discountB) / 2;

  const capacityDiscount = computeCapacityDiscount(params.capacityA, params.capacityB);

  const coreScore =
    params.attachmentScore * COMPAT_ATTACHMENT_WEIGHT +
    params.valuesScore * COMPAT_VALUES_WEIGHT * interviewDiscount +
    params.semanticScore * COMPAT_SEMANTIC_WEIGHT +
    params.financeScore * COMPAT_FINANCE_WEIGHT +
    params.interviewProcessScore * COMPAT_INTERVIEW_PROCESS_WEIGHT +
    COMPAT_BASELINE_WEIGHT;

  const totalAdjustments =
    params.sexualCommAdjustment +
    params.conflictStyleAdjustment +
    params.politicsAdjustment +
    params.psychometricSoftAdjustment;

  const finalScore =
    clamp01(coreScore - capacityDiscount + totalAdjustments) * params.dealbreakerMultiplier;

  return {
    finalScore,
    breakdown: {
      attachment: params.attachmentScore * COMPAT_ATTACHMENT_WEIGHT,
      values: params.valuesScore * COMPAT_VALUES_WEIGHT * interviewDiscount,
      semantic: params.semanticScore * COMPAT_SEMANTIC_WEIGHT,
      finance: params.financeScore * COMPAT_FINANCE_WEIGHT,
      interviewProcess: params.interviewProcessScore * COMPAT_INTERVIEW_PROCESS_WEIGHT,
      baseline: COMPAT_BASELINE_WEIGHT,
      capacityDiscount,
      interviewDiscount,
      adjustments: totalAdjustments,
    },
  };
}
