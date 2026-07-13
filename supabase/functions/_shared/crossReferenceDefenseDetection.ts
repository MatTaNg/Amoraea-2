export interface DefenseCrossReferenceResult {
  overallConfidence: 'high' | 'moderate' | 'low';
  flags: DefenseCrossReferenceFlag[];
  recommendAdminReview: boolean;
  modifierAdjustment: number;
}

export interface DefenseCrossReferenceFlag {
  defense: string;
  detected: boolean;
  selfReportConsistent: boolean | null;
  confidenceLevel: 'high' | 'moderate' | 'low';
  flagName: string;
  description: string;
}

export type DefensePatternsCrossRefInput = {
  projection_detected: boolean;
  splitting_detected: boolean;
  rationalization_detected: boolean;
  denial_detected: boolean;
};

/** Valid empty cross-reference — completed attempts must persist this shape, never null. */
export const EMPTY_DEFENSE_CROSS_REFERENCE_RESULT: DefenseCrossReferenceResult = {
  overallConfidence: 'high',
  flags: [],
  recommendAdminReview: false,
  modifierAdjustment: 0,
};

function finitePsychScore(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function normalizeDefensePatternsForCrossReference(
  raw: Record<string, unknown> | null | undefined,
): DefensePatternsCrossRefInput {
  return {
    projection_detected: raw?.projection_detected === true,
    splitting_detected: raw?.splitting_detected === true,
    rationalization_detected: raw?.rationalization_detected === true,
    denial_detected: raw?.denial_detected === true,
  };
}

export function psychometricScoresForDefenseCrossReferenceFromUserRow(
  user: Record<string, unknown> | null | undefined,
): {
  gasp_externalization: number | null;
  rfq_score: number | null;
  sd3_narcissism_score: number | null;
  rses_score: number | null;
  scs_sf_score: number | null;
  aaq2_score: number | null;
} {
  return {
    gasp_externalization: finitePsychScore(user?.psychometrics_gasp_score),
    rfq_score: finitePsychScore(user?.psychometrics_rfq_score),
    sd3_narcissism_score: finitePsychScore(user?.psychometrics_sd3_narcissism_score),
    rses_score: finitePsychScore(user?.psychometrics_rses_score),
    scs_sf_score: finitePsychScore(user?.psychometrics_scs_sf_score),
    aaq2_score: finitePsychScore(user?.psychometrics_aaq2_score),
  };
}

/**
 * Always returns a populated cross-reference object for completed attempts.
 * Never skips when defense patterns are present; falls back to empty flags on error.
 */
export function buildDefenseCrossReferenceForAttempt(params: {
  defensePatterns: Record<string, unknown> | DefensePatternsCrossRefInput | null | undefined;
  userPsychometrics: Record<string, unknown> | null | undefined;
  depthSignalModifierApplied?: number | null;
}): DefenseCrossReferenceResult {
  try {
    const defensePatterns =
      params.defensePatterns != null &&
      typeof params.defensePatterns === 'object' &&
      'projection_detected' in params.defensePatterns
        ? (params.defensePatterns as DefensePatternsCrossRefInput)
        : normalizeDefensePatternsForCrossReference(
            params.defensePatterns as Record<string, unknown> | null | undefined,
          );
    const depthSignalModifierApplied =
      typeof params.depthSignalModifierApplied === 'number' &&
      Number.isFinite(params.depthSignalModifierApplied)
        ? params.depthSignalModifierApplied
        : 0;
    return crossReferenceDefenseDetection({
      defensePatterns,
      psychometricScores: psychometricScoresForDefenseCrossReferenceFromUserRow(
        params.userPsychometrics,
      ),
      depthSignalModifierApplied,
    });
  } catch (error) {
    console.error('[DefenseCrossRef] buildDefenseCrossReferenceForAttempt failed:', error);
    return { ...EMPTY_DEFENSE_CROSS_REFERENCE_RESULT, overallConfidence: 'low' };
  }
}

export function crossReferenceDefenseDetection(params: {
  defensePatterns: {
    projection_detected: boolean;
    splitting_detected: boolean;
    rationalization_detected: boolean;
    denial_detected: boolean;
  };
  psychometricScores: {
    gasp_externalization: number | null;
    rfq_score: number | null;
    sd3_narcissism_score: number | null;
    rses_score: number | null;
    scs_sf_score: number | null;
    aaq2_score: number | null;
  };
  depthSignalModifierApplied: number;
}): DefenseCrossReferenceResult {
  const flags: DefenseCrossReferenceFlag[] = [];
  let modifierAdjustment = 0;
  let reviewRecommended = false;

  const { defensePatterns, psychometricScores } = params;

  if (defensePatterns.projection_detected) {
    const gasp = psychometricScores.gasp_externalization;
    const rfq = psychometricScores.rfq_score;
    const sd3 = psychometricScores.sd3_narcissism_score;

    const hasConsistentSignal =
      (gasp !== null && gasp >= 4.0) || (sd3 !== null && sd3 >= 3.0);

    const hasContradictingSignal =
      (gasp !== null && gasp <= 2.5) &&
      (rfq !== null && rfq >= 5.0) &&
      (sd3 !== null && sd3 <= 2.0);

    const hasSufficientData = gasp !== null && rfq !== null && sd3 !== null;

    if (!hasSufficientData) {
      flags.push({
        defense: 'projection',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'projection_insufficient_psychometric_data',
        description:
          'Projection detected in interview but psychometric data insufficient for cross-reference validation. Apply modifier with moderate confidence.',
      });
    } else if (hasContradictingSignal) {
      modifierAdjustment += 0.15;
      reviewRecommended = true;
      flags.push({
        defense: 'projection',
        detected: true,
        selfReportConsistent: false,
        confidenceLevel: 'low',
        flagName: 'projection_self_report_contradiction',
        description:
          'Projection detected in interview but self-report profile (low GASP externalization, high RFQ, low SD3 narcissism) contradicts this detection. Possible false positive. Modifier penalty partially reversed. Admin review recommended.',
      });
    } else if (hasConsistentSignal) {
      flags.push({
        defense: 'projection',
        detected: true,
        selfReportConsistent: true,
        confidenceLevel: 'high',
        flagName: 'projection_self_report_confirmed',
        description:
          'Projection detected in interview and confirmed by self-report profile (elevated GASP externalization or SD3 narcissism). High confidence detection. Full modifier penalty applied.',
      });
    } else {
      flags.push({
        defense: 'projection',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'projection_self_report_neutral',
        description:
          'Projection detected in interview. Self-report profile neither confirms nor contradicts. Moderate confidence. Full modifier penalty applied.',
      });
    }
  }

  if (defensePatterns.rationalization_detected) {
    const gasp = psychometricScores.gasp_externalization;
    const rfq = psychometricScores.rfq_score;
    const scsSf = psychometricScores.scs_sf_score;

    const hasConsistentSignal =
      (gasp !== null && gasp >= 4.0) || (rfq !== null && rfq <= 3.0);

    const hasContradictingSignal =
      (rfq !== null && rfq >= 5.0) &&
      (gasp !== null && gasp <= 2.5) &&
      (scsSf !== null && scsSf >= 4.0);

    const hasSufficientData = gasp !== null && rfq !== null;

    if (!hasSufficientData) {
      flags.push({
        defense: 'rationalization',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'rationalization_insufficient_psychometric_data',
        description:
          'Rationalization detected in interview but psychometric data insufficient for cross-reference. Note: rationalization is a high false-negative risk defense — LLMs frequently misclassify it as mature intellectualization. Apply modifier with moderate confidence.',
      });
    } else if (hasContradictingSignal) {
      modifierAdjustment += 0.15;
      reviewRecommended = true;
      flags.push({
        defense: 'rationalization',
        detected: true,
        selfReportConsistent: false,
        confidenceLevel: 'low',
        flagName: 'rationalization_self_report_contradiction',
        description:
          'Rationalization detected in interview but self-report profile (high RFQ, low GASP, high SCS-SF) contradicts this detection. Possible false positive — user demonstrates strong self-awareness on self-report measures. Modifier penalty partially reversed. Admin review recommended.',
      });
    } else if (hasConsistentSignal) {
      flags.push({
        defense: 'rationalization',
        detected: true,
        selfReportConsistent: true,
        confidenceLevel: 'high',
        flagName: 'rationalization_self_report_confirmed',
        description:
          'Rationalization detected in interview and consistent with self-report profile (low RFQ or elevated GASP). High confidence detection. Full modifier penalty applied.',
      });
    } else {
      flags.push({
        defense: 'rationalization',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'rationalization_self_report_neutral',
        description:
          'Rationalization detected in interview. Self-report profile neutral. Moderate confidence. Full modifier penalty applied.',
      });
    }
  }

  if (defensePatterns.splitting_detected) {
    const sd3 = psychometricScores.sd3_narcissism_score;
    const rfq = psychometricScores.rfq_score;
    const scsSf = psychometricScores.scs_sf_score;

    const hasConsistentSignal =
      (sd3 !== null && sd3 >= 3.5) || (rfq !== null && rfq <= 3.0);

    const hasContradictingSignal =
      (rfq !== null && rfq >= 5.0) &&
      (sd3 !== null && sd3 <= 2.0) &&
      (scsSf !== null && scsSf >= 3.5);

    const hasSufficientData = sd3 !== null && rfq !== null;

    if (!hasSufficientData) {
      flags.push({
        defense: 'splitting',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'splitting_insufficient_psychometric_data',
        description:
          'Splitting detected in interview but psychometric data insufficient for cross-reference. Apply modifier with moderate confidence.',
      });
    } else if (hasContradictingSignal) {
      modifierAdjustment += 0.15;
      reviewRecommended = true;
      flags.push({
        defense: 'splitting',
        detected: true,
        selfReportConsistent: false,
        confidenceLevel: 'low',
        flagName: 'splitting_self_report_contradiction',
        description:
          'Splitting detected in interview but self-report profile (high RFQ, low SD3 narcissism, adequate SCS-SF) contradicts this detection. Possible false positive. Modifier penalty partially reversed. Admin review recommended.',
      });
    } else if (hasConsistentSignal) {
      flags.push({
        defense: 'splitting',
        detected: true,
        selfReportConsistent: true,
        confidenceLevel: 'high',
        flagName: 'splitting_self_report_confirmed',
        description:
          'Splitting detected in interview and consistent with self-report profile (elevated SD3 narcissism or low RFQ). High confidence detection. Full modifier penalty applied.',
      });
    } else {
      flags.push({
        defense: 'splitting',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'splitting_self_report_neutral',
        description:
          'Splitting detected in interview. Self-report profile neutral. Moderate confidence. Full modifier penalty applied.',
      });
    }
  }

  if (defensePatterns.denial_detected) {
    const rses = psychometricScores.rses_score;
    const rfq = psychometricScores.rfq_score;
    const aaq2 = psychometricScores.aaq2_score;

    const hasConsistentSignal =
      (rses !== null && rses >= 36) ||
      (rfq !== null && rfq <= 3.0) ||
      (aaq2 !== null && aaq2 >= 35);

    const hasContradictingSignal =
      (rfq !== null && rfq >= 5.0) &&
      (aaq2 !== null && aaq2 <= 24) &&
      (rses !== null && rses >= 17 && rses <= 33);

    const hasSufficientData = rfq !== null && rses !== null;

    if (!hasSufficientData) {
      flags.push({
        defense: 'denial',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'denial_insufficient_psychometric_data',
        description:
          'Denial detected in interview but psychometric data insufficient for cross-reference. Apply modifier with moderate confidence.',
      });
    } else if (hasContradictingSignal) {
      modifierAdjustment += 0.15;
      reviewRecommended = true;
      flags.push({
        defense: 'denial',
        detected: true,
        selfReportConsistent: false,
        confidenceLevel: 'low',
        flagName: 'denial_self_report_contradiction',
        description:
          'Denial detected in interview but self-report profile (high RFQ, low AAQ-II, moderate RSES) contradicts this detection. Possible false positive. Modifier penalty partially reversed. Admin review recommended.',
      });
    } else if (hasConsistentSignal) {
      flags.push({
        defense: 'denial',
        detected: true,
        selfReportConsistent: true,
        confidenceLevel: 'high',
        flagName: 'denial_self_report_confirmed',
        description:
          'Denial detected in interview and consistent with self-report profile (very high RSES, low RFQ, or high AAQ-II). High confidence detection. Full modifier penalty applied.',
      });
    } else {
      flags.push({
        defense: 'denial',
        detected: true,
        selfReportConsistent: null,
        confidenceLevel: 'moderate',
        flagName: 'denial_self_report_neutral',
        description:
          'Denial detected in interview. Self-report profile neutral. Moderate confidence. Full modifier penalty applied.',
      });
    }
  }

  const gasp = psychometricScores.gasp_externalization;
  const sd3 = psychometricScores.sd3_narcissism_score;
  const rfq = psychometricScores.rfq_score;
  const noDefensesDetected =
    !defensePatterns.projection_detected &&
    !defensePatterns.splitting_detected &&
    !defensePatterns.rationalization_detected &&
    !defensePatterns.denial_detected;

  if (
    noDefensesDetected &&
    gasp !== null &&
    gasp >= 5.0 &&
    sd3 !== null &&
    sd3 >= 3.5 &&
    rfq !== null &&
    rfq <= 3.0
  ) {
    reviewRecommended = true;
    flags.push({
      defense: 'possible_missed_detection',
      detected: false,
      selfReportConsistent: null,
      confidenceLevel: 'low',
      flagName: 'defense_possible_false_negative',
      description:
        'No defense patterns detected in interview but psychometric profile (high GASP externalization, high SD3 narcissism, low RFQ) suggests possible missed rationalization or projection. LLMs have known false-negative risk on these defenses. Admin review recommended.',
    });
  }

  const detectedCount = [
    defensePatterns.projection_detected,
    defensePatterns.splitting_detected,
    defensePatterns.rationalization_detected,
    defensePatterns.denial_detected,
  ].filter(Boolean).length;

  const contradictionCount = flags.filter((f) => f.selfReportConsistent === false).length;

  const overallConfidence =
    detectedCount === 0
      ? 'high'
      : contradictionCount >= 2
        ? 'low'
        : contradictionCount === 1
          ? 'moderate'
          : 'high';

  return {
    overallConfidence,
    flags,
    recommendAdminReview: reviewRecommended,
    modifierAdjustment,
  };
}
