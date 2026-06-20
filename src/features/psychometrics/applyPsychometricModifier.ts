import { supabase } from '@data/supabase/client';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import { isInterviewAttemptsMissingGamingCorrectionColumnsError } from '@utilities/fetchInterviewAttemptRevealSnapshot';
import type { DefenseCrossReferenceResult } from './crossReferenceDefenseDetection';
import {
  coercePsychometricScore,
  isMissingUsersPsychometricsSd3ColumnsError,
  sd3NarcissismResponsesFromUserRow,
  sd3NarcissismScoreFromUserRow,
  userHasPsychometricScoresForScoring,
} from './usersPsychometricsSchemaFallback';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist';
import { loadFreshPsychometricFloorScoresForUser } from './loadFreshPsychometricFloorUserRow';
import {
  computeGamingCorrection,
  gamingCorrectionForStorage,
  instrumentComponentsFromModifierResult,
} from './computeGamingCorrection';
import { computePsychometricModifier } from './computePsychometricModifier';
import {
  computeUncertaintyScore,
  isUncertaintyBreakdownPopulated,
  logUncertaintyBreakdownBeforePersist,
  uncertaintyBreakdownForStorage,
} from './computeUncertaintyScore';
import {
  collectPsychometricFloorGateFailReasons,
  mergePsychometricFloorsIntoGateState,
} from './psychometricFloorBreaches';
import { SD3_NARCISSISM_FLOOR_FAIL_CODE } from './sd3NarcissismFloor';
import {
  LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG,
} from './legacyPsychometricReview';
import { finalizeInterviewOnlyGateForAttempt } from './finalizeInterviewOnlyGate';
import { PSYCHOMETRICS_ENABLED } from './psychometricsFeatureFlags';

export type ApplyPsychometricModifierOptions = {
  /**
   * Legacy backfill after interview: keep `passed` true when psychometrics would flip pass → fail;
   * scores and modifier are still persisted for admin review.
   */
  preservePassIfPreviouslyPassing?: boolean;
  /**
   * Admin recalculation / backfill: apply floors when psychometric scores exist even if
   * `psychometrics_completed_at` was never written.
   */
  forceApply?: boolean;
};

export type ApplyPsychometricModifierResult = {
  applied: boolean;
  skipReason?: string;
};

function finiteNumberOrNull(v: unknown): number | null {
  return coercePsychometricScore(v);
}

const PSYCHOMETRIC_USER_SELECT = `
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_score,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_gasp_guilt_repair_score,
  psychometrics_gasp_shame_withdraw_score,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_responses,
  psychometrics_scs_private_responses,
  psychometrics_mspss_friends_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_responses,
  psychometrics_sd3_narcissism_score,
  psychometrics_sd3_narcissism_responses,
  psychometrics_npi_entitlement_score,
  psychometrics_npi_entitlement_responses,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`;

const PSYCHOMETRIC_USER_SELECT_LEGACY_SD3 = `
  psychometrics_brs_score,
  psychometrics_brs_responses,
  psychometrics_anxiety_trait_score,
  psychometrics_anxiety_trait_responses,
  psychometrics_scs_sf_score,
  psychometrics_scs_sf_responses,
  psychometrics_gasp_score,
  psychometrics_gasp_responses,
  psychometrics_gasp_guilt_repair_score,
  psychometrics_gasp_shame_withdraw_score,
  psychometrics_dweck_score,
  psychometrics_dweck_responses,
  psychometrics_aaq2_score,
  psychometrics_rses_score,
  psychometrics_scs_public_score,
  psychometrics_scs_private_score,
  psychometrics_aaq2_responses,
  psychometrics_rses_responses,
  psychometrics_scs_public_responses,
  psychometrics_scs_private_responses,
  psychometrics_mspss_friends_score,
  psychometrics_mspss_family_score,
  psychometrics_mspss_responses,
  psychometrics_narq_s_score,
  psychometrics_narq_s_responses,
  psychometrics_npi_entitlement_score,
  psychometrics_npi_entitlement_responses,
  psychometrics_rfq_score,
  psychometrics_rfq_responses,
  psychometrics_completed_at
`;

