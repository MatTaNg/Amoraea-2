/**
 * Client entry: delegates to edge canonical core; guards psychometrics feature flag locally.
 * @see supabase/functions/_shared/applyPsychometricModifier.ts
 */
export type {
  ApplyPsychometricModifierOptions,
  ApplyPsychometricModifierResult,
} from '../../../supabase/functions/_shared/applyPsychometricModifier';

import { supabase } from '@data/supabase/client';
import {
  applyPsychometricModifierToAttempt as applyPsychometricModifierToAttemptCore,
  type ApplyPsychometricModifierOptions,
  type ApplyPsychometricModifierResult,
} from '../../../supabase/functions/_shared/applyPsychometricModifier';
import { finalizeInterviewOnlyGateForAttempt } from './finalizeInterviewOnlyGate';
import { loadFreshPsychometricFloorScoresForUser } from './loadFreshPsychometricFloorUserRow';
import { collectPsychometricFloorGateFailReasons } from './psychometricFloorBreaches';
import { PSYCHOMETRICS_ENABLED } from './psychometricsFeatureFlags';

async function applyInterviewOnlyGateWithoutPsychometrics(
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<ApplyPsychometricModifierResult> {
  const freshFloorScores = await loadFreshPsychometricFloorScoresForUser(userId);
  if (freshFloorScores) {
    const floorBreachesForLog = collectPsychometricFloorGateFailReasons(freshFloorScores, []);
    if (floorBreachesForLog.length > 0) {
      console.log('[PsychometricModifier] psychometrics disabled — floor breaches logged only', {
        userId,
        attemptId,
        floorBreachesForLog,
      });
    }
  }

  const result = await finalizeInterviewOnlyGateForAttempt(userId, attemptId, options);
  return {
    applied: result.applied,
    skipReason: result.applied ? 'psychometrics_disabled' : result.skipReason,
  };
}

export async function applyPsychometricModifierToAttempt(
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<ApplyPsychometricModifierResult> {
  if (!PSYCHOMETRICS_ENABLED) {
    return applyInterviewOnlyGateWithoutPsychometrics(userId, attemptId, options);
  }

  return applyPsychometricModifierToAttemptCore(supabase, userId, attemptId, options);
}
