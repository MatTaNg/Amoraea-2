import { supabase } from '@data/supabase/client';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateSuccess,
} from '@features/aria/adminRecalculateAttemptScores';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import {
  attemptRowMissingInterviewModifiers,
  defaultModifierFieldsFromWeightedScore,
  interviewModifierFieldsFromGateResult,
} from '@features/aria/interviewModifierPersist';
import {
  isDefensePatternsShapeIncomplete,
  normalizeDefensePatternsForPersist,
} from '@features/aria/defensePatternsDetection';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist';
import {
  attemptRowMissingRollupArtifacts,
  evaluateScoringStagesReadyForRollup,
  tryRunInterviewRollupWhenStagesComplete,
} from './ensureInterviewRollupArtifacts';
import { ensureGateFailReasonsForFailedInterviewGate } from './gateFailReasonsNormalize';
import { isPsychometricGateFailFloorCode } from './psychometricFloorBreaches';
import { LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG } from './legacyPsychometricReview';
import type { ApplyPsychometricModifierOptions } from './applyPsychometricModifier';

export type FinalizeInterviewOnlyGateResult = {
  applied: boolean;
  skipReason?: string;
  rollupPersisted?: boolean;
};

const ATTEMPT_SELECT_ROLLUP = `
  id,
  user_id,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  skip_count,
  ego_development_level,
  language_markers,
  defense_patterns,
  disclosure_calibration,
  mentalizing_overcertainty_count,
  skip_penalty_total,
  auto_failed,
  moment_4_concreteness,
  moment_5_concreteness,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  weighted_score,
  modified_weighted_score,
  depth_signal_modifier,
  score_modifier,
  passed,
  gate_fail_reasons,
  gate_fail_detail,
  review_flags,
  final_gate_pass,
  psychometric_modifier_applied,
  modified_weighted_score_with_psychometrics,
  gate_result_finalized_at,
  scenario_composites,
  defense_cross_reference,
  defense_patterns,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  transcript
`;

const ATTEMPT_SELECT_GATE_ONLY = `
  user_id,
  weighted_score,
  modified_weighted_score,
  depth_signal_modifier,
  score_modifier,
  passed,
  gate_fail_reasons,
  gate_fail_detail,
  review_flags,
  final_gate_pass,
  psychometric_modifier_applied,
  gate_result_finalized_at,
  scenario_composites,
  defense_cross_reference,
  defense_patterns,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  transcript
`;

type RollupPersistResult = {
  rollupPersisted: boolean;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  depth_signal_modifier: number | null;
  score_modifier: number | null;
};

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function rollupPayloadFromSuccess(result: AdminRecalculateSuccess): Record<string, unknown> {
  const modifierFields = interviewModifierFieldsFromGateResult(result.gate);
  return {
    pillar_scores: result.pillar_scores,
    weighted_score: result.gate.weightedScore,
    passed: result.gate.pass,
    gate_fail_reasons: result.gate.failReasonCodes ?? [],
    gate_fail_detail: normalizeGateFailDetailForPersist(result.gate.failReasonDetail),
    review_flags: result.gate.reviewFlags ?? [],
    mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
    defense_patterns: normalizeDefensePatternsForPersist(result.defense_patterns),
    moment_4_concreteness: result.moment_4_concreteness ?? result.gate.moment4Concreteness ?? null,
    moment_5_concreteness: result.moment_5_concreteness ?? result.gate.moment5Concreteness ?? null,
    personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
    ...modifierFields,
    disclosure_calibration: result.disclosure_calibration,
    ego_development_level: result.ego_development_level,
    incomplete_reason: null,
  };
}

/**
 * Recompute weighted_score / pillar_scores / interview modifiers from stored slices when any are missing.
 */
