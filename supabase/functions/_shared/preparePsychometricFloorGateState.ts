import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist.ts';
import {
  loadFreshPsychometricFloorUserRow,
  userRowHasPsychometricFloorScores,
} from './loadFreshPsychometricFloorUserRow.ts';
import { mergePsychometricFloorsIntoGateState } from './psychometricFloorBreaches.ts';
import { psychometricFloorScoresFromUserRow } from './usersPsychometricsSchemaFallback.ts';

export type PreparePsychometricFloorGateStateOptions = {
  forceApply?: boolean;
  attemptId?: string;
  userId?: string;
};

export type PreparePsychometricFloorGateStateSuccess = {
  gateFailReasons: string[];
  gateFailDetail: Record<string, unknown>;
  floorBreaches: string[];
};

export type PreparePsychometricFloorGateStateResult =
  | PreparePsychometricFloorGateStateSuccess
  | { skipReason: string };

/**
 * Merge psychometric instrument floors into interview gate state.
 * Used by admin recalculation (first persist) and applyPsychometricModifier.
 */
export async function preparePsychometricFloorGateState(
  supabase: import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient,
  userId: string,
  existingFailReasons: string[],
  existingDetail: Record<string, unknown> | null | undefined,
  options?: PreparePsychometricFloorGateStateOptions,
): Promise<PreparePsychometricFloorGateStateResult> {
  const userRow = await loadFreshPsychometricFloorUserRow(userId, supabase);
  if (!userRow) {
    return { skipReason: 'user_row_not_found' };
  }

  const hasCompletedAt = userRow.psychometrics_completed_at != null;
  const hasStoredScores = userRowHasPsychometricFloorScores(userRow);
  if (!options?.forceApply && !hasCompletedAt && !hasStoredScores) {
    return { skipReason: 'psychometrics_not_complete' };
  }
  if (!hasStoredScores) {
    return { skipReason: 'psychometric_scores_missing' };
  }

  const floorScores = psychometricFloorScoresFromUserRow(userRow);
  const priorDetail = normalizeGateFailDetailForPersist(existingDetail);
  const { gateFailReasons, gateFailDetail } = mergePsychometricFloorsIntoGateState({
    existingFailReasons,
    existingDetail: priorDetail,
    scores: floorScores,
    straightLineFlags: [],
    attemptId: options?.attemptId,
    userId: options?.userId ?? userId,
  });

  const floorBreaches = gateFailReasons.filter(
    (code) => !existingFailReasons.includes(code),
  );

  return {
    gateFailReasons,
    gateFailDetail: normalizeGateFailDetailForPersist(gateFailDetail),
    floorBreaches,
  };
}
