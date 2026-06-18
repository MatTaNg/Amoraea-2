import { PILLAR_ROLLUP_ALGORITHM_VERSION } from '../src/features/aria/aggregateMarkerScoresFromSlices';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';
import { GATE_PASS_WEIGHTED_MIN } from '../src/features/aria/computeGateResultCore';
import type { DefenseCrossReferenceResult } from '../src/features/psychometrics/crossReferenceDefenseDetection';
import {
  computeGamingCorrection,
  instrumentComponentsFromModifierResult,
} from '../src/features/psychometrics/computeGamingCorrection';
import { computePsychometricModifier } from '../src/features/psychometrics/computePsychometricModifier';
import { computeUncertaintyScore } from '../src/features/psychometrics/computeUncertaintyScore';
import { mergePsychometricFloorsIntoGateState } from '../src/features/psychometrics/psychometricFloorBreaches';
import {
  coercePsychometricScore,
  psychometricFloorScoresFromUserRow,
  sd3NarcissismResponsesFromUserRow,
  sd3NarcissismScoreFromUserRow,
  userHasPsychometricScoresForScoring,
} from '../src/features/psychometrics/usersPsychometricsSchemaFallback';

/** Raw attempt row from Supabase — superset of fields needed for aggregate + psych recompute. */
export type RawAttemptForAnalytics = {
  id: string;
  user_id: string;
  completed_at: string;
  is_phantom: boolean | null;
  transcript: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_specific_patterns: unknown;
  ego_development_level: unknown;
  language_markers: unknown;
  skip_count: number | string | null;
  skip_penalty_total: number | null;
  auto_failed: boolean | null;
  defense_patterns: unknown;
  mentalizing_overcertainty_count: number | null;
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean | null;
  review_flags: unknown;
  reasoning_pending: boolean | null;
  defense_cross_reference?: unknown;
  probe_log: unknown;
};

export type AnalyticsAttempt = {
  id: string;
  user_id: string;
  completed_at: string;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  modified_weighted_score_with_psychometrics: number | null;
  /** Interview-only gate (before psychometric score modifier / floors). */
  passed: boolean | null;
  final_gate_pass: boolean | null;
  pillar_scores: Record<string, number> | null;
  gate_fail_reasons: string[] | null;
  probe_log: unknown;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  depth_signal_modifier: number | null;
  score_modifier: number | null;
  scenario_composites: Record<string, number> | null;
  disclosure_calibration: string | null;
  ego_development_level: number | null;
  recomputeStatus: 'success' | 'incomplete';
  recomputeNotes: string[];
};

export const ANALYTICS_RECOMPUTE_ALGORITHM = PILLAR_ROLLUP_ALGORITHM_VERSION;

const RECALCULATE_OPTIONS = {
  skipScenarioTranscriptMutations: true,
  usePersistedGateContext: false,
} as const;

function buildRecalculateInput(row: RawAttemptForAnalytics): AdminRecalculateAttemptInput {
  return {
    transcript: row.transcript,
    scenario_1_scores: row.scenario_1_scores,
    scenario_2_scores: row.scenario_2_scores,
    scenario_3_scores: row.scenario_3_scores,
    scenario_specific_patterns: row.scenario_specific_patterns,
    ego_development_level: row.ego_development_level,
    language_markers: row.language_markers,
    skip_count: row.skip_count,
    defense_patterns: row.defense_patterns,
    mentalizing_overcertainty_count: row.mentalizing_overcertainty_count,
    skip_penalty_total: row.skip_penalty_total,
    auto_failed: row.auto_failed,
    personal_moment_emotional_vocab_density: row.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: row.personal_moment_emotional_vocab_low,
  };
}

