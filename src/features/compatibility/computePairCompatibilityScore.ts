import {
  computeAttachmentScore,
  computeConflictStyleAdjustment,
  computeDealbreakerMultiplier,
  computeFinalCompatibilityScore,
  computeFinanceAlignment,
  computeInterviewProcessScore,
  computeLifeDomainAlignment,
  computePoliticsAdjustment,
  computePsychometricSoftAdjustments,
  computeRelationalCapacity,
  computeSemanticScore,
  computeValuesScore,
  type CompatibilityResult,
} from './computeCompatibilityScore';
import { sexualCommunicationPairAdjustment } from './sexualCommunicationCompatibility';
import type { MappedUserCompatibilityInputs } from './mapMatchmakingUserToCompatibilityInputs';

const NEUTRAL = 0.5;
const CONFLICT_STYLE_SCORE_MAX = 100;

export type PairCompatibilitySubscores = {
  attachment: number;
  values: number;
  semantic: number;
  finance: number;
  interviewProcess: number;
  capacityA: number;
  capacityB: number;
  dealbreakerMultiplier: 0 | 1;
};

export type PairCompatibilityAdjustments = {
  sexualComm: number;
  conflictStyle: number;
  politics: number;
  psychometricSoft: number;
  total: number;
};

export type PairCompatibilityResult = CompatibilityResult & {
  subscores: PairCompatibilitySubscores;
  adjustments: PairCompatibilityAdjustments;
};

export function computePairCompatibilityScore(
  userA: MappedUserCompatibilityInputs,
  userB: MappedUserCompatibilityInputs,
  options?: { narrativeFitScore?: number },
): PairCompatibilityResult {
  const dealbreakerMultiplier = computeDealbreakerMultiplier(userA.dealbreaker, userB.dealbreaker);

  const attachmentScore =
    userA.attachment && userB.attachment
      ? computeAttachmentScore(userA.attachment, userB.attachment)
      : NEUTRAL;

  const valuesScore =
    userA.values && userB.values ? computeValuesScore(userA.values, userB.values) : NEUTRAL;

  const lifeDomainAlignment = computeLifeDomainAlignment(
    userA.lifeDomainSettings,
    userB.lifeDomainSettings,
  );
  const narrativeFitScore = options?.narrativeFitScore ?? NEUTRAL;
  const semanticScore = computeSemanticScore(lifeDomainAlignment, narrativeFitScore);

  const financeScore = computeFinanceAlignment(userA.finance, userB.finance);

  const interviewProcessScore =
    userA.interviewProcess && userB.interviewProcess
      ? computeInterviewProcessScore(userA.interviewProcess, userB.interviewProcess)
      : NEUTRAL;

  const capacityA = computeRelationalCapacity(userA.relationalCapacity);
  const capacityB = computeRelationalCapacity(userB.relationalCapacity);

  const sexualComm =
    userA.sexualCommunicationMean != null && userB.sexualCommunicationMean != null
      ? sexualCommunicationPairAdjustment(
          userA.sexualCommunicationMean,
          userB.sexualCommunicationMean,
        ).adjustment
      : 0;

  const conflictStyleAdjustment =
    userA.conflictStyle && userB.conflictStyle
      ? computeConflictStyleAdjustment(
          userA.conflictStyle,
          userB.conflictStyle,
          CONFLICT_STYLE_SCORE_MAX,
        )
      : 0;

  const politicsAdjustment = computePoliticsAdjustment(userA.politics, userB.politics);

  const psychometricSoftAdjustment = computePsychometricSoftAdjustments(
    userA.psychometricSoft,
    userB.psychometricSoft,
  );

  const result = computeFinalCompatibilityScore({
    attachmentScore,
    valuesScore,
    semanticScore,
    financeScore,
    interviewProcessScore,
    capacityA,
    capacityB,
    interviewWeightedScoreA: userA.interviewWeightedScore,
    interviewWeightedScoreB: userB.interviewWeightedScore,
    sexualCommAdjustment: sexualComm,
    conflictStyleAdjustment,
    politicsAdjustment,
    psychometricSoftAdjustment,
    dealbreakerMultiplier,
  });

  const totalAdjustments =
    sexualComm + conflictStyleAdjustment + politicsAdjustment + psychometricSoftAdjustment;

  return {
    ...result,
    subscores: {
      attachment: attachmentScore,
      values: valuesScore,
      semantic: semanticScore,
      finance: financeScore,
      interviewProcess: interviewProcessScore,
      capacityA,
      capacityB,
      dealbreakerMultiplier,
    },
    adjustments: {
      sexualComm,
      conflictStyle: conflictStyleAdjustment,
      politics: politicsAdjustment,
      psychometricSoft: psychometricSoftAdjustment,
      total: totalAdjustments,
    },
  };
}