async function persistInterviewRollupFromStoredSlicesIfNeeded(
  attemptId: string,
): Promise<RollupPersistResult> {
  const emptyRollup: RollupPersistResult = {
    rollupPersisted: false,
    weighted_score: null,
    modified_weighted_score: null,
    depth_signal_modifier: null,
    score_modifier: null,
  };
  const { data: row, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_ROLLUP)
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !row) {
    return emptyRollup;
  }

  const attempt = row as Record<string, unknown>;
  const existingWeighted = finiteNumber(attempt.weighted_score);
  const existingModified = finiteNumber(attempt.modified_weighted_score);
  const existingDepthModifier = finiteNumber(attempt.depth_signal_modifier);
  const existingScoreModifier = finiteNumber(attempt.score_modifier);
  const modifiersComplete = !attemptRowMissingInterviewModifiers(attempt);

  if (existingWeighted != null && existingModified != null && modifiersComplete && !attemptRowMissingRollupArtifacts(attempt)) {
    return {
      rollupPersisted: false,
      weighted_score: existingWeighted,
      modified_weighted_score: existingModified,
      depth_signal_modifier: existingDepthModifier ?? 0,
      score_modifier: existingScoreModifier ?? 0,
    };
  }

  const result = recalculateAttemptScoresFromStoredSlices(
    {
      transcript: attempt.transcript,
      scenario_1_scores: attempt.scenario_1_scores,
      scenario_2_scores: attempt.scenario_2_scores,
      scenario_3_scores: attempt.scenario_3_scores,
      scenario_specific_patterns: attempt.scenario_specific_patterns,
      skip_count: attempt.skip_count as number | string | null | undefined,
      ego_development_level: attempt.ego_development_level,
      language_markers: attempt.language_markers,
      defense_patterns: attempt.defense_patterns,
      disclosure_calibration: attempt.disclosure_calibration,
      mentalizing_overcertainty_count: attempt.mentalizing_overcertainty_count as number | null,
      skip_penalty_total: attempt.skip_penalty_total as number | null,
      auto_failed: attempt.auto_failed as boolean | null,
      moment_4_concreteness: attempt.moment_4_concreteness,
      moment_5_concreteness: attempt.moment_5_concreteness,
      personal_moment_emotional_vocab_density: attempt.personal_moment_emotional_vocab_density as number | null,
      personal_moment_emotional_vocab_low: attempt.personal_moment_emotional_vocab_low as boolean | null,
      persisted_weighted_score: existingWeighted,
    },
    { skipScenarioTranscriptMutations: true, usePersistedGateContext: true },
  );

  if (result.kind !== 'success') {
    if (existingWeighted != null) {
      const fallback = defaultModifierFieldsFromWeightedScore(existingWeighted);
      return {
        rollupPersisted: false,
        weighted_score: existingWeighted,
        modified_weighted_score: existingModified ?? fallback.modified_weighted_score,
        depth_signal_modifier: existingDepthModifier ?? fallback.depth_signal_modifier,
        score_modifier: existingScoreModifier ?? fallback.score_modifier,
      };
    }
    return {
      rollupPersisted: false,
      weighted_score: existingWeighted,
      modified_weighted_score: existingModified,
      depth_signal_modifier: existingDepthModifier,
      score_modifier: existingScoreModifier,
    };
  }

  const modifierFields = interviewModifierFieldsFromGateResult(result.gate);

  const { error: upErr } = await supabase
    .from('interview_attempts')
    .update(rollupPayloadFromSuccess(result))
    .eq('id', attemptId);

  if (upErr) {
    console.warn('[InterviewOnlyGate] rollup persist failed:', upErr.message);
    return {
      rollupPersisted: false,
      weighted_score: finiteNumber(result.gate.weightedScore) ?? existingWeighted,
      modified_weighted_score: modifierFields.modified_weighted_score ?? existingModified,
      depth_signal_modifier: modifierFields.depth_signal_modifier,
      score_modifier: modifierFields.score_modifier,
    };
  }

  return {
    rollupPersisted: true,
    weighted_score: finiteNumber(result.gate.weightedScore),
    modified_weighted_score: modifierFields.modified_weighted_score,
    depth_signal_modifier: modifierFields.depth_signal_modifier,
    score_modifier: modifierFields.score_modifier,
  };
}

/**
 * Persist interview-only gate result when standard psychometrics are not yet complete.
 * Leaves psychometric_modifier_applied / modified_weighted_score_with_psychometrics / gate_result_finalized_at null.
 */
