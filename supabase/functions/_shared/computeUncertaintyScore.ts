import {
  UNCERTAINTY_GATE_PROXIMITY_SCORE,
  UNCERTAINTY_ROUTING_THRESHOLD,
} from '../../../src/config/psychometrics/uncertaintyAndGaming.ts';

// Computes an uncertainty score from 0.0 to 1.0 for a completed interview attempt.
import { collectPsychometricFloorUncertaintyFlags } from './psychometricFloorBreaches.ts';
import { NPI_ENTITLEMENT_ENABLED } from './psychometricsFeatureFlags.ts';
import type { DefenseCrossReferenceResult } from './crossReferenceDefenseDetection.ts';

export interface UncertaintyBreakdown {
  total: number;
  components: {
    thresholdProximity: number;
    consistencyFlags: number;
    depthSignalConcerns: number;
    scoreRecovery: number;
    scenarioVariance: number;
    straightLineFlags: number;
    gamingCorrection: number;
  };
  activeFlags: string[];
}

export function computeUncertaintyScore(attempt: {
  weighted_score: number | null;
  pillar_scores: Record<string, number> | null;
  scenario_composites: Record<string, number> | null;
  mentalizing_overcertainty_count: number | null;
  defense_patterns: Record<string, boolean> | null;
  review_flags: string[] | null;
  personal_moment_emotional_vocab_low: boolean | null;
  disclosure_calibration: string | null;
  scenario_1_scores: Record<string, unknown> | null;
  scenario_2_scores: Record<string, unknown> | null;
  scenario_3_scores: Record<string, unknown> | null;
  psychometric_straight_line_flags: string[] | null;
  psychometrics_gasp_externalization_score: number | null;
  psychometrics_aaq2_score: number | null;
  psychometrics_brs_score: number | null;
  psychometrics_anxiety_trait_score: number | null;
  psychometrics_rses_score: number | null;
  psychometrics_scs_sf_score: number | null;
  psychometrics_dweck_score: number | null;
  psychometrics_sd3_narcissism_score: number | null;
  psychometrics_npi_entitlement_score: number | null;
  psychometrics_rfq_score: number | null;
  psychometrics_scs_public_score: number | null;
  psychometrics_scs_private_score: number | null;
  reasoning_pending: boolean | null;
  defenseCrossReference?: DefenseCrossReferenceResult | null;
  /** Pass 2 only — gaming correction level from computeGamingCorrection (breaks circular dependency). */
  gamingCorrectionLevel?: number | null;
}): UncertaintyBreakdown {
  let uncertainty = 0;
  const activeFlags: string[] = [];

  const score = attempt.weighted_score ?? 0;
  const distance = Math.abs(score - UNCERTAINTY_GATE_PROXIMITY_SCORE);
  const thresholdProximity = Math.max(0, 1.0 - distance / 1.5);
  uncertainty += thresholdProximity;
  if (thresholdProximity > 0.3) {
    activeFlags.push(`score_near_threshold (${score.toFixed(2)})`);
  }

  let consistencyFlagCount = 0;
  const pillars = attempt.pillar_scores ?? {};

  const gasp = attempt.psychometrics_gasp_externalization_score;
  const accountability = pillars.accountability ?? null;
  if (gasp !== null && accountability !== null) {
    if (gasp >= 5.0 && accountability >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('gasp_accountability_divergence');
    }
  }

  const aaq2 = attempt.psychometrics_aaq2_score;
  const regulation = pillars.regulation ?? null;
  if (aaq2 !== null && regulation !== null) {
    if (aaq2 >= 35 && regulation >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('aaq2_regulation_divergence');
    }
  }

  const attunement = pillars.attunement ?? null;
  if (aaq2 !== null && attunement !== null) {
    if (aaq2 >= 35 && attunement >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('aaq2_attunement_divergence');
    }
  }

  const brs = attempt.psychometrics_brs_score;
  if (brs !== null && regulation !== null) {
    if (brs < 2.5 && regulation >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('brs_regulation_divergence');
    }
  }

  const rses = attempt.psychometrics_rses_score;
  if (rses !== null && accountability !== null) {
    if (rses <= 15 && accountability >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('rses_accountability_divergence');
    }
  }

  const scsSf = attempt.psychometrics_scs_sf_score;
  if (scsSf !== null && accountability !== null) {
    if (scsSf < 2.0 && accountability >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('scs_sf_accountability_divergence');
    }
  }

  const dweck = attempt.psychometrics_dweck_score;
  const commitment = pillars.commitment_threshold ?? null;
  if (dweck !== null && commitment !== null) {
    if (dweck < 2.5 && commitment >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('dweck_commitment_divergence');
    }
  }

  const sd3 = attempt.psychometrics_sd3_narcissism_score;
  const npi = attempt.psychometrics_npi_entitlement_score;
  const contempt = pillars.contempt ?? null;
  if (!NPI_ENTITLEMENT_ENABLED && sd3 !== null && contempt !== null) {
    if (sd3 > 3.5 && contempt < 5.0) {
      consistencyFlagCount++;
      activeFlags.push('sd3_narcissism_contempt_divergence');
    }
  }

  if (NPI_ENTITLEMENT_ENABLED && npi !== null && accountability !== null) {
    if (npi >= 4 && accountability >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('npi_entitlement_accountability_divergence');
    }
  }

  const floorUncertaintyFlags = collectPsychometricFloorUncertaintyFlags(
    {
      rfqScore: attempt.psychometrics_rfq_score,
      gaspScore: attempt.psychometrics_gasp_externalization_score,
      dweckScore: attempt.psychometrics_dweck_score,
      scsSfScore: attempt.psychometrics_scs_sf_score,
      sd3NarcissismScore: sd3,
      npiEntitlementScore: npi,
      brsScore: attempt.psychometrics_brs_score,
      anxietyTraitScore: attempt.psychometrics_anxiety_trait_score,
      aaq2Score: attempt.psychometrics_aaq2_score,
      rsesScore: attempt.psychometrics_rses_score,
      scsPublicScore: attempt.psychometrics_scs_public_score,
      scsPrivateScore: attempt.psychometrics_scs_private_score,
    },
    attempt.psychometric_straight_line_flags,
  );
  for (const flag of floorUncertaintyFlags) {
    activeFlags.push(flag);
  }

  const rfq = attempt.psychometrics_rfq_score;
  const mentalizing = pillars.mentalizing ?? null;
  if (rfq !== null && mentalizing !== null) {
    if (rfq < 3.5 && mentalizing >= 7.0) {
      consistencyFlagCount++;
      activeFlags.push('rfq_mentalizing_divergence_low_self_report');
    }
    if (rfq >= 5.5 && mentalizing <= 4.0) {
      consistencyFlagCount++;
      activeFlags.push('rfq_mentalizing_divergence_high_self_report');
    }
  }

  const consistencyFlagUncertainty = consistencyFlagCount * 0.15;
  uncertainty += consistencyFlagUncertainty;

  let depthConcerns = 0;

  if ((attempt.mentalizing_overcertainty_count ?? 0) > 1) {
    depthConcerns += 0.1;
    activeFlags.push('mentalizing_overcertainty');
  }
  if (attempt.defense_patterns?.projection_detected) {
    depthConcerns += 0.1;
    activeFlags.push('projection_detected');
  }
  if (attempt.review_flags?.includes('ego_development_review')) {
    depthConcerns += 0.1;
    activeFlags.push('ego_development_review');
  }
  if (attempt.personal_moment_emotional_vocab_low) {
    depthConcerns += 0.1;
    activeFlags.push('low_emotional_vocab');
  }
  if (attempt.disclosure_calibration === 'underdisclosure') {
    depthConcerns += 0.1;
    activeFlags.push('underdisclosure');
  }
  if (attempt.disclosure_calibration === 'overdisclosure') {
    depthConcerns += 0.05;
    activeFlags.push('overdisclosure');
  }
  if (attempt.reasoning_pending) {
    depthConcerns += 0.1;
    activeFlags.push('reasoning_pending');
  }

  const defenseCrossReference = attempt.defenseCrossReference;
  if (defenseCrossReference?.recommendAdminReview) {
    const contradictionCount = defenseCrossReference.flags.filter(
      (f) => f.selfReportConsistent === false,
    ).length;
    const falseNegativeFlag = defenseCrossReference.flags.find(
      (f) => f.flagName === 'defense_possible_false_negative',
    );

    if (contradictionCount > 0) {
      depthConcerns += contradictionCount * 0.1;
      activeFlags.push(`defense_cross_reference_contradiction_${contradictionCount}`);
    }
    if (falseNegativeFlag) {
      depthConcerns += 0.15;
      activeFlags.push('defense_possible_false_negative');
    }
  }

  uncertainty += depthConcerns;

  function isRecovered(scores: Record<string, unknown> | null): boolean {
    if (!scores) return false;
    const ev = scores.keyEvidence as Record<string, string> | null;
    if (!ev) return false;
    return Object.values(ev).some(
      (v) => typeof v === 'string' && v.includes('Score recovered from model output'),
    );
  }

  const recoveredCount = [
    attempt.scenario_1_scores,
    attempt.scenario_2_scores,
    attempt.scenario_3_scores,
  ].filter(isRecovered).length;

  const scoreRecoveryUncertainty = recoveredCount * 0.1;
  uncertainty += scoreRecoveryUncertainty;
  if (recoveredCount > 0) {
    activeFlags.push(`score_recovery_${recoveredCount}_scenarios`);
  }

  const composites = Object.values(attempt.scenario_composites ?? {}).filter(
    (v): v is number => typeof v === 'number' && Number.isFinite(v),
  );

  let scenarioVarianceUncertainty = 0;
  if (composites.length === 3) {
    const mean = composites.reduce((a, b) => a + b, 0) / 3;
    const variance = composites.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / 3;
    if (variance > 4.0) {
      scenarioVarianceUncertainty = 0.4;
      activeFlags.push(`high_scenario_variance (σ²=${variance.toFixed(2)})`);
    } else if (variance > 2.5) {
      scenarioVarianceUncertainty = 0.2;
      activeFlags.push(`moderate_scenario_variance (σ²=${variance.toFixed(2)})`);
    }
  }
  uncertainty += scenarioVarianceUncertainty;

  const straightLineCount = attempt.psychometric_straight_line_flags?.length ?? 0;
  const straightLineUncertainty = straightLineCount * 0.15;
  uncertainty += straightLineUncertainty;
  if (straightLineCount > 0) {
    activeFlags.push(
      `straight_line_flags (${attempt.psychometric_straight_line_flags?.join(', ')})`,
    );
  }

  let gamingCorrectionUncertainty = 0;
  const gamingCorrectionLevel = attempt.gamingCorrectionLevel ?? 0;
  if (gamingCorrectionLevel >= 2) {
    gamingCorrectionUncertainty += 0.15;
    activeFlags.push(`gaming_correction_level_${gamingCorrectionLevel}`);
  }
  if (gamingCorrectionLevel >= 3) {
    gamingCorrectionUncertainty += 0.1;
    activeFlags.push('gaming_correction_severe');
  }
  uncertainty += gamingCorrectionUncertainty;

  return {
    total: Math.min(Math.round(uncertainty * 100) / 100, 1.0),
    components: {
      thresholdProximity,
      consistencyFlags: consistencyFlagUncertainty,
      depthSignalConcerns: depthConcerns,
      scoreRecovery: scoreRecoveryUncertainty,
      scenarioVariance: scenarioVarianceUncertainty,
      straightLineFlags: straightLineUncertainty,
      gamingCorrection: gamingCorrectionUncertainty,
    },
    activeFlags,
  };
}

