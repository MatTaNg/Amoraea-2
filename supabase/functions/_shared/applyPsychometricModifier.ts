import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { GATE_PASS_WEIGHTED_MIN } from './computeGateResultCore.ts';
import type { DefenseCrossReferenceResult } from './crossReferenceDefenseDetection.ts';
import {
  computeGamingCorrection,
  gamingCorrectionForStorage,
  instrumentComponentsFromModifierResult,
} from './computeGamingCorrection.ts';
import { computePsychometricModifier } from './computePsychometricModifier.ts';
import {
  computeUncertaintyScore,
  isUncertaintyBreakdownPopulated,
  logUncertaintyBreakdownBeforePersist,
  uncertaintyBreakdownForStorage,
} from './computeUncertaintyScore.ts';
import {
  collectPsychometricFloorGateFailReasons,
  mergePsychometricFloorsIntoGateState,
} from './psychometricFloorBreaches.ts';
import { SD3_NARCISSISM_FLOOR_FAIL_CODE } from './sd3NarcissismFloor.ts';
import { LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG } from './legacyPsychometricReview.ts';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist.ts';
import {
  coercePsychometricScore,
  isMissingUsersPsychometricsSd3ColumnsError,
  psychometricFloorScoresFromUserRow,
  sd3NarcissismResponsesFromUserRow,
  sd3NarcissismScoreForFloorFromUserRow,
  sd3NarcissismScoreFromUserRow,
  userHasPsychometricScoresForScoring,
} from './usersPsychometricsSchemaFallback.ts';

export type ApplyPsychometricModifierOptions = {
  preservePassIfPreviouslyPassing?: boolean;
  forceApply?: boolean;
};

export type ApplyPsychometricModifierResult = {
  applied: boolean;
  skipReason?: string;
};

function mergeScsResponses(
  publicResponses: Record<number, number> | null | undefined,
  privateResponses: Record<number, number> | null | undefined,
): Record<number, number> | undefined {
  if (!publicResponses && !privateResponses) return undefined;
  return { ...(publicResponses ?? {}), ...(privateResponses ?? {}) };
}

function finiteNumberOrNull(v: unknown): number | null {
  return coercePsychometricScore(v);
}

const PSYCHOMETRIC_USER_SELECT_WITH_SD3 =
  'psychometrics_brs_score, psychometrics_brs_responses, psychometrics_anxiety_trait_score, psychometrics_anxiety_trait_responses, psychometrics_scs_sf_score, psychometrics_scs_sf_responses, psychometrics_gasp_score, psychometrics_gasp_responses, psychometrics_gasp_guilt_repair_score, psychometrics_gasp_shame_withdraw_score, psychometrics_dweck_score, psychometrics_dweck_responses, psychometrics_aaq2_score, psychometrics_rses_score, psychometrics_scs_public_score, psychometrics_scs_private_score, psychometrics_aaq2_responses, psychometrics_rses_responses, psychometrics_scs_public_responses, psychometrics_scs_private_responses, psychometrics_mspss_friends_score, psychometrics_mspss_family_score, psychometrics_mspss_responses, psychometrics_sd3_narcissism_score, psychometrics_sd3_narcissism_responses, psychometrics_narq_s_score, psychometrics_narq_s_responses, psychometrics_rfq_score, psychometrics_rfq_responses, psychometrics_completed_at';

const PSYCHOMETRIC_USER_SELECT_LEGACY_SD3 =
  'psychometrics_brs_score, psychometrics_brs_responses, psychometrics_anxiety_trait_score, psychometrics_anxiety_trait_responses, psychometrics_scs_sf_score, psychometrics_scs_sf_responses, psychometrics_gasp_score, psychometrics_gasp_responses, psychometrics_gasp_guilt_repair_score, psychometrics_gasp_shame_withdraw_score, psychometrics_dweck_score, psychometrics_dweck_responses, psychometrics_aaq2_score, psychometrics_rses_score, psychometrics_scs_public_score, psychometrics_scs_private_score, psychometrics_aaq2_responses, psychometrics_rses_responses, psychometrics_scs_public_responses, psychometrics_scs_private_responses, psychometrics_mspss_friends_score, psychometrics_mspss_family_score, psychometrics_mspss_responses, psychometrics_narq_s_score, psychometrics_narq_s_responses, psychometrics_rfq_score, psychometrics_rfq_responses, psychometrics_completed_at';

