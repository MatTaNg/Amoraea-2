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
  type GateResult,
  type GateResultReason,
  type ComputeGateResultOptions,
  computeGateResultCore,
} from './computeGateResultCore';

/**
 * Gate pass/fail with optional remote breakdown logging (Supabase — not safe in plain Node scripts).
 */
export function computeGateResult(
  pillarScores: Record<string, number | null | undefined>,
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null,
): GateResult {
  return computeGateResultCore(pillarScores, skepticismModifier, {
    onWeightedBreakdown: (data) => {
      void remoteLog('[WEIGHTED_SCORE_BREAKDOWN]', data);
    },
  });
}
