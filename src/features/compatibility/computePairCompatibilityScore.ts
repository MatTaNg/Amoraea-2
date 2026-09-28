import {
  computeAnxiousAvoidantSoftPenalty,
  computeAttachmentScore,
  computeConflictStyleAdjustment,
  computeDealbreakerMultiplier,
  computeFinalCompatibilityScoreV3,
  computeFinanceAlignment,
  computeInterviewProcessScore,
  computeLifeDomainAlignment,
  computePsychometricSoftAdjustments,
  computeRelationalCapacity,
  computeValuesScore,
  listDealbreakerHardFilterCodes,
  type CompatibilityResult,
  type DealbreakerProfile,
} from './computeCompatibilityScore';
import {
  computeConcreteLifeFit,
  type ConcreteLifeFitProfile,
} from './computeConcreteLifeFit';
import type { MappedUserCompatibilityInputs } from './mapMatchmakingUserToCompatibilityInputs';
import { buildCompatibilityDomainViews, type CompatibilityDomainView } from './compatibilityDomainPresentation';

const NEUTRAL = 0.5;
const CONFLICT_STYLE_SCORE_MAX = 100;

export type PairCompatibilitySubscores = {
  attachment: number;
  values: number;
  /** Always unused in production ranking. Kept for schema compatibility; not a live score. */
  semantic: number;
  concreteLifeFit: number;
  lifeDomainImportanceAlignment: number;
  finance: number;
  interviewProcess: number;
  capacityA: number;
  capacityB: number;
  dealbreakerMultiplier: 0 | 1;
};

export type PairCompatibilityAdjustments = {
  /** Retired: sexual-communication capacity similarity is not a ranking input. Always 0. */
  sexualComm: number;
  conflictStyle: number;
  /** Politics mismatches are scored inside concreteLifeFit, not as a second addend. */
  politics: number;
  psychometricSoft: number;
  total: number;
};

export type PairCompatibilityResult = CompatibilityResult & {
  subscores: PairCompatibilitySubscores;
  adjustments: PairCompatibilityAdjustments;
  domainViews: CompatibilityDomainView[];
};

function concreteLifeFromDealbreaker(dealbreaker: DealbreakerProfile): ConcreteLifeFitProfile {
  return {
    wantKids: dealbreaker.wantKids,
    relationshipStyle: dealbreaker.relationshipStyle,
    religion: dealbreaker.religion,
    partnerSameReligionRequired: dealbreaker.partnerSameReligionRequired,
    politics: dealbreaker.politics,
    prefPartnerPoliticalAlignmentImportance: dealbreaker.prefPartnerPoliticalAlignmentImportance,
    location: dealbreaker.location,
    willingToRelocate: dealbreaker.willingToRelocate,
    relocationPreference: dealbreaker.relocationPreference,
    smoking: dealbreaker.smoking,
    drinking: dealbreaker.drinking,
    recreationalDrugsSocial: dealbreaker.recreationalDrugsSocial,
    relationshipWithPsychedelics: dealbreaker.relationshipWithPsychedelics,
    relationshipWithCannabis: dealbreaker.relationshipWithCannabis,
    substance: dealbreaker.substance,
    partnerAlignmentTobacco: dealbreaker.partnerAlignmentTobacco,
    partnerAlignmentAlcohol: dealbreaker.partnerAlignmentAlcohol,
    partnerAlignmentRecreationalDrugs: dealbreaker.partnerAlignmentRecreationalDrugs,
    partnerAlignmentPsychedelics: dealbreaker.partnerAlignmentPsychedelics,
    partnerAlignmentCannabis: dealbreaker.partnerAlignmentCannabis,
    sexInterestCategories: dealbreaker.sexInterestCategories,
    prefPartnerSharesSexualInterests: dealbreaker.prefPartnerSharesSexualInterests,
  };
}

function resolveConcreteLife(user: MappedUserCompatibilityInputs): ConcreteLifeFitProfile {
  const mapped = user.concreteLife;
  if (mapped && Object.values(mapped).some((v) => v != null && v !== '')) {
    return mapped;
  }
  return concreteLifeFromDealbreaker(user.dealbreaker);
}