/** Floor gating reads `psychometrics_sd3_narcissism_score` only — refresh immediately before merge. */
async function refreshSd3NarcissismScoreOnUserRowForFloor(
  supabase: SupabaseClient,
  userId: string,
  userRow: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from('users')
    .select('psychometrics_sd3_narcissism_score, psychometrics_narq_s_score')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[PsychometricModifier] fresh psychometrics_sd3_narcissism_score read failed:', error.message);
    return userRow;
  }
  const freshSd3 = coercePsychometricScore(data?.psychometrics_sd3_narcissism_score);
  const cachedSd3 = sd3NarcissismScoreForFloorFromUserRow(userRow);
  if (freshSd3 != null && freshSd3 !== cachedSd3) {
    console.log('[PsychometricModifier] refreshed psychometrics_sd3_narcissism_score from DB', {
      userId,
      cachedSd3,
      freshSd3,
    });
  }
  if (freshSd3 == null) {
    const narqOnly = coercePsychometricScore(data?.psychometrics_narq_s_score ?? userRow.psychometrics_narq_s_score);
    if (narqOnly != null) {
      console.log(
        '[PsychometricModifier] psychometrics_sd3_narcissism_score null on DB — floor will not use psychometrics_narq_s_score',
        { userId, psychometrics_narq_s_score: narqOnly },
      );
    }
  }
  return {
    ...userRow,
    psychometrics_sd3_narcissism_score:
      data?.psychometrics_sd3_narcissism_score ?? userRow.psychometrics_sd3_narcissism_score,
  };
}

const ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_BASE =
  'weighted_score, modified_weighted_score, pillar_scores, disclosure_calibration, moment_5_concreteness, moment_4_concreteness, personal_moment_emotional_vocab_density, personal_moment_emotional_vocab_low, ego_development_level, passed, gate_fail_reasons, gate_fail_detail, scenario_composites, mentalizing_overcertainty_count, defense_patterns, review_flags, scenario_1_scores, scenario_2_scores, scenario_3_scores, reasoning_pending';

const ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_WITH_DEFENSE = `${ATTEMPT_SELECT_FOR_PSYCHOMETRIC_SCORING_BASE}, defense_cross_reference`;

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
  const sd3Score = sd3NarcissismScoreFromUserRow(user);
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
    psychometrics_rses_score: coercePsychometricScore(user.psychometrics_rses_score),
    psychometrics_scs_sf_score: coercePsychometricScore(user.psychometrics_scs_sf_score),
    psychometrics_dweck_score: coercePsychometricScore(user.psychometrics_dweck_score),
    psychometrics_sd3_narcissism_score: sd3Score,
    psychometrics_rfq_score: coercePsychometricScore(user.psychometrics_rfq_score),
    reasoning_pending: attempt.reasoning_pending === true,
    defenseCrossReference:
      (attempt.defense_cross_reference as DefenseCrossReferenceResult | null) ?? null,
    gamingCorrectionLevel,
  };
}