/** Floor gating reads fresh score columns from `users` — see loadFreshPsychometricFloorScoresForUser. */

const ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_BASE = `
  user_id,
  weighted_score,
  modified_weighted_score,
  pillar_scores,
  disclosure_calibration,
  moment_5_concreteness,
  moment_4_concreteness,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  ego_development_level,
  passed,
  gate_fail_reasons,
  gate_fail_detail,
  scenario_composites,
  mentalizing_overcertainty_count,
  defense_patterns,
  review_flags,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  reasoning_pending
`;

const ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_WITH_DEFENSE = `${ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_BASE},
  defense_cross_reference`;

function isMissingDefenseCrossReferenceColumnError(err: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!err) return false;
  const parts = [err.message, err.details, err.hint, String(err.code ?? '')].filter(Boolean).join(' ');
  if (String(err.code) === 'PGRST204' && parts.includes('defense_cross_reference')) return true;
  if (String(err.code) === '42703' && parts.includes('defense_cross_reference')) return true;
  return (
    parts.includes('defense_cross_reference') &&
    (parts.includes('does not exist') || parts.includes('schema cache'))
  );
}

function buildUncertaintyInput(
  attempt: Record<string, unknown>,
  user: Record<string, unknown>,
  straightLineFlags: string[],
  gamingCorrectionLevel?: number | null,
) {
  const pillars = (attempt.pillar_scores as Record<string, number> | null) ?? null;
  return {
    weighted_score: finiteNumberOrNull(attempt.weighted_score),
    pillar_scores: pillars,
    scenario_composites: (attempt.scenario_composites as Record<string, number> | null) ?? null,
    mentalizing_overcertainty_count: finiteNumberOrNull(attempt.mentalizing_overcertainty_count),
    defense_patterns: (attempt.defense_patterns as Record<string, boolean> | null) ?? null,
    review_flags: Array.isArray(attempt.review_flags) ? (attempt.review_flags as string[]) : null,
    personal_moment_emotional_vocab_low:
      attempt.personal_moment_emotional_vocab_low === true ? true : null,
    disclosure_calibration:
      typeof attempt.disclosure_calibration === 'string' ? attempt.disclosure_calibration : null,
    scenario_1_scores: (attempt.scenario_1_scores as Record<string, unknown> | null) ?? null,
    scenario_2_scores: (attempt.scenario_2_scores as Record<string, unknown> | null) ?? null,
    scenario_3_scores: (attempt.scenario_3_scores as Record<string, unknown> | null) ?? null,
    psychometric_straight_line_flags: straightLineFlags,
    psychometrics_gasp_externalization_score: coercePsychometricScore(user.psychometrics_gasp_score),
    psychometrics_aaq2_score: coercePsychometricScore(user.psychometrics_aaq2_score),
    psychometrics_brs_score: coercePsychometricScore(user.psychometrics_brs_score),
    psychometrics_anxiety_trait_score: coercePsychometricScore(user.psychometrics_anxiety_trait_score),
    psychometrics_rses_score: coercePsychometricScore(user.psychometrics_rses_score),
    psychometrics_scs_sf_score: coercePsychometricScore(user.psychometrics_scs_sf_score),
    psychometrics_dweck_score: coercePsychometricScore(user.psychometrics_dweck_score),
    psychometrics_sd3_narcissism_score: sd3NarcissismScoreFromUserRow(user as Record<string, unknown>),
    psychometrics_npi_entitlement_score: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
    psychometrics_rfq_score: coercePsychometricScore(user.psychometrics_rfq_score),
    psychometrics_scs_public_score: coercePsychometricScore(user.psychometrics_scs_public_score),
    psychometrics_scs_private_score: coercePsychometricScore(user.psychometrics_scs_private_score),
    reasoning_pending: attempt.reasoning_pending === true,
    defenseCrossReference:
      (attempt.defense_cross_reference as DefenseCrossReferenceResult | null) ?? null,
    gamingCorrectionLevel,
  };
}

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

  let userRow: Record<string, unknown> | null = null;
  /** Prefer SD3 columns first — legacy-only select omits `psychometrics_sd3_narcissism_score` and can hide floor triggers. */
  for (const select of [PSYCHOMETRIC_USER_SELECT, PSYCHOMETRIC_USER_SELECT_LEGACY_SD3]) {
    const { data, error } = await supabase.from('users').select(select).eq('id', userId).single();
    if (!error && data) {
      userRow = data as Record<string, unknown>;
      break;
    }
    if (error && !isMissingUsersPsychometricsSd3ColumnsError(error)) {
      console.warn('[PsychometricModifier] user select failed:', error);
      break;
    }
  }

  if (!userRow) {
    console.warn('[PsychometricModifier] no user data found for', userId);
    return { applied: false, skipReason: 'user_row_not_found' };
  }

  const hasCompletedAt = userRow.psychometrics_completed_at != null;
  const hasStoredScores = userHasPsychometricScoresForScoring(userRow);
  if (!options?.forceApply && !hasCompletedAt && !hasStoredScores) {
    console.log('[PsychometricModifier] psychometrics not yet complete — interview-only gate');
    return finalizeInterviewOnlyGateForAttempt(userId, attemptId, options);
  }
  if (!options?.forceApply && !hasCompletedAt && hasStoredScores) {
    console.log(
      '[PsychometricModifier] psychometrics_completed_at missing but scores present — applying floors',
      { userId, attemptId },
    );
  }

  let user = userRow as Record<string, unknown>;

  let attemptRes = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_WITH_DEFENSE)
    .eq('id', attemptId)
    .single();
  if (attemptRes.error && isMissingDefenseCrossReferenceColumnError(attemptRes.error)) {
    attemptRes = await supabase
      .from('interview_attempts')
      .select(ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_BASE)
      .eq('id', attemptId)
      .single();
  }
  const attempt = attemptRes.data;

  if (!attempt) {
    console.warn('[PsychometricModifier] no attempt found for', attemptId);
    return { applied: false, skipReason: 'attempt_not_found' };
  }

  const attemptUserId =
    typeof attempt.user_id === 'string' && attempt.user_id.length > 0 ? attempt.user_id : userId;
  if (attemptUserId !== userId) {
    console.warn('[PsychometricModifier] userId mismatch — using attempt.user_id for floor evaluation', {
      passedUserId: userId,
      attemptUserId,
      attemptId,
    });
  }

  if (!hasStoredScores) {
    console.log('[PsychometricModifier] psychometric scores missing — interview-only gate');
    return finalizeInterviewOnlyGateForAttempt(userId, attemptId, options);
  }

  const pillars = (attempt.pillar_scores as Record<string, number> | null) ?? {};

  const result = computePsychometricModifier(
    {
      brsScore: user.psychometrics_brs_score as number | null,
      anxietyTraitScore: user.psychometrics_anxiety_trait_score as number | null,
      scsSfScore: user.psychometrics_scs_sf_score as number | null,
      gaspScore: user.psychometrics_gasp_score as number | null,
      dweckScore: user.psychometrics_dweck_score as number | null,
      aaq2Score: user.psychometrics_aaq2_score as number | null,
      rsesScore: user.psychometrics_rses_score as number | null,
      sd3NarcissismScore: sd3NarcissismScoreFromUserRow(user),
      npiEntitlementScore: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
      rfqScore: coercePsychometricScore(user.psychometrics_rfq_score),
    },
    {
      disclosureCalibration: attempt.disclosure_calibration as string | null,
      moment5Concreteness: attempt.moment_5_concreteness as string | null,
      moment4Concreteness: attempt.moment_4_concreteness as string | null,
      personalMomentVocabDensity: attempt.personal_moment_emotional_vocab_density as number | null,
      regulationPillar: pillars.regulation,
      accountabilityPillar: pillars.accountability,
      egoDevelopmentLevel: attempt.ego_development_level as number | null,
      attunementPillar: pillars.attunement,
      contemptPillar: pillars.contempt,
      mentalizingPillar: pillars.mentalizing,
    },
    {
      brs: user.psychometrics_brs_responses as Record<number, number> | undefined,
      anxiety_trait: user.psychometrics_anxiety_trait_responses as Record<number, number> | undefined,
      scs_sf: user.psychometrics_scs_sf_responses as Record<number, number> | undefined,
      gasp: user.psychometrics_gasp_responses as Record<number, number> | undefined,
      dweck: user.psychometrics_dweck_responses as Record<number, number> | undefined,
      aaq2: user.psychometrics_aaq2_responses as Record<number, number> | undefined,
      rses: user.psychometrics_rses_responses as Record<number, number> | undefined,
      sd3_narcissism: sd3NarcissismResponsesFromUserRow(user) as Record<number, number> | undefined,
      rfq: user.psychometrics_rfq_responses as Record<number, number> | undefined,
    },
  );

  const straightLineFlags = result.straightLineFlags;

  const uncertaintyBreakdownPass1 = computeUncertaintyScore(
    buildUncertaintyInput(attempt, user, straightLineFlags),
  );

  const gamingCorrection = computeGamingCorrection({
    instrumentComponents: instrumentComponentsFromModifierResult(result),
    totalModifier: result.modifier,
    straightLineFlags,
    uncertaintyScore: uncertaintyBreakdownPass1.total,
    pillarScores: {
      mentalizing: pillars.mentalizing ?? null,
      accountability: pillars.accountability ?? null,
      contempt: pillars.contempt ?? null,
      regulation: pillars.regulation ?? null,
    },
    psychometricScores: {
      rfq: user.psychometrics_rfq_score as number | null,
      gasp: user.psychometrics_gasp_score as number | null,
      brs: user.psychometrics_brs_score as number | null,
      scs_sf: user.psychometrics_scs_sf_score as number | null,
      aaq2: user.psychometrics_aaq2_score as number | null,
      rses: user.psychometrics_rses_score as number | null,
      sd3_narcissism: sd3NarcissismScoreFromUserRow(user),
      npi_entitlement: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
      dweck: user.psychometrics_dweck_score as number | null,
    },
  });

  const correctedPsychometricModifier = gamingCorrection.correctedModifier;

  const uncertaintyBreakdownPass2 = computeUncertaintyScore(
    buildUncertaintyInput(
      attempt,
      user,
      straightLineFlags,
      gamingCorrection.correctionLevel,
    ),
  );

  const depthSignalModifiedScore =
    finiteNumberOrNull(attempt.modified_weighted_score) ?? finiteNumberOrNull(attempt.weighted_score);
  if (depthSignalModifiedScore == null) {
    console.warn('[PsychometricModifier] interview rollup missing — refusing to finalize psychometric gate', {
      userId,
      attemptId,
    });
    return { applied: false, skipReason: 'interview_scores_not_ready' };
  }
  const finalModifiedScore =
    Math.round((depthSignalModifiedScore + correctedPsychometricModifier) * 100) / 100;

  const existingFailReasons = Array.isArray(attempt.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as string[])
    : [];
  const existingDetail =
    attempt.gate_fail_detail != null &&
    typeof attempt.gate_fail_detail === 'object' &&
    !Array.isArray(attempt.gate_fail_detail)
      ? (attempt.gate_fail_detail as Record<string, unknown>)
      : null;

  const freshFloorScores = await loadFreshPsychometricFloorScoresForUser(attemptUserId);
  if (!freshFloorScores) {
    console.warn('[PsychometricModifier] fresh psychometric floor scores unavailable — interview-only gate', {
      attemptUserId,
      attemptId,
    });
    return finalizeInterviewOnlyGateForAttempt(userId, attemptId, options);
  }

  console.log('[PsychometricModifier] fresh floor scores loaded from DB', {
    attemptUserId,
    attemptId,
    floorScores: freshFloorScores,
  });

  const { gateFailReasons: allFailReasons, gateFailDetail } = mergePsychometricFloorsIntoGateState({
    existingFailReasons,
    existingDetail,
    scores: freshFloorScores,
    straightLineFlags,
    attemptId,
    userId: attemptUserId,
  });
  const floorBreaches = collectPsychometricFloorGateFailReasons(freshFloorScores, straightLineFlags);
  console.log('[PsychometricModifier] gate_fail_detail.psychometric_floors shape', {
    isArray: Array.isArray(gateFailDetail.psychometric_floors),
    keys:
      gateFailDetail.psychometric_floors && typeof gateFailDetail.psychometric_floors === 'object'
        ? Object.keys(gateFailDetail.psychometric_floors as object)
        : null,
    sd3InReasons: allFailReasons.includes(SD3_NARCISSISM_FLOOR_FAIL_CODE),
    floorBreaches,
    floorScoresSd3: freshFloorScores.sd3NarcissismScore,
  });

  const interviewGatePass =
    allFailReasons.length === 0 && depthSignalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
  const computedFinalPass = interviewGatePass && finalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
  const wasPreviouslyPassing = attempt.passed === true;
  const wouldFlipPassToFail =
    options?.preservePassIfPreviouslyPassing === true &&
    wasPreviouslyPassing &&
    !computedFinalPass;

  const existingReviewFlags = Array.isArray(attempt.review_flags)
    ? (attempt.review_flags as string[])
    : [];
  const reviewFlagsForPersist = wouldFlipPassToFail
    ? [...new Set([...existingReviewFlags, LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG])]
    : existingReviewFlags;

  const finalPass = wouldFlipPassToFail ? true : computedFinalPass;

  if (wouldFlipPassToFail) {
    console.log(
      '[PsychometricModifier] legacy backfill — preserving passed=true; flagged for admin review',
      { userId, attemptId, computedFinalPass, finalModifiedScore },
    );
  }

  await supabase
    .from('users')
    .update({
      psychometric_modifier: result.modifier,
      psychometric_consistency_flags: result.consistencyFlags,
      psychometric_straight_line_flags: result.straightLineFlags,
    })
    .eq('id', userId);

  const gamingCorrectionStored = gamingCorrectionForStorage(gamingCorrection);
  const uncertaintyForDb = isUncertaintyBreakdownPopulated(uncertaintyBreakdownPass2)
    ? uncertaintyBreakdownForStorage(uncertaintyBreakdownPass2)
    : null;

  if (uncertaintyForDb) {
    logUncertaintyBreakdownBeforePersist(attemptId, uncertaintyBreakdownPass2);
  }

  const attemptUpdateBase: Record<string, unknown> = {
      psychometric_modifier_applied: result.modifier,
      modified_weighted_score_with_psychometrics: finalModifiedScore,
      final_gate_pass: finalPass,
      gate_fail_reasons: allFailReasons,
    gate_fail_detail: normalizeGateFailDetailForPersist(gateFailDetail),
      passed: finalPass,
    review_flags: reviewFlagsForPersist,
    ...(uncertaintyForDb
      ? {
          uncertainty_score: uncertaintyForDb.total,
          uncertainty_breakdown: uncertaintyForDb,
        }
      : {}),
  };

  let { error } = await supabase
    .from('interview_attempts')
    .update({
      ...attemptUpdateBase,
      corrected_psychometric_modifier: correctedPsychometricModifier,
      gaming_correction: gamingCorrectionStored,
    })
    .eq('id', attemptId);

  if (error && isInterviewAttemptsMissingGamingCorrectionColumnsError(error)) {
    console.warn(
      '[PsychometricModifier] gaming correction columns missing — persisting corrected final score without gaming_correction jsonb',
    );
    ({ error } = await supabase.from('interview_attempts').update(attemptUpdateBase).eq('id', attemptId));
  }

  if (error) {
    console.error('[PsychometricModifier] failed to persist:', error);
    return { applied: false, skipReason: `persist_failed: ${error.message}` };
  }

    console.log(
    '[PsychometricModifier] applied — raw modifier:',
      result.modifier,
    'corrected modifier:',
    correctedPsychometricModifier,
    'gaming level:',
    gamingCorrection.correctionLevel,
      'depthModified:',
      depthSignalModifiedScore,
      'finalModified:',
      finalModifiedScore,
      'finalPass:',
      finalPass,
    'floorBreaches:',
    floorBreaches,
    );
  return { applied: true };
}