export { UNCERTAINTY_ROUTING_THRESHOLD };

/** Plain JSON object for interview_attempts.uncertainty_breakdown (jsonb). */
export function uncertaintyBreakdownForStorage(
  breakdown: UncertaintyBreakdown,
): UncertaintyBreakdown {
  return {
    total: breakdown.total,
    components: {
      thresholdProximity: breakdown.components.thresholdProximity,
      consistencyFlags: breakdown.components.consistencyFlags,
      depthSignalConcerns: breakdown.components.depthSignalConcerns,
      scoreRecovery: breakdown.components.scoreRecovery,
      scenarioVariance: breakdown.components.scenarioVariance,
      straightLineFlags: breakdown.components.straightLineFlags,
      gamingCorrection: breakdown.components.gamingCorrection,
    },
    activeFlags: [...breakdown.activeFlags],
  };
}

export function isUncertaintyBreakdownPopulated(
  breakdown: UncertaintyBreakdown | null | undefined,
): breakdown is UncertaintyBreakdown {
  if (!breakdown || typeof breakdown !== 'object') return false;
  if (typeof breakdown.total !== 'number' || !Number.isFinite(breakdown.total)) return false;
  const c = breakdown.components;
  if (!c || typeof c !== 'object') return false;
  const required = [
    'thresholdProximity',
    'consistencyFlags',
    'depthSignalConcerns',
    'scoreRecovery',
    'scenarioVariance',
    'straightLineFlags',
    'gamingCorrection',
  ] as const;
  for (const key of required) {
    if (typeof c[key] !== 'number' || !Number.isFinite(c[key])) return false;
  }
  return Array.isArray(breakdown.activeFlags);
}

export function logUncertaintyBreakdownBeforePersist(
  attemptId: string,
  breakdown: UncertaintyBreakdown,
  log: (message: string, payload?: Record<string, unknown>) => void = console.log,
): void {
  log('[UncertaintyScore] persisting breakdown', {
    attemptId,
    total: breakdown.total,
    components: breakdown.components,
    activeFlags: breakdown.activeFlags,
    activeFlagsCount: breakdown.activeFlags.length,
    populated: isUncertaintyBreakdownPopulated(breakdown),
  });
}

/** Admin-only band label — no longer drives user routing. */
export function uncertaintyBand(score: number): 'low' | 'moderate' | 'high' {
  if (score < 0.4) return 'low';
  if (score < UNCERTAINTY_ROUTING_THRESHOLD) return 'moderate';
  return 'high';
}