function buildUncertaintyInput(
  attempt: Record<string, unknown>,
  user: Record<string, unknown>,
  straightLineFlags: string[],
  gamingCorrectionLevel?: number | null,
) {
  const pillars = (attempt.pillar_scores as Record<string, number> | null) ?? null;
  return {
    weighted_score: coercePsychometricScore(attempt.weighted_score),
    pillar_scores: pillars,
    scenario_composites: (attempt.scenario_composites as Record<string, number> | null) ?? null,
    mentalizing_overcertainty_count: coercePsychometricScore(attempt.mentalizing_overcertainty_count),
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
    psychometrics_sd3_narcissism_score: sd3NarcissismScoreFromUserRow(user),
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

function applyPsychometricOverlay(
  interviewAttempt: Record<string, unknown>,
  user: Record<string, unknown> | null,
): {
  modified_weighted_score_with_psychometrics: number | null;
  final_gate_pass: boolean | null;
  gate_fail_reasons: string[];
} {
  const modifiedWeighted =
    typeof interviewAttempt.modified_weighted_score === 'number' &&
    Number.isFinite(interviewAttempt.modified_weighted_score)
      ? interviewAttempt.modified_weighted_score
      : typeof interviewAttempt.weighted_score === 'number' &&
          Number.isFinite(interviewAttempt.weighted_score)
        ? interviewAttempt.weighted_score
        : null;

  const interviewFailReasons = Array.isArray(interviewAttempt.gate_fail_reasons)
    ? (interviewAttempt.gate_fail_reasons as string[])
    : [];

  if (!user || !userHasPsychometricScoresForScoring(user)) {
    const interviewPass = interviewAttempt.passed === true;
    return {
      modified_weighted_score_with_psychometrics: modifiedWeighted,
      final_gate_pass: interviewPass,
      gate_fail_reasons: interviewFailReasons,
    };
  }

  const pillars = (interviewAttempt.pillar_scores as Record<string, number> | null) ?? {};

  const psychResult = computePsychometricModifier(
    {
      brsScore: coercePsychometricScore(user.psychometrics_brs_score),
      anxietyTraitScore: coercePsychometricScore(user.psychometrics_anxiety_trait_score),
      scsSfScore: coercePsychometricScore(user.psychometrics_scs_sf_score),
      gaspScore: coercePsychometricScore(user.psychometrics_gasp_score),
      dweckScore: coercePsychometricScore(user.psychometrics_dweck_score),
      aaq2Score: coercePsychometricScore(user.psychometrics_aaq2_score),
      rsesScore: coercePsychometricScore(user.psychometrics_rses_score),
      sd3NarcissismScore: sd3NarcissismScoreFromUserRow(user),
      npiEntitlementScore: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
      rfqScore: coercePsychometricScore(user.psychometrics_rfq_score),
    },
    {
      disclosureCalibration: interviewAttempt.disclosure_calibration as string | null,
      moment5Concreteness: interviewAttempt.moment_5_concreteness as string | null,
      moment4Concreteness: interviewAttempt.moment_4_concreteness as string | null,
      personalMomentVocabDensity: coercePsychometricScore(
        interviewAttempt.personal_moment_emotional_vocab_density,
      ),
      regulationPillar: pillars.regulation ?? null,
      accountabilityPillar: pillars.accountability ?? null,
      egoDevelopmentLevel: coercePsychometricScore(interviewAttempt.ego_development_level),
      attunementPillar: pillars.attunement ?? null,
      contemptPillar: pillars.contempt ?? null,
      mentalizingPillar: pillars.mentalizing ?? null,
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

  const uncertaintyPass1 = computeUncertaintyScore(
    buildUncertaintyInput(interviewAttempt, user, psychResult.straightLineFlags),
  );

  const gamingCorrection = computeGamingCorrection({
    instrumentComponents: instrumentComponentsFromModifierResult(psychResult),
    totalModifier: psychResult.modifier,
    straightLineFlags: psychResult.straightLineFlags,
    uncertaintyScore: uncertaintyPass1.total,
    pillarScores: {
      mentalizing: pillars.mentalizing ?? null,
      accountability: pillars.accountability ?? null,
      contempt: pillars.contempt ?? null,
      regulation: pillars.regulation ?? null,
    },
    psychometricScores: {
      rfq: coercePsychometricScore(user.psychometrics_rfq_score),
      gasp: coercePsychometricScore(user.psychometrics_gasp_score),
      brs: coercePsychometricScore(user.psychometrics_brs_score),
      scs_sf: coercePsychometricScore(user.psychometrics_scs_sf_score),
      aaq2: coercePsychometricScore(user.psychometrics_aaq2_score),
      rses: coercePsychometricScore(user.psychometrics_rses_score),
      sd3_narcissism: sd3NarcissismScoreFromUserRow(user),
      npi_entitlement: coercePsychometricScore(user.psychometrics_npi_entitlement_score),
      dweck: coercePsychometricScore(user.psychometrics_dweck_score),
    },
  });

  const depthSignalModifiedScore = modifiedWeighted ?? 0;
  const finalModifiedScore =
    Math.round((depthSignalModifiedScore + gamingCorrection.correctedModifier) * 100) / 100;

  const floorScores = psychometricFloorScoresFromUserRow(user);
  const { gateFailReasons: allFailReasons } = mergePsychometricFloorsIntoGateState({
    existingFailReasons: interviewFailReasons,
    existingDetail: null,
    scores: floorScores,
    straightLineFlags: psychResult.straightLineFlags,
    attemptId: String(interviewAttempt.id ?? ''),
    userId: String(interviewAttempt.user_id ?? ''),
  });

  const computedFinalPass =
    allFailReasons.length === 0 && finalModifiedScore >= GATE_PASS_WEIGHTED_MIN;

  return {
    modified_weighted_score_with_psychometrics: finalModifiedScore,
    final_gate_pass: computedFinalPass,
    gate_fail_reasons: allFailReasons,
  };
}

export function recomputeAttemptForAnalytics(
  row: RawAttemptForAnalytics,
  user: Record<string, unknown> | null,
): AnalyticsAttempt {
  const result = recalculateAttemptScoresFromStoredSlices(buildRecalculateInput(row), RECALCULATE_OPTIONS);

  if (result.kind !== 'success') {
    return {
      id: row.id,
      user_id: row.user_id,
      completed_at: row.completed_at,
      weighted_score: result.gate.weightedScore ?? null,
      modified_weighted_score: result.gate.modifiedWeightedScore ?? result.gate.weightedScore ?? null,
      modified_weighted_score_with_psychometrics: null,
      passed: false,
      final_gate_pass: false,
      pillar_scores: null,
      gate_fail_reasons: result.gate.failReasonCodes ?? [],
      probe_log: row.probe_log,
      moment_4_concreteness: null,
      moment_5_concreteness: null,
      depth_signal_modifier: result.gate.depthSignalModifier ?? result.gate.scoreModifier ?? null,
      score_modifier: result.gate.scoreModifier ?? null,
      scenario_composites: null,
      disclosure_calibration: null,
      ego_development_level: null,
      recomputeStatus: 'incomplete',
      recomputeNotes: result.notes,
    };
  }

  const gate = result.gate;
  const interviewAttempt: Record<string, unknown> = {
    id: row.id,
    user_id: row.user_id,
    weighted_score: gate.weightedScore ?? null,
    modified_weighted_score: gate.modifiedWeightedScore ?? gate.weightedScore ?? null,
    passed: gate.pass === true,
    pillar_scores: result.pillar_scores,
    gate_fail_reasons: gate.failReasonCodes ?? [],
    scenario_composites: result.scenarioCompositesJson,
    mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
    defense_patterns: result.defense_patterns,
    disclosure_calibration: result.disclosure_calibration,
    moment_4_concreteness: result.moment_4_concreteness,
    moment_5_concreteness: result.moment_5_concreteness,
    personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
    personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
    ego_development_level: result.ego_development_level,
    review_flags: row.review_flags,
    reasoning_pending: row.reasoning_pending,
    defense_cross_reference: row.defense_cross_reference ?? null,
    scenario_1_scores: row.scenario_1_scores,
    scenario_2_scores: row.scenario_2_scores,
    scenario_3_scores: row.scenario_3_scores,
  };

  const psych = applyPsychometricOverlay(interviewAttempt, user);

  return {
    id: row.id,
    user_id: row.user_id,
    completed_at: row.completed_at,
    weighted_score: gate.weightedScore ?? null,
    modified_weighted_score: gate.modifiedWeightedScore ?? gate.weightedScore ?? null,
    modified_weighted_score_with_psychometrics: psych.modified_weighted_score_with_psychometrics,
    passed: gate.pass === true,
    final_gate_pass: psych.final_gate_pass,
    pillar_scores: result.pillar_scores,
    gate_fail_reasons: psych.gate_fail_reasons,
    probe_log: row.probe_log,
    moment_4_concreteness: result.moment_4_concreteness,
    moment_5_concreteness: result.moment_5_concreteness,
    depth_signal_modifier: gate.depthSignalModifier ?? gate.scoreModifier ?? null,
    score_modifier: gate.scoreModifier ?? null,
    scenario_composites: result.scenarioCompositesJson,
    disclosure_calibration: result.disclosure_calibration,
    ego_development_level: result.ego_development_level,
    recomputeStatus: 'success',
    recomputeNotes: result.notes,
  };
}