export function computePairCompatibilityScore(
  userA: MappedUserCompatibilityInputs,
  userB: MappedUserCompatibilityInputs,
  options?: { narrativeFitScore?: number },
): PairCompatibilityResult {
  void options?.narrativeFitScore;

  const hardFilters = listDealbreakerHardFilterCodes(userA.dealbreaker, userB.dealbreaker);
  const dealbreakerMultiplier: 0 | 1 = hardFilters.length > 0 ? 0 : computeDealbreakerMultiplier(
    userA.dealbreaker,
    userB.dealbreaker,
  );

  const attachmentScore =
    userA.attachment && userB.attachment
      ? computeAttachmentScore(userA.attachment, userB.attachment)
      : NEUTRAL;

  const valuesScore =
    userA.values && userB.values ? computeValuesScore(userA.values, userB.values) : NEUTRAL;

  const lifeDomainImportanceAlignment = computeLifeDomainAlignment(
    userA.lifeDomainSettings,
    userB.lifeDomainSettings,
  );

  const concreteLifeFit = computeConcreteLifeFit(
    resolveConcreteLife(userA),
    resolveConcreteLife(userB),
    hardFilters,
  );

  const financeScore = computeFinanceAlignment(userA.finance, userB.finance);

  const interviewProcessScore =
    userA.interviewProcess && userB.interviewProcess
      ? computeInterviewProcessScore(userA.interviewProcess, userB.interviewProcess)
      : NEUTRAL;

  const capacityA = computeRelationalCapacity(userA.relationalCapacity);
  const capacityB = computeRelationalCapacity(userB.relationalCapacity);

  const conflictStyleAdjustment =
    userA.conflictStyle && userB.conflictStyle
      ? computeConflictStyleAdjustment(
          userA.conflictStyle,
          userB.conflictStyle,
          CONFLICT_STYLE_SCORE_MAX,
        )
      : 0;

  const psychometricSoftAdjustment = computePsychometricSoftAdjustments(
    userA.psychometricSoft,
    userB.psychometricSoft,
  );

  const anxiousAvoidantSoftPenalty =
    userA.attachment && userB.attachment
      ? computeAnxiousAvoidantSoftPenalty(userA.attachment, userB.attachment)
      : 0;

  const applySoftAdjustments = dealbreakerMultiplier === 1;
  const conflictStyleAdjusted = applySoftAdjustments ? conflictStyleAdjustment : 0;
  const psychometricSoftAdjusted = applySoftAdjustments ? psychometricSoftAdjustment : 0;
  const anxiousAvoidantAdjusted = applySoftAdjustments ? anxiousAvoidantSoftPenalty : 0;
  // Politics, religion, substances, and sex-interest mismatches are owned by concreteLifeFit.
  const politicsAdjusted = 0;
  const alignmentAdjusted = 0;

  const result = computeFinalCompatibilityScoreV3({
    attachmentScore,
    valuesScore,
    lifeDomainImportanceAlignment,
    concreteLifeFitScore: concreteLifeFit.score,
    financeScore,
    interviewProcessScore,
    capacityA,
    capacityB,
    conflictStyleAdjustment: conflictStyleAdjusted,
    politicsAdjustment: politicsAdjusted,
    psychometricSoftAdjustment: psychometricSoftAdjusted,
    anxiousAvoidantSoftPenalty: anxiousAvoidantAdjusted,
    partnerAlignmentAdjustment: alignmentAdjusted,
    dealbreakerMultiplier,
    hardFilters,
  });

  const totalAdjustments =
    conflictStyleAdjusted +
    politicsAdjusted +
    psychometricSoftAdjusted +
    anxiousAvoidantAdjusted +
    alignmentAdjusted;

  const lifestyleDim = concreteLifeFit.dimensions.find((d) => d.id === 'lifestyle_substances');
  const lifestyleScore =
    dealbreakerMultiplier === 0 ? 0 : lifestyleDim?.score ?? NEUTRAL;

  return {
    ...result,
    subscores: {
      attachment: attachmentScore,
      values: valuesScore,
      semantic: 0,
      concreteLifeFit: concreteLifeFit.score,
      lifeDomainImportanceAlignment,
      finance: financeScore,
      interviewProcess: interviewProcessScore,
      capacityA,
      capacityB,
      dealbreakerMultiplier,
    },
    adjustments: {
      sexualComm: 0,
      conflictStyle: conflictStyleAdjusted,
      politics: politicsAdjusted,
      psychometricSoft: psychometricSoftAdjusted,
      total: totalAdjustments,
    },
    domainViews: buildCompatibilityDomainViews({
      lifeDomainAlignment: concreteLifeFit.score,
      valuesScore,
      financeScore,
      intimacyScore: null,
      lifestyleScore,
      relationshipNeedsScore: lifeDomainImportanceAlignment,
      interactionScore: 0,
    }),
  };
}
