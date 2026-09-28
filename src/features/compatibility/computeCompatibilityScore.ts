/**
 * Deterministic pairwise compatibility scoring.
 * Production ranking is {@link computeFinalCompatibilityScoreV3}.
 * {@link computeFinalCompatibilityScore} is historical V2 only.
 */

import { hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';
import {
  isPartnerAlignmentHardBlock,
  partnerAlignmentRankingWeight,
} from '@/shared/constants/partnerAlignmentImportance';
import {
  ADJUSTMENT_ALIGNMENT_PREFERENCE,
  ADJUSTMENT_ALIGNMENT_RANKING_CAP,
  ADJUSTMENT_ALIGNMENT_VERY_IMPORTANT,
  ADJUSTMENT_CONFLICT_STYLE_MAX,
  ADJUSTMENT_CONFLICT_STYLE_MIN,
  ADJUSTMENT_POLITICS_MISMATCH,
  ADJUSTMENT_PSYCHOMETRIC_MAX,
  ADJUSTMENT_PSYCHOMETRIC_MIN,
  ATTACHMENT_ANXIOUS_MIN,
  ATTACHMENT_AVOIDANT_MIN,
  ATTACHMENT_DUAL_DISTRESS_MEAN_MIN,
  CAPACITY_ACCOUNTABILITY_WEIGHT,
  CAPACITY_ANXIETY_DISCOUNT_FACTOR,
  CAPACITY_CONTEMPT_WEIGHT,
  CAPACITY_DISCOUNT_BASE,
  CAPACITY_DISCOUNT_MULTIPLIER,
  CAPACITY_EXTERNALIZE_WEIGHT,
  CAPACITY_MENTALIZING_WEIGHT,
  CAPACITY_REGULATION_WEIGHT,
  CAPACITY_REPAIR_WEIGHT,
  CAPACITY_RESILIENCE_WEIGHT,
  CAPACITY_SELF_COMPASSION_WEIGHT,
  COMPAT_ATTACHMENT_WEIGHT,
  COMPAT_BASELINE_WEIGHT,
  COMPAT_FINANCE_WEIGHT,
  COMPAT_INTERVIEW_PROCESS_WEIGHT,
  COMPAT_SEMANTIC_WEIGHT,
  COMPAT_VALUES_WEIGHT,
  COMPAT_V3_ANXIOUS_AVOIDANT_SOFT_PENALTY_MAX,
  COMPAT_V3_ATTACHMENT_SIMILARITY_WEIGHT,
  COMPAT_V3_CONCRETE_LIFE_FIT_WEIGHT,
  COMPAT_V3_FINANCE_WEIGHT,
  COMPAT_V3_LIFE_DOMAIN_IMPORTANCE_WEIGHT,
  COMPAT_V3_VALUES_SIMILARITY_WEIGHT,
  FINANCE_INCOME_WEIGHT,
  FINANCE_POOLING_MISMATCH_SCORE,
  FINANCE_POOLING_WEIGHT,
  FINANCE_RISK_WEIGHT,
  INTERVIEW_DISCOUNT_TIERS,
  INTERVIEW_PROCESS_CONTEMPT_PENALTY_MULTIPLIER,
  INTERVIEW_PROCESS_CONTEMPT_PENALTY_THRESHOLD,
  MAX_DISTANCE_KM,
  SCS_SF_COMPASSION_PAIR_MIN,
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
  /** GASP externalization (1–7), inverted in capacity formula. */
  gaspExternalizationScore: number | null;
  /** Self-compassion SCS-SF (1–5). */
  scsSfScore: number | null;
  /** Brief Resilience Scale (1–5 Likert mean). */
  brsScore: number | null;
  /** Trait anxiety (1–5 Likert mean), inverted in capacity formula. */
  anxietyTraitScore: number | null;
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
  /** Comma-separated hobby ids from profile. */
  hobbies?: string | null;
  /**
   * Onboarding hobby dealbreaker id, or null/"__none__" when none of the listed hobbies would be a dealbreaker.
   */
  hobbyDealbreakerId?: string | null;
  partnerAlignmentTobacco?: string | null;
  partnerAlignmentAlcohol?: string | null;
  partnerAlignmentRecreationalDrugs?: string | null;
  partnerAlignmentPsychedelics?: string | null;
  partnerAlignmentCannabis?: string | null;
  smoking?: string | null;
  drinking?: string | null;
  recreationalDrugsSocial?: string | null;
  relationshipWithPsychedelics?: string | null;
  relationshipWithCannabis?: string | null;
  prefPartnerSharesSexualInterests?: string | null;
  sexInterestCategories?: string[] | null;
};

export type InterviewProcessPillars = {
  repair: number;
  accountability: number;
  contempt: number;
};

export type CompatibilityContributionComponent = {
  weight: number;
  rawScore: number;
  contribution: number;
};

export type CompatibilityUnavailableComponent = CompatibilityContributionComponent & {
  available: false;
  status: 'not_assessed';
  reason: string;
};

export type CompatibilityContributionBreakdown = {
  core: {
    concreteLifeFit: CompatibilityContributionComponent;
    lifeDomainImportanceAlignment: CompatibilityContributionComponent;
    finance: CompatibilityContributionComponent;
    valuesSimilarity: CompatibilityContributionComponent;
    attachmentSimilarity: CompatibilityContributionComponent;
  };
  adjustments: {
    anxiousAvoidant: number;
    conflictStyle: number;
    preferenceMismatch: number;
    politics: number;
    psychometricSoft: number;
    /** Retired pair-ranking term. Always 0 in production V3. */
    sexualDiscrepancy: number;
    /** @deprecated Alias of preferenceMismatch. */
    preferenceAlignment: number;
  };
  unavailable: {
    narrativeFit: CompatibilityUnavailableComponent;
    intimacy: CompatibilityUnavailableComponent;
  };
  hardFilters: string[];
  duplicateInputFlags: string[];
  coreScore: number;
  adjustedScore: number;
  finalScore: number;
};

export type CompatibilityResult = {
  finalScore: number;
  breakdown: {
    attachment: number;
    values: number;
    lifeDomain: number;
    concreteLifeFit: number;
    semantic: number;
    finance: number;
    interviewProcess: number;
    baseline: number;
    capacityDiscount: number;
    interviewDiscount: number;
    adjustments: number;
  };
  contributionBreakdown?: CompatibilityContributionBreakdown;
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

/**
 * Abstract life-domain importance alignment uses only these four 0–100 sliders.
 * It is not concrete desired-life compatibility. The `finance` slider is excluded
 * so structured finance is not double-counted.
 */
export const LIFE_DOMAIN_IMPORTANCE_SLIDER_KEYS = [
  'intimacy',
  'spirituality',
  'family',
  'physicalHealth',
] as const;
/** @deprecated Use {@link LIFE_DOMAIN_IMPORTANCE_SLIDER_KEYS}. */
export const LIFE_VISION_RANKING_SLIDER_KEYS = LIFE_DOMAIN_IMPORTANCE_SLIDER_KEYS;
const LIFE_DOMAIN_RANKING_KEYS = LIFE_DOMAIN_IMPORTANCE_SLIDER_KEYS;

export { MAX_DISTANCE_KM };

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
  return isPartnerAlignmentHardBlock(p.partnerSameReligionRequired);
}

function userRequiresPoliticalAlignment(p: DealbreakerProfile): boolean {
  if (p.requiresPoliticalAlignment === true) return true;
  return isPartnerAlignmentHardBlock(p.prefPartnerPoliticalAlignmentImportance);
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

function collectSubstanceHardFilterCodes(a: DealbreakerProfile, b: DealbreakerProfile): string[] {
  const sa = a.substance ?? {};
  const sb = b.substance ?? {};
  const codes: string[] = [];
  const pairs: Array<[string, string | null | undefined, string | null | undefined]> = [
    ['substance_comfort_no_alcohol', sa.partnerDrinksComfort, sb.alcoholFrequency],
    ['substance_comfort_no_alcohol', sb.partnerDrinksComfort, sa.alcoholFrequency],
    ['substance_comfort_no_cigarettes', sa.partnerCigarettesComfort, sb.cigaretteFrequency],
    ['substance_comfort_no_cigarettes', sb.partnerCigarettesComfort, sa.cigaretteFrequency],
    ['substance_comfort_no_cannabis', sa.partnerCannabisTobaccoComfort, sb.cannabisTobaccoFrequency],
    ['substance_comfort_no_cannabis', sb.partnerCannabisTobaccoComfort, sa.cannabisTobaccoFrequency],
    [
      'substance_comfort_no_recreational_drugs',
      sa.partnerRecreationalDrugsComfort,
      sb.recreationalDrugsFrequency,
    ],
    [
      'substance_comfort_no_recreational_drugs',
      sb.partnerRecreationalDrugsComfort,
      sa.recreationalDrugsFrequency,
    ],
  ];
  for (const [code, comfort, freq] of pairs) {
    if (hardSubstanceIncompatibility(comfort, freq) && !codes.includes(code)) codes.push(code);
  }
  return codes;
}

function collectPartnerAlignmentHardFilterCodes(a: DealbreakerProfile, b: DealbreakerProfile): string[] {
  const dims: Array<{ code: string; importanceA?: string | null; importanceB?: string | null; mismatch: boolean }> =
    [
      {
        code: 'alignment_tobacco',
        importanceA: a.partnerAlignmentTobacco,
        importanceB: b.partnerAlignmentTobacco,
        mismatch: valuesDiffer(a.smoking, b.smoking),
      },
      {
        code: 'alignment_alcohol',
        importanceA: a.partnerAlignmentAlcohol,
        importanceB: b.partnerAlignmentAlcohol,
        mismatch: valuesDiffer(a.drinking, b.drinking),
      },
      {
        code: 'alignment_recreational_drugs',
        importanceA: a.partnerAlignmentRecreationalDrugs,
        importanceB: b.partnerAlignmentRecreationalDrugs,
        mismatch: valuesDiffer(a.recreationalDrugsSocial, b.recreationalDrugsSocial),
      },
      {
        code: 'alignment_psychedelics',
        importanceA: a.partnerAlignmentPsychedelics,
        importanceB: b.partnerAlignmentPsychedelics,
        mismatch: valuesDiffer(a.relationshipWithPsychedelics, b.relationshipWithPsychedelics),
      },
      {
        code: 'alignment_cannabis',
        importanceA: a.partnerAlignmentCannabis,
        importanceB: b.partnerAlignmentCannabis,
        mismatch: valuesDiffer(a.relationshipWithCannabis, b.relationshipWithCannabis),
      },
      {
        code: 'alignment_sex_interests',
        importanceA: a.prefPartnerSharesSexualInterests,
        importanceB: b.prefPartnerSharesSexualInterests,
        mismatch: sexInterestSetsDiffer(a.sexInterestCategories, b.sexInterestCategories),
      },
    ];
  return dims
    .filter(
      (d) =>
        d.mismatch &&
        (isPartnerAlignmentHardBlock(d.importanceA) || isPartnerAlignmentHardBlock(d.importanceB)),
    )
    .map((d) => d.code);
}

/** Machine-readable hard-filter codes for audit + concreteLifeFit skip lists. */
export function listDealbreakerHardFilterCodes(a: DealbreakerProfile, b: DealbreakerProfile): string[] {
  const codes: string[] = [];
  const aWants = wantsChildrenExplicitly(a.wantKids);
  const aNo = doesNotWantChildrenExplicitly(a.wantKids);
  const bWants = wantsChildrenExplicitly(b.wantKids);
  const bNo = doesNotWantChildrenExplicitly(b.wantKids);
  if ((aWants && bNo) || (aNo && bWants)) codes.push('kids_want_vs_dont');

  if (userRequiresSameReligion(a) || userRequiresSameReligion(b)) {
    const relA = normalizeReligionKey(a.religion);
    const relB = normalizeReligionKey(b.religion);
    if (relA && relB && relA !== relB) codes.push('religion_required_mismatch');
  }

  const styleA = normalizeRelationshipStyle(a.relationshipStyle);
  const styleB = normalizeRelationshipStyle(b.relationshipStyle);
  if (styleA && styleB && styleA !== styleB) codes.push('relationship_style_mismatch');

  if (!userWillingToRelocate(a) && !userWillingToRelocate(b)) {
    if (a.location && b.location) {
      const distanceKm = haversineKm(a.location, b.location);
      if (distanceKm > MAX_DISTANCE_KM) codes.push('distance_no_relocate');
    }
  }

  if (userRequiresPoliticalAlignment(a) || userRequiresPoliticalAlignment(b)) {
    const polA = normalizeReligionKey(a.politics);
    const polB = normalizeReligionKey(b.politics);
    if (polA && polB && polA !== polB) codes.push('politics_required_mismatch');
  }

  codes.push(...collectSubstanceHardFilterCodes(a, b));
  if (hobbyDealbreakerHardBlock(a, b)) codes.push('hobby_dealbreaker');
  codes.push(...collectPartnerAlignmentHardFilterCodes(a, b));
  return codes;
}

/** Hard dealbreaker multiplier: 0 blocks the pair, 1 allows full score. */
export function computeDealbreakerMultiplier(a: DealbreakerProfile, b: DealbreakerProfile): 0 | 1 {
  return listDealbreakerHardFilterCodes(a, b).length > 0 ? 0 : 1;
}

function hobbyDealbreakerIsNone(id: string | null | undefined): boolean {
  if (id == null) return true;
  const t = id.trim();
  return t === '' || t === '__none__';
}

/** Existing onboarding hobby dealbreaker: hard-block only when the named hobby is required and the other person lacks it. */
export function hobbyDealbreakerHardBlock(a: DealbreakerProfile, b: DealbreakerProfile): boolean {
  const idsA = new Set(hobbiesStringToIds(a.hobbies));
  const idsB = new Set(hobbiesStringToIds(b.hobbies));
  const aNeed = a.hobbyDealbreakerId?.trim() ?? '';
  const bNeed = b.hobbyDealbreakerId?.trim() ?? '';
  if (!hobbyDealbreakerIsNone(aNeed) && !idsB.has(aNeed)) return true;
  if (!hobbyDealbreakerIsNone(bNeed) && !idsA.has(bNeed)) return true;
  return false;
}

function valuesDiffer(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = String(a ?? '')
    .trim()
    .toLowerCase();
  const nb = String(b ?? '')
    .trim()
    .toLowerCase();
  if (!na || !nb) return false;
  return na !== nb;
}

function sexInterestSetsDiffer(a?: string[] | null, b?: string[] | null): boolean {
  const key = (cats?: string[] | null) =>
    (cats ?? [])
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
      .sort()
      .join('|');
  const ka = key(a);
  const kb = key(b);
  if (!ka || !kb) return false;
  return ka !== kb;
}

function rankingPenaltyFor(importance: string | null | undefined, mismatch: boolean): number {
  if (!mismatch) return 0;
  const weight = partnerAlignmentRankingWeight(importance);
  if (weight === 'very_important') return ADJUSTMENT_ALIGNMENT_VERY_IMPORTANT;
  if (weight === 'preference') return ADJUSTMENT_ALIGNMENT_PREFERENCE;
  return 0;
}

function partnerAlignmentHardBlock(a: DealbreakerProfile, b: DealbreakerProfile): boolean {
  const dims: Array<{
    importanceA?: string | null;
    importanceB?: string | null;
    mismatch: boolean;
  }> = [
    {
      importanceA: a.partnerAlignmentTobacco,
      importanceB: b.partnerAlignmentTobacco,
      mismatch: valuesDiffer(a.smoking, b.smoking),
    },
    {
      importanceA: a.partnerAlignmentAlcohol,
      importanceB: b.partnerAlignmentAlcohol,
      mismatch: valuesDiffer(a.drinking, b.drinking),
    },
    {
      importanceA: a.partnerAlignmentRecreationalDrugs,
      importanceB: b.partnerAlignmentRecreationalDrugs,
      mismatch: valuesDiffer(a.recreationalDrugsSocial, b.recreationalDrugsSocial),
    },
    {
      importanceA: a.partnerAlignmentPsychedelics,
      importanceB: b.partnerAlignmentPsychedelics,
      mismatch: valuesDiffer(a.relationshipWithPsychedelics, b.relationshipWithPsychedelics),
    },
    {
      importanceA: a.partnerAlignmentCannabis,
      importanceB: b.partnerAlignmentCannabis,
      mismatch: valuesDiffer(a.relationshipWithCannabis, b.relationshipWithCannabis),
    },
    {
      importanceA: a.prefPartnerSharesSexualInterests,
      importanceB: b.prefPartnerSharesSexualInterests,
      mismatch: sexInterestSetsDiffer(a.sexInterestCategories, b.sexInterestCategories),
    },
  ];
  return dims.some(
    (d) =>
      d.mismatch &&
      (isPartnerAlignmentHardBlock(d.importanceA) || isPartnerAlignmentHardBlock(d.importanceB)),
  );
}

/** Soft ranking from very-important / preference alignment mismatches. Hard blocks are handled separately. */
export function computePartnerAlignmentRankingAdjustment(
  a: DealbreakerProfile,
  b: DealbreakerProfile,
): number {
  const religionMismatch = valuesDiffer(a.religion, b.religion);
  const politicsMismatch = valuesDiffer(a.politics, b.politics);
  const sexMismatch = sexInterestSetsDiffer(a.sexInterestCategories, b.sexInterestCategories);

  let total = 0;
  total += rankingPenaltyFor(a.partnerSameReligionRequired, religionMismatch);
  total += rankingPenaltyFor(b.partnerSameReligionRequired, religionMismatch);
  total += rankingPenaltyFor(a.prefPartnerPoliticalAlignmentImportance, politicsMismatch);
  total += rankingPenaltyFor(b.prefPartnerPoliticalAlignmentImportance, politicsMismatch);
  total += rankingPenaltyFor(a.partnerAlignmentTobacco, valuesDiffer(a.smoking, b.smoking));
  total += rankingPenaltyFor(b.partnerAlignmentTobacco, valuesDiffer(a.smoking, b.smoking));
  total += rankingPenaltyFor(a.partnerAlignmentAlcohol, valuesDiffer(a.drinking, b.drinking));
  total += rankingPenaltyFor(b.partnerAlignmentAlcohol, valuesDiffer(a.drinking, b.drinking));
  total += rankingPenaltyFor(
    a.partnerAlignmentRecreationalDrugs,
    valuesDiffer(a.recreationalDrugsSocial, b.recreationalDrugsSocial),
  );
  total += rankingPenaltyFor(
    b.partnerAlignmentRecreationalDrugs,
    valuesDiffer(a.recreationalDrugsSocial, b.recreationalDrugsSocial),
  );
  total += rankingPenaltyFor(
    a.partnerAlignmentPsychedelics,
    valuesDiffer(a.relationshipWithPsychedelics, b.relationshipWithPsychedelics),
  );
  total += rankingPenaltyFor(
    b.partnerAlignmentPsychedelics,
    valuesDiffer(a.relationshipWithPsychedelics, b.relationshipWithPsychedelics),
  );
  total += rankingPenaltyFor(
    a.partnerAlignmentCannabis,
    valuesDiffer(a.relationshipWithCannabis, b.relationshipWithCannabis),
  );
  total += rankingPenaltyFor(
    b.partnerAlignmentCannabis,
    valuesDiffer(a.relationshipWithCannabis, b.relationshipWithCannabis),
  );
  total += rankingPenaltyFor(a.prefPartnerSharesSexualInterests, sexMismatch);
  total += rankingPenaltyFor(b.prefPartnerSharesSexualInterests, sexMismatch);

  return Math.max(ADJUSTMENT_ALIGNMENT_RANKING_CAP, total);
}

/** Diagnostic capacity from interview pillars and live psychometrics. Not a ranking input. */
export function computeRelationalCapacity(user: RelationalCapacityInput): number {
  const repairNorm = normPillar(user.repair);
  const regulationNorm = normPillar(user.regulation);
  const contemptNorm = normPillar(user.contempt, true);
  const accountabilityNorm = normPillar(user.accountability);
  const mentalizingNorm = normPillar(user.mentalizing);

  const externalize = normPsychOrNeutral(user.gaspExternalizationScore, (s) => 1 - (s - 1) / 6);
  const selfCompassion = normPsychOrNeutral(user.scsSfScore, (s) => (s - 1) / 4);
  const resilience = normPsychOrNeutral(user.brsScore, (s) => (s - 1) / 5);
  const lowAnxiety = normPsychOrNeutral(user.anxietyTraitScore, (s) => 1 - (s - 1) / 5);

  const capacity =
    CAPACITY_CONTEMPT_WEIGHT * contemptNorm +
    CAPACITY_REPAIR_WEIGHT * repairNorm +
    CAPACITY_ACCOUNTABILITY_WEIGHT * accountabilityNorm +
    CAPACITY_REGULATION_WEIGHT * regulationNorm +
    CAPACITY_MENTALIZING_WEIGHT * mentalizingNorm +
    CAPACITY_EXTERNALIZE_WEIGHT * externalize +
    CAPACITY_SELF_COMPASSION_WEIGHT * selfCompassion +
    CAPACITY_RESILIENCE_WEIGHT * resilience;

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
  for (const d of LIFE_DOMAIN_RANKING_KEYS) {
    const aVal = (aSettings[d] ?? 50) / 100;
    const bVal = (bSettings[d] ?? 50) / 100;
    total += 1 - Math.abs(aVal - bVal);
  }
  return total / LIFE_DOMAIN_RANKING_KEYS.length;
}

/** Alias: four-slider importance alignment, not concrete desired-life fit. */
export const computeLifeDomainImportanceAlignment = computeLifeDomainAlignment;

/**
 * Narrative/semantic fit is not assessed in production ranking.
 * The historical stub returned a constant 0.5; that value must not enter ranking.
 */
export async function computeNarrativeFitScore(_userIdA: string, _userIdB: string): Promise<null> {
  return null;
}

/**
 * @deprecated Historical helper. Production ranking does not use narrative fit.
 * Returning the argument does not make it a ranking input.
 */
export function computeSemanticScore(_lifeDomainAlignment: number, narrativeFitScore: number): number {
  return clamp01(narrativeFitScore);
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

export function computePsychometricSoftAdjustments(
  a: PsychometricProfile,
  b: PsychometricProfile,
): number {
  let adj = 0;
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

/**
 * Historical V2 ranking. Not used in production matching.
 *
 * `sexualCommAdjustment` exists only so historical V2 tests remain reproducible.
 * Production V3 ignores this field and must never depend on it.
 */
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
  /** @deprecated Historical V2 only. Sexual-communication pair similarity is not a production ranking input. */
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
      lifeDomain: 0,
      concreteLifeFit: 0,
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

function normalizeEcrDimension(score: number): number {
  return clamp01((score - 1) / 6);
}

/** Level C: continuous ECR anxious×avoidant — small soft penalty, never a hard block. */
export function computeAnxiousAvoidantSoftPenalty(
  a: AttachmentProfile,
  b: AttachmentProfile,
): number {
  const riskAB = normalizeEcrDimension(a.anxiety) * normalizeEcrDimension(b.avoidance);
  const riskBA = normalizeEcrDimension(b.anxiety) * normalizeEcrDimension(a.avoidance);
  const interactionRisk = Math.max(riskAB, riskBA);
  if (interactionRisk <= 0) return 0;
  return -(COMPAT_V3_ANXIOUS_AVOIDANT_SOFT_PENALTY_MAX * interactionRisk);
}

function contribution(
  weight: number,
  rawScore: number,
): CompatibilityContributionComponent {
  return { weight, rawScore, contribution: rawScore * weight };
}

function unavailableNarrative(): CompatibilityUnavailableComponent {
  return {
    available: false,
    status: 'not_assessed',
    reason: 'llm_narrative_fit_job_not_wired',
    weight: 0,
    rawScore: 0,
    contribution: 0,
  };
}

function unavailableIntimacy(): CompatibilityUnavailableComponent {
  return {
    available: false,
    status: 'not_assessed',
    reason: 'pairwise_intimacy_model_not_implemented',
    weight: 0,
    rawScore: 0,
    contribution: 0,
  };
}

/**
 * Production ranking. Generic ECR/PVQ similarity is experimental and low-weight.
 * Narrative fit and sexual-communication pair similarity are not ranking inputs.
 */
export function computeFinalCompatibilityScoreV3(params: {
  attachmentScore: number;
  valuesScore: number;
  lifeDomainImportanceAlignment: number;
  /** @deprecated Ignored. Narrative is unavailable until a pair-specific LLM job is wired. */
  semanticScore?: number;
  concreteLifeFitScore: number;
  financeScore: number;
  interviewProcessScore: number;
  capacityA: number;
  capacityB: number;
  /** @deprecated Historical V2 only. Ignored in V3; production ranking must not pass a live value. */
  sexualCommAdjustment?: number;
  conflictStyleAdjustment: number;
  politicsAdjustment: number;
  psychometricSoftAdjustment: number;
  anxiousAvoidantSoftPenalty: number;
  partnerAlignmentAdjustment?: number;
  dealbreakerMultiplier: 0 | 1;
  hardFilters?: string[];
}): CompatibilityResult {
  void params.semanticScore;
  void params.sexualCommAdjustment;
  void params.interviewProcessScore;
  void params.capacityA;
  void params.capacityB;

  const concreteLifeFit = contribution(COMPAT_V3_CONCRETE_LIFE_FIT_WEIGHT, params.concreteLifeFitScore);
  const lifeDomainImportanceAlignment = contribution(
    COMPAT_V3_LIFE_DOMAIN_IMPORTANCE_WEIGHT,
    params.lifeDomainImportanceAlignment,
  );
  const finance = contribution(COMPAT_V3_FINANCE_WEIGHT, params.financeScore);
  const valuesSimilarity = contribution(COMPAT_V3_VALUES_SIMILARITY_WEIGHT, params.valuesScore);
  const attachmentSimilarity = contribution(
    COMPAT_V3_ATTACHMENT_SIMILARITY_WEIGHT,
    params.attachmentScore,
  );

  const coreScore =
    concreteLifeFit.contribution +
    lifeDomainImportanceAlignment.contribution +
    finance.contribution +
    valuesSimilarity.contribution +
    attachmentSimilarity.contribution;

  const preferenceMismatch = params.partnerAlignmentAdjustment ?? 0;
  const totalAdjustments =
    params.conflictStyleAdjustment +
    params.politicsAdjustment +
    params.psychometricSoftAdjustment +
    params.anxiousAvoidantSoftPenalty +
    preferenceMismatch;

  const adjustedScore = clamp01(coreScore + totalAdjustments);
  const hardFilters =
    params.hardFilters ?? (params.dealbreakerMultiplier === 0 ? ['dealbreaker_ineligible'] : []);
  const finalScore = adjustedScore * params.dealbreakerMultiplier;

  const contributionBreakdown: CompatibilityContributionBreakdown = {
    core: {
      concreteLifeFit,
      lifeDomainImportanceAlignment,
      finance,
      valuesSimilarity,
      attachmentSimilarity,
    },
    adjustments: {
      anxiousAvoidant: params.anxiousAvoidantSoftPenalty,
      conflictStyle: params.conflictStyleAdjustment,
      preferenceMismatch,
      politics: params.politicsAdjustment,
      psychometricSoft: params.psychometricSoftAdjustment,
      sexualDiscrepancy: 0,
      preferenceAlignment: preferenceMismatch,
    },
    unavailable: {
      narrativeFit: unavailableNarrative(),
      intimacy: unavailableIntimacy(),
    },
    hardFilters,
    duplicateInputFlags: [],
    coreScore,
    adjustedScore,
    finalScore,
  };

  return {
    finalScore,
    breakdown: {
      attachment: attachmentSimilarity.contribution,
      values: valuesSimilarity.contribution,
      lifeDomain: lifeDomainImportanceAlignment.contribution,
      concreteLifeFit: concreteLifeFit.contribution,
      semantic: 0,
      finance: finance.contribution,
      interviewProcess: 0,
      baseline: 0,
      capacityDiscount: 0,
      interviewDiscount: 1,
      adjustments: totalAdjustments,
    },
    contributionBreakdown,
  };
}
