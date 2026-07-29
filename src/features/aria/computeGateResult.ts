import { remoteLog } from '@utilities/remoteLog';
import {
  computeGateResultCore,
  type ComputeGateResultOptions,
  type GateResult,
  type GateResultReason,
  GATE_MARKER_BASE_WEIGHTS,
  GATE_MARKER_FLOORS,
  GATE_PASS_WEIGHTED_MIN,
} from './computeGateResultCore';

export {
  GATE_MARKER_BASE_WEIGHTS,
  GATE_MARKER_FLOORS,
  GATE_PASS_WEIGHTED_MIN,
  REFERRAL_WEIGHTED_PASS_MIN,
  type GateFailCode,
  type GateFailDetailJson,
  type GateResult,
  type GateResultReason,
  type ComputeGateResultOptions,
  computeGateResultCore,
  computeInterviewWeightedCompositeFromPillars,
} from './computeGateResultCore';
export {
  SCENARIO_COMPOSITE_PASS_MIN,
  buildScenarioCompositesTriple,
  buildScenarioPillarMapsFromStoredBundles,
  readPillarScoresFromScenarioBundle,
  scenarioCompositesToStorageJson,
  scenarioFloorBreaches,
  type ScenarioCompositesTriple,
  type ScenarioGateIndex,
} from './scenarioCompositeFloor';

/**
 * Gate pass/fail with optional remote breakdown logging (Supabase — not safe in plain Node scripts).
 */
export function computeGateResult(
  pillarScores: Record<string, number | null | undefined>,
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null,
  options?: Pick<
    ComputeGateResultOptions,
    | 'weightedPassMin'
    | 'scenarioPillarScoresByScenario'
    | 'skipPenaltyTotal'
    | 'skipAutoFail'
    | 'egoDevelopmentLevel'
    | 'defensePatterns'
    | 'moment4Concreteness'
    | 'moment5Concreteness'
    | 'personalMomentConcretenessModifier'
    | 'emotionRecognitionRawScore'
    | 'emotionRecognitionCorrectCount'
    | 'disclosureCalibration'
    | 'moment4WordCount'
    | 'moment5WordCount'
    | 'closingIntegration'
    | 'mentalizingOvercertaintyCount'
    | 'precomputedWeightedScore'
    | 'runtimeReviewFlags'
    | 'moment4AccountabilitySituationallyExempt'
    | 'moment4AccountabilityExemptReason'
    | 'emotionRecognitionResponses'
  >,
): GateResult {
  return computeGateResultCore(pillarScores, skepticismModifier, {
    weightedPassMin: options?.weightedPassMin,
    scenarioPillarScoresByScenario: options?.scenarioPillarScoresByScenario,
    skipPenaltyTotal: options?.skipPenaltyTotal,
    skipAutoFail: options?.skipAutoFail,
    egoDevelopmentLevel: options?.egoDevelopmentLevel,
    defensePatterns: options?.defensePatterns,
    moment4Concreteness: options?.moment4Concreteness,
    moment5Concreteness: options?.moment5Concreteness,
    personalMomentConcretenessModifier: options?.personalMomentConcretenessModifier,
    emotionRecognitionRawScore: options?.emotionRecognitionRawScore,
    emotionRecognitionCorrectCount: options?.emotionRecognitionCorrectCount,
    emotionRecognitionResponses: options?.emotionRecognitionResponses,
    disclosureCalibration: options?.disclosureCalibration,
    moment4WordCount: options?.moment4WordCount,
    moment5WordCount: options?.moment5WordCount,
    closingIntegration: options?.closingIntegration,
    mentalizingOvercertaintyCount: options?.mentalizingOvercertaintyCount,
    precomputedWeightedScore: options?.precomputedWeightedScore,
    runtimeReviewFlags: options?.runtimeReviewFlags,
    moment4AccountabilitySituationallyExempt: options?.moment4AccountabilitySituationallyExempt,
    moment4AccountabilityExemptReason: options?.moment4AccountabilityExemptReason,
    onWeightedBreakdown: (data) => {
      void remoteLog('[WEIGHTED_SCORE_BREAKDOWN]', data);
    },
  });
}
