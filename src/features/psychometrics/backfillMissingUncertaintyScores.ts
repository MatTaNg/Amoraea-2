import { supabase } from '@data/supabase/client';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import {
  computeUncertaintyScore,
  isUncertaintyBreakdownPopulated,
  logUncertaintyBreakdownBeforePersist,
  uncertaintyBreakdownForStorage,
} from './computeUncertaintyScore';
import {
  buildUsersPsychometricUncertaintyScoresSelect,
  coercePsychometricScore,
  psychometricFloorScoresFromUserRow,
  sd3NarcissismScoreFromUserRow,
} from './usersPsychometricsSchemaFallback';
import { mergePsychometricFloorsIntoGateState } from './psychometricFloorBreaches';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist';

function finiteNumberOrNull(v: unknown): number | null {
  return coercePsychometricScore(v);
}

/** Recompute and persist uncertainty for attempts missing score or breakdown (admin-only). */
export async function backfillMissingUncertaintyScores(limit = 25): Promise<number> {
  const { data: attempts, error } = await supabase
    .from('interview_attempts')
    .select(
      `
      id,
      user_id,
      weighted_score,
      pillar_scores,
      scenario_composites,
      mentalizing_overcertainty_count,
      defense_patterns,
      review_flags,
      personal_moment_emotional_vocab_low,
      disclosure_calibration,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      reasoning_pending,
      uncertainty_score,
      uncertainty_breakdown,
      gate_fail_reasons,
      gate_fail_detail
    `,
    )
    .not('completed_at', 'is', null)
    .or('uncertainty_score.is.null,uncertainty_breakdown.is.null')
    .limit(limit);

  if (error || !attempts?.length) {
    if (error) console.warn('[UncertaintyBackfill]', error.message);
    return 0;
  }

  let updated = 0;
  for (const row of attempts) {
    const attempt = row as Record<string, unknown>;
    const userId = attempt.user_id as string;

    const { data: userPsych } = await supabase
      .from('users')
      .select(buildUsersPsychometricUncertaintyScoresSelect())
      .eq('id', userId)
      .maybeSingle();

    const straightLineRaw = (userPsych as { psychometric_straight_line_flags?: unknown } | null)
      ?.psychometric_straight_line_flags;
    const straightLineFlags = Array.isArray(straightLineRaw)
      ? straightLineRaw.filter((f): f is string => typeof f === 'string')
      : null;

    const up = userPsych as Record<string, unknown> | null;
    const gamingCorrectionLevel =
      (attempt.gaming_correction as { correctionLevel?: number } | null)?.correctionLevel ?? 0;

    const breakdown = computeUncertaintyScore({
      weighted_score: finiteNumberOrNull(attempt.weighted_score),
      pillar_scores: (attempt.pillar_scores as Record<string, number> | null) ?? null,
      scenario_composites: (attempt.scenario_composites as Record<string, number> | null) ?? null,
      mentalizing_overcertainty_count: finiteNumberOrNull(attempt.mentalizing_overcertainty_count),
      defense_patterns: (attempt.defense_patterns as Record<string, boolean> | null) ?? null,
      review_flags: Array.isArray(attempt.review_flags)
        ? (attempt.review_flags as string[])
        : null,
      personal_moment_emotional_vocab_low:
        attempt.personal_moment_emotional_vocab_low === true ? true : null,
      disclosure_calibration:
        typeof attempt.disclosure_calibration === 'string' ? attempt.disclosure_calibration : null,
      scenario_1_scores: (attempt.scenario_1_scores as Record<string, unknown> | null) ?? null,
      scenario_2_scores: (attempt.scenario_2_scores as Record<string, unknown> | null) ?? null,
      scenario_3_scores: (attempt.scenario_3_scores as Record<string, unknown> | null) ?? null,
      psychometric_straight_line_flags: straightLineFlags,
      psychometrics_gasp_externalization_score: finiteNumberOrNull(up?.psychometrics_gasp_score),
      psychometrics_aaq2_score: finiteNumberOrNull(up?.psychometrics_aaq2_score),
      psychometrics_brs_score: finiteNumberOrNull(up?.psychometrics_brs_score),
      psychometrics_rses_score: finiteNumberOrNull(up?.psychometrics_rses_score),
      psychometrics_scs_sf_score: finiteNumberOrNull(up?.psychometrics_scs_sf_score),
      psychometrics_dweck_score: finiteNumberOrNull(up?.psychometrics_dweck_score),
      psychometrics_sd3_narcissism_score: sd3NarcissismScoreFromUserRow(up ?? {}),
      psychometrics_rfq_score: finiteNumberOrNull(up?.psychometrics_rfq_score),
      reasoning_pending: attempt.reasoning_pending === true,
      defenseCrossReference:
        (attempt.defense_cross_reference as import('./crossReferenceDefenseDetection').DefenseCrossReferenceResult | null) ??
        null,
      gamingCorrectionLevel,
    });

    if (!isUncertaintyBreakdownPopulated(breakdown)) {
      console.warn('[UncertaintyBackfill] invalid breakdown for attempt', attempt.id);
      continue;
    }

    logUncertaintyBreakdownBeforePersist(String(attempt.id), breakdown);
    const breakdownForDb = uncertaintyBreakdownForStorage(breakdown);

    const existingFailReasons = Array.isArray(attempt.gate_fail_reasons)
      ? (attempt.gate_fail_reasons as string[]).filter((x): x is string => typeof x === 'string')
      : [];
    const existingDetail =
      attempt.gate_fail_detail != null &&
      typeof attempt.gate_fail_detail === 'object' &&
      !Array.isArray(attempt.gate_fail_detail)
        ? (attempt.gate_fail_detail as Record<string, unknown>)
        : null;

    const { gateFailReasons, gateFailDetail } = mergePsychometricFloorsIntoGateState({
      existingFailReasons,
      existingDetail,
      scores: psychometricFloorScoresFromUserRow(up ?? {}),
      straightLineFlags,
    });

    const depthModified =
      typeof attempt.modified_weighted_score === 'number' && Number.isFinite(attempt.modified_weighted_score)
        ? attempt.modified_weighted_score
        : typeof attempt.weighted_score === 'number' && Number.isFinite(attempt.weighted_score)
          ? attempt.weighted_score
          : 0;
    const finalModified =
      typeof attempt.modified_weighted_score_with_psychometrics === 'number' &&
      Number.isFinite(attempt.modified_weighted_score_with_psychometrics)
        ? attempt.modified_weighted_score_with_psychometrics
        : depthModified;

    const { error: upErr } = await supabase
      .from('interview_attempts')
      .update({
        uncertainty_score: breakdown.total,
        uncertainty_breakdown: breakdownForDb,
        gate_fail_reasons: gateFailReasons,
        gate_fail_detail: normalizeGateFailDetailForPersist(gateFailDetail),
        final_gate_pass: gateFailReasons.length === 0 && finalModified >= GATE_PASS_WEIGHTED_MIN,
        passed: gateFailReasons.length === 0 && finalModified >= GATE_PASS_WEIGHTED_MIN,
      })
      .eq('id', attempt.id as string);

    if (!upErr) updated++;
  }

  if (updated > 0) {
    console.log(`[UncertaintyBackfill] updated ${updated} attempt(s)`);
  }
  return updated;
}