export async function finalizeInterviewOnlyGateForAttempt(
  userId: string,
  attemptId: string,
  options?: ApplyPsychometricModifierOptions,
): Promise<FinalizeInterviewOnlyGateResult> {
  console.log(`[rollup] Starting interview-only gate for attempt ${attemptId}`);
  const rollup = await persistInterviewRollupFromStoredSlicesIfNeeded(attemptId);

  let attemptRes = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT_GATE_ONLY)
    .eq('id', attemptId)
    .single();
  let attempt = attemptRes.data as Record<string, unknown> | null;
  if (!attempt) {
    console.warn('[InterviewOnlyGate] no attempt found', attemptId);
    return { applied: false, skipReason: 'attempt_not_found' };
  }

  if (attemptRowMissingRollupArtifacts(attempt)) {
    const stages = evaluateScoringStagesReadyForRollup(attempt);
    if (!stages.ready) {
      console.log('[gate] client interview-only gate deferred rollup', {
        attemptId,
        missing: stages.missing,
      });
    } else {
      console.log('[rollup] Backfilling missing artifacts via gated full rollup', attemptId);
      const result = await tryRunInterviewRollupWhenStagesComplete(supabase, attemptId, userId, {
        force: true,
        trigger: 'client_finalizeInterviewOnlyGate:backfill',
      });
      if (result.ok) {
        const { data: refreshed } = await supabase
          .from('interview_attempts')
          .select(ATTEMPT_SELECT_GATE_ONLY)
          .eq('id', attemptId)
          .single();
        if (refreshed) attempt = refreshed as Record<string, unknown>;
      } else {
        console.warn('[rollup] Gated backfill did not complete', {
          attemptId,
          skipped: result.skipped ?? null,
          error: result.error ?? null,
        });
      }
    }
  }

  const attemptAfterRollup = attempt;

  if (attemptAfterRollup.gate_result_finalized_at != null) {
    return { applied: false, skipReason: 'psychometric_gate_already_finalized' };
  }

  if (attemptAfterRollup.psychometric_modifier_applied != null && finiteNumber(attemptAfterRollup.psychometric_modifier_applied) !== 0) {
    return { applied: false, skipReason: 'psychometric_modifier_already_applied' };
  }

  const depthSignalModifiedScore =
    finiteNumber(attemptAfterRollup.modified_weighted_score) ??
    rollup.modified_weighted_score ??
    finiteNumber(attemptAfterRollup.weighted_score) ??
    rollup.weighted_score;

  if (depthSignalModifiedScore == null) {
    return { applied: false, skipReason: 'interview_scores_not_ready', rollupPersisted: rollup.rollupPersisted };
  }

  const modifierFieldsForPersist = {
    depth_signal_modifier:
      finiteNumber(attemptAfterRollup.depth_signal_modifier) ?? rollup.depth_signal_modifier ?? 0,
    score_modifier: finiteNumber(attemptAfterRollup.score_modifier) ?? rollup.score_modifier ?? 0,
    modified_weighted_score: depthSignalModifiedScore,
  };

  const existingFailReasons = Array.isArray(attemptAfterRollup.gate_fail_reasons)
    ? (attemptAfterRollup.gate_fail_reasons as string[])
    : [];
  const interviewFailReasons = existingFailReasons.filter((code) => !isPsychometricGateFailFloorCode(code));

  const existingDetail =
    attemptAfterRollup.gate_fail_detail != null &&
    typeof attemptAfterRollup.gate_fail_detail === 'object' &&
    !Array.isArray(attemptAfterRollup.gate_fail_detail)
      ? (attemptAfterRollup.gate_fail_detail as Record<string, unknown>)
      : null;
  const normalizedDetail = normalizeGateFailDetailForPersist(existingDetail);
  const { psychometric_floors: _ignoredPsychFloors, ...detailWithoutPsychFloors } = normalizedDetail;
  const gateFailDetail = normalizeGateFailDetailForPersist({
    ...detailWithoutPsychFloors,
    psychometric_floors: {},
  });

  const interviewGatePass =
    interviewFailReasons.length === 0 && depthSignalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
  const computedFinalPass = interviewGatePass;
  const normalizedGate = ensureGateFailReasonsForFailedInterviewGate({
    gateFailReasons: interviewFailReasons,
    depthSignalModifiedScore,
    finalGatePass: computedFinalPass,
    gateFailDetail,
  });
  const gateFailReasonsForPersist = normalizedGate.gateFailReasons;
  const gateFailDetailForPersist = normalizeGateFailDetailForPersist(normalizedGate.gateFailDetail);
  console.log('[rollup] Evaluating interview-only gate', {
    attemptId,
    depthSignalModifiedScore,
    finalGatePass: computedFinalPass,
    gateFailReasons: gateFailReasonsForPersist,
  });
  const wasPreviouslyPassing = attemptAfterRollup.passed === true;
  const wouldFlipPassToFail =
    options?.preservePassIfPreviouslyPassing === true &&
    wasPreviouslyPassing &&
    !computedFinalPass;

  const existingReviewFlags = Array.isArray(attemptAfterRollup.review_flags)
    ? (attemptAfterRollup.review_flags as string[])
    : [];
  const reviewFlagsForPersist = wouldFlipPassToFail
    ? [...new Set([...existingReviewFlags, LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG])]
    : existingReviewFlags;

  const finalPass = wouldFlipPassToFail ? true : computedFinalPass;

  const attemptUpdate: Record<string, unknown> = {
    ...modifierFieldsForPersist,
    final_gate_pass: finalPass,
    gate_fail_reasons: gateFailReasonsForPersist,
    gate_fail_detail: gateFailDetailForPersist,
    passed: finalPass,
    review_flags: reviewFlagsForPersist,
  };

  const { error } = await supabase.from('interview_attempts').update(attemptUpdate).eq('id', attemptId);

  if (error) {
    console.error('[InterviewOnlyGate] persist failed:', error);
    return { applied: false, skipReason: `persist_failed: ${error.message}`, rollupPersisted: rollup.rollupPersisted };
  }

  // Gated full rollup after gate write (idempotent; no-ops if stages incomplete or already complete).
  const stages = evaluateScoringStagesReadyForRollup(attemptAfterRollup);
  if (stages.ready) {
    await tryRunInterviewRollupWhenStagesComplete(supabase, attemptId, userId, {
      trigger: 'client_finalizeInterviewOnlyGate:after_gate_write',
    });
  }

  console.log('[rollup] Interview-only gate complete', {
    userId,
    attemptId,
    depthSignalModifiedScore,
    finalPass,
    gateFailReasons: gateFailReasonsForPersist,
    rollupPersisted: rollup.rollupPersisted,
  });

  return { applied: true, skipReason: 'psychometrics_pending', rollupPersisted: rollup.rollupPersisted };
}
