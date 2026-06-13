import { supabase } from '@data/supabase/client';

import type { PsychometricFloorUserScores } from './psychometricFloorBreaches';
import {
  isMissingUsersPsychometricsSd3ColumnsError,
  psychometricFloorScoresFromUserRow,
  PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT,
  PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT_LEGACY_SD3,
  userHasPsychometricScoresForScoring,
} from './usersPsychometricsSchemaFallback';

type UsersQueryClient = Pick<typeof supabase, 'from'>;

/**
 * Always read psychometric score columns from `users` for floor gating — never use cached in-memory rows.
 */
export async function loadFreshPsychometricFloorUserRow(
  userId: string,
  client: UsersQueryClient = supabase,
): Promise<Record<string, unknown> | null> {
  if (!userId) return null;

  for (const select of [
    PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT,
    PSYCHOMETRIC_FLOOR_SCORES_USER_SELECT_LEGACY_SD3,
  ]) {
    const { data, error } = await client.from('users').select(select).eq('id', userId).single();
    if (!error && data) {
      return data as Record<string, unknown>;
    }
    if (error && !isMissingUsersPsychometricsSd3ColumnsError(error)) {
      console.warn('[PsychometricFloor] fresh user select failed:', error.message, { userId });
      break;
    }
  }
  return null;
}

export async function loadFreshPsychometricFloorScoresForUser(
  userId: string,
  client: UsersQueryClient = supabase,
): Promise<PsychometricFloorUserScores | null> {
  const row = await loadFreshPsychometricFloorUserRow(userId, client);
  if (!row) return null;
  return psychometricFloorScoresFromUserRow(row);
}

export function userRowHasPsychometricFloorScores(row: Record<string, unknown>): boolean {
  return userHasPsychometricScoresForScoring(row);
}
