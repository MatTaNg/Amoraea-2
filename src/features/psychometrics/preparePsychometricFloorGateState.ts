import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist';
import { PSYCHOMETRICS_ENABLED } from './psychometricsFeatureFlags';
import {
  loadFreshPsychometricFloorUserRow,
  userRowHasPsychometricFloorScores,
} from './loadFreshPsychometricFloorUserRow';
import { mergePsychometricFloorsIntoGateState } from './psychometricFloorBreaches';
import { psychometricFloorScoresFromUserRow } from './usersPsychometricsSchemaFallback';

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

async function loadUserRowForPsychometricFloors(
  userId: string,
): Promise<Record<string, unknown> | null> {
  for (const select of [
    PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT,
    PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT_LEGACY_SD3,
  ]) {
    const { data, error } = await supabase.from('users').select(select).eq('id', userId).single();
    if (!error && data) {
      return data as Record<string, unknown>;
    }
    if (error && !isMissingUsersPsychometricsSd3ColumnsError(error)) {
      console.warn('[PsychometricFloor] user select failed:', error.message);
      break;
    }
  }
  return null;
}

/**
 * Merge psychometric instrument floors into interview gate state.
 * Used by admin recalculation (first persist) and applyPsychometricModifier.
 */
export async function preparePsychometricFloorGateState(
  userId: string,
  existingFailReasons: string[],
  existingDetail: Record<string, unknown> | null | undefined,
  options?: PreparePsychometricFloorGateStateOptions,
): Promise<PreparePsychometricFloorGateStateResult> {
  if (!PSYCHOMETRICS_ENABLED) {
    return { skipReason: 'psychometrics_disabled' };
  }

  const userRow = await loadFreshPsychometricFloorUserRow(userId);
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