export async function applyPsychometricModifierToAttempt(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<ApplyPsychometricModifierResult> {
  let userRow: Record<string, unknown> | null = null;
  /** Prefer SD3 columns first — legacy-only select omits `psychometrics_sd3_narcissism_score` and can hide floor triggers. */
  for (const select of [PSYCHOMETRIC_USER_SELECT_WITH_SD3, PSYCHOMETRIC_USER_SELECT_LEGACY_SD3]) {
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

  if (!userRow?.psychometrics_completed_at) {
    console.log('[PsychometricModifier] psychometrics not yet complete — skipping', {
      userId,
      attemptId,
      hadUserRow: userRow != null,
    });
    return;
  }

  if (!userRow) {
    console.warn('[PsychometricModifier] no user data found for', userId);
    return;
  }

  const user = userRow;
  const sd3ScoreEffective = sd3NarcissismScoreFromUserRow(user);
  const rfqScore = coercePsychometricScore(user.psychometrics_rfq_score);

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

  if (!hasStoredScores) {
    console.log('[PsychometricModifier] psychometric scores missing — skipping');
    return { applied: false, skipReason: 'psychometric_scores_missing' };
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
      scsPublicScore: user.psychometrics_scs_public_score as number | null,
      scsPrivateScore: user.psychometrics_scs_private_score as number | null,
      mspssFriendsScore: user.psychometrics_mspss_friends_score as number | null,
      mspssFamilyScore: user.psychometrics_mspss_family_score as number | null,
      sd3NarcissismScore: sd3ScoreEffective,
      rfqScore,
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
      scs: mergeScsResponses(
        user.psychometrics_scs_public_responses as Record<number, number> | undefined,
        user.psychometrics_scs_private_responses as Record<number, number> | undefined,
      ),
      mspss: user.psychometrics_mspss_responses as Record<number, number> | undefined,
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
      rfq: rfqScore,
      gasp: user.psychometrics_gasp_score as number | null,
      brs: user.psychometrics_brs_score as number | null,
      scs_sf: user.psychometrics_scs_sf_score as number | null,
      aaq2: user.psychometrics_aaq2_score as number | null,
      rses: user.psychometrics_rses_score as number | null,
      sd3_narcissism: sd3ScoreEffective,
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
    (attempt.modified_weighted_score as number | null) ?? (attempt.weighted_score as number | null) ?? 0;
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

  const userBeforeRefresh = user;
  user = await refreshSd3NarcissismScoreOnUserRowForFloor(supabase, userId, user);
  console.log('[PsychometricModifier] refreshSd3NarcissismScoreOnUserRowForFloor', {
    userId,
    attemptId,
    cachedSd3: sd3NarcissismScoreForFloorFromUserRow(userBeforeRefresh),
    afterRefreshSd3: sd3NarcissismScoreForFloorFromUserRow(user),
    rawAfter: user.psychometrics_sd3_narcissism_score,
    changed: userBeforeRefresh.psychometrics_sd3_narcissism_score !== user.psychometrics_sd3_narcissism_score,
  });
  const floorScores = psychometricFloorScoresFromUserRow(user);
  console.log(
    '[PsychometricModifier] floorScores.sd3NarcissismScore before mergePsychometricFloorsIntoGateState:',
    floorScores.sd3NarcissismScore,
    {
      userId,
      attemptId,
      psychometrics_sd3_narcissism_score_raw: user.psychometrics_sd3_narcissism_score,
    },
  );

  const { gateFailReasons: allFailReasons, gateFailDetail } = mergePsychometricFloorsIntoGateState({
    existingFailReasons,
    existingDetail,
    scores: floorScores,
    straightLineFlags,
    aaq2Score: user.psychometrics_aaq2_score as number | null,
    rsesScore: user.psychometrics_rses_score as number | null,
    attemptId,
    userId,
  });
  const floorBreaches = collectPsychometricFloorGateFailReasons(floorScores, straightLineFlags, {
    aaq2Score: user.psychometrics_aaq2_score as number | null,
    rsesScore: user.psychometrics_rses_score as number | null,
  });
  console.log('[PsychometricModifier] gate_fail_detail.psychometric_floors shape', {
    isArray: Array.isArray(gateFailDetail.psychometric_floors),
    keys:
      gateFailDetail.psychometric_floors && typeof gateFailDetail.psychometric_floors === 'object'
        ? Object.keys(gateFailDetail.psychometric_floors as object)
        : null,
    sd3InReasons: allFailReasons.includes(SD3_NARCISSISM_FLOOR_FAIL_CODE),
    floorBreaches,
    floorScoresSd3: floorScores.sd3NarcissismScore,
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
    logUncertaintyBreakdownBeforePersist(attemptId, uncertaintyBreakdownPass2, console.log);
  }

  const { error } = await supabase
    .from('interview_attempts')
    .update({
      psychometric_modifier_applied: result.modifier,
      corrected_psychometric_modifier: correctedPsychometricModifier,
      gaming_correction: gamingCorrectionStored,
      modified_weighted_score_with_psychometrics: finalModifiedScore,
      final_gate_pass: finalPass,
      gate_fail_reasons: allFailReasons,
      gate_fail_detail: gateFailDetail,
      passed: finalPass,
      review_flags: reviewFlagsForPersist,
      ...(uncertaintyForDb
        ? {
            uncertainty_score: uncertaintyForDb.total,
            uncertainty_breakdown: uncertaintyForDb,
          }
        : {}),
    })
    .eq('id', attemptId);

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
    'gateFailReasons:',
    allFailReasons,
    'floorBreaches:',
    floorBreaches,
  );
  return { applied: true };
}
