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
} from './computeGateResultCore';
export {
  SCENARIO_COMPOSITE_PASS_MIN,
  buildScenarioCompositesTriple,
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
    'weightedPassMin' | 'scenarioPillarScoresByScenario' | 'skipPenaltyTotal' | 'skipAutoFail'
  >,
): GateResult {
  return computeGateResultCore(pillarScores, skepticismModifier, {
    weightedPassMin: options?.weightedPassMin,
    scenarioPillarScoresByScenario: options?.scenarioPillarScoresByScenario,
    skipPenaltyTotal: options?.skipPenaltyTotal,
    skipAutoFail: options?.skipAutoFail,
    onWeightedBreakdown: (data) => {
      void remoteLog('[WEIGHTED_SCORE_BREAKDOWN]', data);
    },
  });
}
