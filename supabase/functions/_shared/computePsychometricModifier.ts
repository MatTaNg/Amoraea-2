import {
  AAQ2_AVERAGE_MAX,
  AAQ2_HIGH_AVOIDANCE_MIN,
  AAQ2_LOW_AVOIDANCE_MAX,
  AAQ2_STRONG_MAX,
  ANXIETY_AVERAGE_MAX,
  ANXIETY_STRONG_MAX,
  BRS_AVERAGE_MIN,
  BRS_STRONG_MIN,
  DWECK_AVERAGE_MIN,
  DWECK_POOR_MIN,
  DWECK_STRONG_MIN,
  GASP_AVERAGE_MAX_MEAN,
  GASP_CONSISTENCY_REVIEW_MIN_MEAN,
  GASP_PATTERN_INTERPERSONAL_MAX,
  GASP_PATTERN_OVERRIDE_MAX_MEAN,
  GASP_PATTERN_SITUATIONAL_MAX,
  GASP_STRONG_MAX_MEAN,
  MSPSS_ADEQUATE_MIN,
  MSPSS_LIMITED_MIN,
  MSPSS_STRONG_MIN,
  NPI_AVERAGE_MAX,
  NPI_DIVERGENCE_MIN,
  NPI_STRONG_MAX,
  PSYCHOMETRIC_MODIFIER_AVERAGE,
  PSYCHOMETRIC_MODIFIER_BELOW_AVERAGE,
  PSYCHOMETRIC_MODIFIER_ISOLATED,
  PSYCHOMETRIC_MODIFIER_LOW,
  PSYCHOMETRIC_MODIFIER_POOR,
  PSYCHOMETRIC_MODIFIER_STRONG,
  RFQ_AVERAGE_MIN,
  RFQ_MENTALIZING_HIGH_SELF_REPORT_MIN,
  RFQ_MENTALIZING_LOW_SELF_REPORT_MAX,
  RFQ_POOR_MIN,
  RFQ_STRONG_MIN,
  RSES_AVERAGE_MIN,
  RSES_LOW_MIN,
  RSES_LOW_SELF_ESTEEM_MAX,
  RSES_STRONG_MIN,
  SCS_ORIENTATION_BALANCED_DIFF_MIN,
  SCS_ORIENTATION_STRONG_DIFF_MIN,
  SCS_ORIENTATION_STRONGLY_EXTERNAL_DIFF_MAX,
  SCS_SF_BELOW_AVERAGE_MIN,
  SCS_SF_LOW_MIN,
  SCS_SF_STRONG_MIN,
  SD3_AVERAGE_MAX,
  SD3_CONTEMPT_DIVERGENCE_MIN,
  SD3_STRONG_MAX,
} from '../../../src/config/psychometrics/modifierBandPenalties.ts';
import {
  INTERVIEW_ACCOUNTABILITY_STRONG_MIN,
  INTERVIEW_ACCOUNTABILITY_WEAK_MAX,
  INTERVIEW_CONTEMPT_WEAK_MAX,
  INTERVIEW_EGO_DEVELOPMENT_STRONG_MIN,
  INTERVIEW_EGO_DEVELOPMENT_WEAK_MAX,
  INTERVIEW_MENTALIZING_STRONG_MIN,
  INTERVIEW_MENTALIZING_WEAK_MAX,
  INTERVIEW_REGULATION_STRONG_MIN,
  INTERVIEW_REGULATION_WEAK_MAX,
  INTERVIEW_VOCAB_DENSITY_HEALTHY_MIN,
  INTERVIEW_VOCAB_DENSITY_STRONG_MIN,
} from '../../../src/config/psychometrics/interviewSignalConsistency.ts';
import {
  AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD,
  ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD,
  BRS_LOW_RESILIENCE_FLOOR_THRESHOLD,
  SD3_NARCISSISM_FLOOR_THRESHOLD,
} from '../../../src/config/psychometrics/floors.ts';
import { GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD } from './psychometricFloorBreaches.ts';
import { NPI_ENTITLEMENT_ENABLED } from './psychometricsFeatureFlags.ts';
import {
  collectPsychometricFloorGateFailReasons,
} from './psychometricFloorBreaches.ts';
import { detectPsychometricStraightLineFlags } from '../../../src/features/psychometrics/psychometricStraightLineDetection.ts';

const GASP_GUILT_REPAIR_ITEM_IDS = [1, 3] as const;
const GASP_SHAME_WITHDRAW_ITEM_IDS = [2, 4] as const;
const GASP_EXTERNALIZATION_ITEM_IDS = [5, 6, 7, 8] as const;

export interface PsychometricScores {
  brsScore: number | null;
  anxietyTraitScore: number | null;
  scsSfScore: number | null;
  gaspScore: number | null;
  gaspGuiltRepairScore: number | null;
  gaspShameWithdrawScore: number | null;
  dweckScore: number | null;
  aaq2Score: number | null;
  rsesScore: number | null;
  scsPublicScore: number | null;
  scsPrivateScore: number | null;
  mspssFriendsScore: number | null;
  mspssFamilyScore: number | null;
  sd3NarcissismScore: number | null;
  npiEntitlementScore: number | null;
  rfqScore: number | null;
}

export interface PsychometricModifierResult {
  modifier: number;
  brsComponent: number;
  anxietyTraitComponent: number;
  scsSfComponent: number;
  gaspComponent: number;
  dweckComponent: number;
  aaq2Component: number;
  rsesComponent: number;
  scsComponent: number;
  mspssComponent: number;
  sd3NarcissismComponent: number;
  npiEntitlementComponent: number;
  rfqComponent: number;
  consistencyFlags: string[];
  straightLineFlags: string[];
  psychometricFloorBreaches: string[];
  breakdown: {
    brsBand: string;
    anxietyTraitBand: string;
    scsSfBand: string;
    gaspBand: string;
    dweckBand: string;
    aaq2Band: string;
    rsesBand: string;
    scsOrientation: string;
    mspssBand: string;
    sd3NarcissismBand: string;
    npiEntitlementBand: string;
    rfqBand: string;
  };
}

// GASP recalibrated for 4-item externalization subscale only (guilt-repair and shame-withdraw removed).
// With 4 items a mean of 3.0 reflects active rejection of externalization on clear interpersonal
// scenarios combined with genuine neutrality on ambiguous situational scenarios — not average externalization.
// Bands shifted upward from the 12-item calibration accordingly.

export function isGaspLowExternalizationPattern(
  gaspResponses: Record<number, number> | null | undefined,
): boolean {
  if (!gaspResponses) return false;

  // Items 5 and 7 are interpersonal conflict scenarios (supervisor criticism, party comment)
  // Items 6 and 8 are situational ambiguous scenarios (parked car, coworker upset)
  const item5 = gaspResponses[5];
  const item6 = gaspResponses[6];
  const item7 = gaspResponses[7];
  const item8 = gaspResponses[8];

  if (item5 == null || item6 == null || item7 == null || item8 == null) return false;

  // Pattern: interpersonal items score ≤ 3 AND situational items score ≤ 4
  const interpersonalLow = item5 <= GASP_PATTERN_INTERPERSONAL_MAX && item7 <= GASP_PATTERN_INTERPERSONAL_MAX;
  const situationalNeutralOrLow = item6 <= GASP_PATTERN_SITUATIONAL_MAX && item8 <= GASP_PATTERN_SITUATIONAL_MAX;

  return interpersonalLow && situationalNeutralOrLow;
}

export type GaspExternalizationModifierResult = {
  modifier: number;
  band: string;
  patternOverride?: boolean;
  floorBreach: boolean;
};

/** GASP externalization mean → modifier band (4-item subscale calibration). */
export function computeGaspExternalizationModifier(
  gaspMean: number,
  gaspResponses?: Record<number, number> | null,
): GaspExternalizationModifierResult {
  if (gaspMean >= GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD) {
    return { modifier: PSYCHOMETRIC_MODIFIER_STRONG, band: 'floor breach', floorBreach: true };
  }

  // Pattern override: principled rejection on interpersonal + neutrality on situational
  // → treat as strong (0 modifier) even if mean is in the average band
  if (
    gaspMean <= GASP_PATTERN_OVERRIDE_MAX_MEAN &&
    isGaspLowExternalizationPattern(gaspResponses)
  ) {
    return {
      modifier: PSYCHOMETRIC_MODIFIER_STRONG,
      band: 'strong — low externalization (pattern override)',
      patternOverride: true,
      floorBreach: false,
    };
  }

  if (gaspMean <= GASP_STRONG_MAX_MEAN) {
    return { modifier: PSYCHOMETRIC_MODIFIER_STRONG, band: 'strong — low externalization', floorBreach: false };
  }
  if (gaspMean <= GASP_AVERAGE_MAX_MEAN) {
    return { modifier: PSYCHOMETRIC_MODIFIER_AVERAGE, band: 'average externalization', floorBreach: false };
  }
  return { modifier: PSYCHOMETRIC_MODIFIER_POOR, band: 'poor externalization', floorBreach: false };
}

/**
 * Sums per-instrument three-tier band penalties into a single psychometric modifier applied to the final gate score.
 * Each instrument uses strong (0), average (-0.10), or poor (-0.25) bands; extreme scores are handled by floor
 * breaches, not additional modifier tiers. Range is [worst-case negative sum, 0] — never a positive boost.
 * Worst-case total across 9 active instruments: -2.10 (8 × -0.25 poor bands + NPI average -0.10).
 */
export function computePsychometricModifier(
  scores: PsychometricScores,
  interviewSignals?: {
    disclosureCalibration?: string | null;
    moment5Concreteness?: string | null;
    personalMomentVocabDensity?: number | null;
    regulationPillar?: number | null;
    accountabilityPillar?: number | null;
    egoDevelopmentLevel?: number | null;
    moment4Concreteness?: string | null;
    attunementPillar?: number | null;
    contemptPillar?: number | null;
    mentalizingPillar?: number | null;
  },
  rawResponses?: {
    brs?: Record<number, number>;
    anxiety_trait?: Record<number, number>;
    scs_sf?: Record<number, number>;
    gasp?: Record<number, number>;
    dweck?: Record<number, number>;
    aaq2?: Record<number, number>;
    rses?: Record<number, number>;
    scs?: Record<number, number>;
    mspss?: Record<number, number>;
    sd3_narcissism?: Record<number, number>;
    rfq?: Record<number, number>;
  },
): PsychometricModifierResult {
  let modifier = 0;
  let brsComponent = 0;
  let anxietyTraitComponent = 0;
  let scsSfComponent = 0;
  let gaspComponent = 0;
  let dweckComponent = 0;
  let aaq2Component = 0;
  let rsesComponent = 0;
  let scsComponent = 0;
  let mspssComponent = 0;
  let sd3NarcissismComponent = 0;
  let npiEntitlementComponent = 0;
  let rfqComponent = 0;
  const consistencyFlags: string[] = [];
  const psychometricFloorBreaches: string[] = [];

  let brsBand = 'not assessed';
  if (scores.brsScore !== null) {
    const s = scores.brsScore;
    if (s >= BRS_STRONG_MIN) {
      brsComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      brsBand = 'strong resilience';
    } else if (s >= BRS_AVERAGE_MIN) {
      brsComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      brsBand = 'average resilience';
    } else if (s > BRS_LOW_RESILIENCE_FLOOR_THRESHOLD) {
      brsComponent = PSYCHOMETRIC_MODIFIER_POOR;
      brsBand = 'poor resilience';
    } else {
      brsComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      brsBand = 'floor breach';
    }
    modifier += brsComponent;
  }

  let anxietyTraitBand = 'not assessed';
  if (scores.anxietyTraitScore !== null) {
    const s = scores.anxietyTraitScore;
    if (s < ANXIETY_STRONG_MAX) {
      anxietyTraitComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      anxietyTraitBand = 'strong — low chronic anxiety';
    } else if (s < ANXIETY_AVERAGE_MAX) {
      anxietyTraitComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      anxietyTraitBand = 'average anxiety';
    } else if (s < ANXIETY_TRAIT_HIGH_FLOOR_THRESHOLD) {
      anxietyTraitComponent = PSYCHOMETRIC_MODIFIER_POOR;
      anxietyTraitBand = 'poor — high anxiety';
    } else {
      anxietyTraitComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      anxietyTraitBand = 'floor breach';
    }
    modifier += anxietyTraitComponent;
  }

  let scsSfBand = 'not assessed';
  if (scores.scsSfScore !== null) {
    const s = scores.scsSfScore;
    // SCS-SF recalibrated: scores above midpoint (3.5+) should not trigger modifier penalties.
    // A score of 3.875 represents average-to-good self-compassion and is not a relational risk signal.
    // Penalty bands begin below 3.5, meaningful penalty below 2.5.
    if (s >= SCS_SF_STRONG_MIN) {
      scsSfComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      scsSfBand = 'strong self-compassion';
    } else if (s >= SCS_SF_BELOW_AVERAGE_MIN) {
      scsSfComponent = PSYCHOMETRIC_MODIFIER_BELOW_AVERAGE;
      scsSfBand = 'below average self-compassion';
    } else if (s >= SCS_SF_LOW_MIN) {
      scsSfComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      scsSfBand = 'low self-compassion';
    } else {
      scsSfComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      scsSfBand = 'floor breach';
    }
    modifier += scsSfComponent;
  }

  let gaspBand = 'not assessed';
  if (scores.gaspScore !== null) {
    let scoringMean = scores.gaspScore;
    if (scores.gaspGuiltRepairScore !== null && scores.gaspShameWithdrawScore !== null && rawResponses?.gasp) {
      // Modern calibration: gaspScore is (guilt + shame) / 2.
      // Modifier calculation needs the externalization subscale (items 5-8).
      const extValues = GASP_EXTERNALIZATION_ITEM_IDS.map((id) => rawResponses.gasp![id]).filter(
        (v): v is number => v != null,
      );
      if (extValues.length === GASP_EXTERNALIZATION_ITEM_IDS.length) {
        scoringMean = extValues.reduce((a, b) => a + b, 0) / extValues.length;
      }
    }

    const gaspResult = computeGaspExternalizationModifier(scoringMean, rawResponses?.gasp);
    gaspComponent = gaspResult.modifier;
    gaspBand = gaspResult.band;
    modifier += gaspComponent;

    if (interviewSignals && scoringMean > GASP_CONSISTENCY_REVIEW_MIN_MEAN && (interviewSignals.accountabilityPillar ?? 0) >= INTERVIEW_ACCOUNTABILITY_STRONG_MIN) {
      consistencyFlags.push('gasp_consistency_review');
    }
  }

  let dweckBand = 'not assessed';
  if (scores.dweckScore !== null) {
    const s = scores.dweckScore;
    if (s >= DWECK_STRONG_MIN) {
      dweckComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      dweckBand = 'strong growth mindset';
    } else if (s >= DWECK_AVERAGE_MIN) {
      dweckComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      dweckBand = 'average mindset';
    } else if (s >= DWECK_POOR_MIN) {
      dweckComponent = PSYCHOMETRIC_MODIFIER_POOR;
      dweckBand = 'poor — fixed-leaning mindset';
    } else {
      dweckComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      dweckBand = 'floor breach';
    }
    modifier += dweckComponent;
  }

  let aaq2Band = 'not assessed';
  if (scores.aaq2Score !== null) {
    const s = scores.aaq2Score;
    if (s <= AAQ2_STRONG_MAX) {
      aaq2Component = PSYCHOMETRIC_MODIFIER_STRONG;
      aaq2Band = 'strong psychological flexibility';
    } else if (s <= AAQ2_AVERAGE_MAX) {
      aaq2Component = PSYCHOMETRIC_MODIFIER_AVERAGE;
      aaq2Band = 'average flexibility';
    } else if (s < AAQ2_HIGH_EXPERIENTIAL_AVOIDANCE_FLOOR_THRESHOLD) {
      aaq2Component = PSYCHOMETRIC_MODIFIER_POOR;
      aaq2Band = 'poor flexibility';
    } else {
      aaq2Component = PSYCHOMETRIC_MODIFIER_STRONG;
      aaq2Band = 'floor breach';
    }
    modifier += aaq2Component;

    if (interviewSignals) {
      const highAvoidance = s >= AAQ2_HIGH_AVOIDANCE_MIN;
      const lowAvoidance = s <= AAQ2_LOW_AVOIDANCE_MAX;
      const behavioralAvoidance =
        interviewSignals.disclosureCalibration === 'underdisclosure' ||
        interviewSignals.moment5Concreteness === 'low' ||
        interviewSignals.moment5Concreteness === 'absent' ||
        (interviewSignals.personalMomentVocabDensity != null &&
          interviewSignals.personalMomentVocabDensity < INTERVIEW_VOCAB_DENSITY_HEALTHY_MIN) ||
        (interviewSignals.regulationPillar != null && interviewSignals.regulationPillar <= INTERVIEW_REGULATION_WEAK_MAX);
      const behavioralHealth =
        interviewSignals.disclosureCalibration === 'calibrated' &&
        (interviewSignals.moment5Concreteness === 'high' ||
          interviewSignals.moment5Concreteness === 'moderate') &&
        (interviewSignals.personalMomentVocabDensity ?? 0) >= INTERVIEW_VOCAB_DENSITY_HEALTHY_MIN &&
        (interviewSignals.regulationPillar ?? 0) >= INTERVIEW_REGULATION_STRONG_MIN;

      if (highAvoidance && behavioralHealth) consistencyFlags.push('aaq2_consistency_review');
      if (lowAvoidance && behavioralAvoidance) consistencyFlags.push('aaq2_consistency_review');
    }
  }

  let rsesBand = 'not assessed';
  if (scores.rsesScore !== null) {
    const s = scores.rsesScore;
    // RSES recalibrated: score of 26/40 sits at the bottom of the normal range,
    // not in clinical low-esteem territory. The -0.25 penalty is reserved for
    // scores below 20 where self-esteem is genuinely problematic for relational functioning.
    // Mild penalty (-0.10) begins below 30, meaningful penalty (-0.15) below 25.
    if (s >= RSES_STRONG_MIN) {
      rsesComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      rsesBand = 'healthy self-esteem';
    } else if (s >= RSES_AVERAGE_MIN) {
      rsesComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      rsesBand = 'below average self-esteem';
    } else if (s >= RSES_LOW_MIN) {
      rsesComponent = PSYCHOMETRIC_MODIFIER_LOW;
      rsesBand = 'low self-esteem';
    } else {
      rsesComponent = PSYCHOMETRIC_MODIFIER_POOR;
      rsesBand = 'very low self-esteem';
    }
    modifier += rsesComponent;

    if (interviewSignals) {
      const lowSelfEsteem = s <= RSES_LOW_SELF_ESTEEM_MAX;
      const highSelfEsteem = s >= RSES_STRONG_MIN;
      const behavioralAccountability =
        (interviewSignals.accountabilityPillar ?? 0) >= INTERVIEW_ACCOUNTABILITY_STRONG_MIN &&
        (interviewSignals.egoDevelopmentLevel ?? 0) >= INTERVIEW_EGO_DEVELOPMENT_STRONG_MIN;
      const behavioralLowAccountability =
        (interviewSignals.accountabilityPillar ?? 10) <= INTERVIEW_ACCOUNTABILITY_WEAK_MAX &&
        (interviewSignals.egoDevelopmentLevel ?? 5) <= INTERVIEW_EGO_DEVELOPMENT_WEAK_MAX;

      if (lowSelfEsteem && behavioralAccountability) consistencyFlags.push('rses_consistency_review');
      if (highSelfEsteem && behavioralLowAccountability) consistencyFlags.push('rses_consistency_review');
    }
  }

  let scsOrientation = 'not assessed';
  if (scores.scsPublicScore !== null && scores.scsPrivateScore !== null) {
    const diff = scores.scsPrivateScore - scores.scsPublicScore;

    if (diff >= SCS_ORIENTATION_STRONG_DIFF_MIN) {
      scsComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      scsOrientation = 'strong internal orientation';
    } else if (diff >= SCS_ORIENTATION_BALANCED_DIFF_MIN) {
      scsComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      scsOrientation = 'balanced to mildly external';
    } else {
      scsComponent = PSYCHOMETRIC_MODIFIER_POOR;
      scsOrientation = 'poor — externally oriented';
    }
    modifier += scsComponent;

    if (interviewSignals) {
      const stronglyExternal = diff <= SCS_ORIENTATION_STRONGLY_EXTERNAL_DIFF_MAX;
      const behavioralInternal =
        interviewSignals.disclosureCalibration === 'calibrated' &&
        (interviewSignals.moment4Concreteness === 'high' ||
          interviewSignals.moment5Concreteness === 'high') &&
        (interviewSignals.personalMomentVocabDensity ?? 0) >= INTERVIEW_VOCAB_DENSITY_STRONG_MIN;

      if (stronglyExternal && behavioralInternal) consistencyFlags.push('scs_consistency_review');
    }
  }

  let mspssBand = 'not assessed';
  if (scores.mspssFriendsScore !== null) {
    const s = scores.mspssFriendsScore;
    if (s >= MSPSS_STRONG_MIN) {
      mspssComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      mspssBand = 'strong social network';
    } else if (s >= MSPSS_ADEQUATE_MIN) {
      mspssComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      mspssBand = 'adequate social network';
    } else if (s >= MSPSS_LIMITED_MIN) {
      mspssComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      mspssBand = 'limited social network';
    } else {
      mspssComponent = PSYCHOMETRIC_MODIFIER_ISOLATED;
      mspssBand = 'isolated — high dependency risk';
    }
    modifier += mspssComponent;
  }

  let sd3NarcissismBand = 'not assessed';
  let npiEntitlementBand = 'not assessed';
  if (NPI_ENTITLEMENT_ENABLED) {
    if (scores.npiEntitlementScore !== null) {
      const s = scores.npiEntitlementScore;
      if (s <= NPI_STRONG_MAX) {
        npiEntitlementComponent = PSYCHOMETRIC_MODIFIER_STRONG;
        npiEntitlementBand = 'strong — low entitlement';
      } else if (s <= NPI_AVERAGE_MAX) {
        npiEntitlementComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
        npiEntitlementBand = 'average entitlement';
      } else {
        npiEntitlementComponent = PSYCHOMETRIC_MODIFIER_STRONG;
        npiEntitlementBand = 'floor breach';
      }
      modifier += npiEntitlementComponent;

      if (
        interviewSignals &&
        s >= NPI_DIVERGENCE_MIN &&
        (interviewSignals.accountabilityPillar ?? 0) >= INTERVIEW_ACCOUNTABILITY_STRONG_MIN
      ) {
        consistencyFlags.push('npi_entitlement_accountability_divergence');
      }
    }
  } else if (scores.sd3NarcissismScore !== null) {
    const s = scores.sd3NarcissismScore;
    if (s <= SD3_STRONG_MAX) {
      sd3NarcissismComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      sd3NarcissismBand = 'strong — low narcissism';
    } else if (s <= SD3_AVERAGE_MAX) {
      sd3NarcissismComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      sd3NarcissismBand = 'average narcissism';
    } else if (s < SD3_NARCISSISM_FLOOR_THRESHOLD) {
      sd3NarcissismComponent = PSYCHOMETRIC_MODIFIER_POOR;
      sd3NarcissismBand = 'poor — high narcissism';
    } else {
      sd3NarcissismComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      sd3NarcissismBand = 'floor breach';
    }
    modifier += sd3NarcissismComponent;

    if (interviewSignals && s > SD3_CONTEMPT_DIVERGENCE_MIN && (interviewSignals.contemptPillar ?? 10) < INTERVIEW_CONTEMPT_WEAK_MAX) {
      consistencyFlags.push('sd3_narcissism_contempt_divergence');
    }
  }

  let rfqBand = 'not assessed';
  if (scores.rfqScore !== null) {
    const s = scores.rfqScore;
    if (s >= RFQ_STRONG_MIN) {
      rfqComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      rfqBand = 'strong reflective functioning';
    } else if (s >= RFQ_AVERAGE_MIN) {
      rfqComponent = PSYCHOMETRIC_MODIFIER_AVERAGE;
      rfqBand = 'average reflective functioning';
    } else if (s >= RFQ_POOR_MIN) {
      rfqComponent = PSYCHOMETRIC_MODIFIER_POOR;
      rfqBand = 'poor reflective functioning';
    } else {
      rfqComponent = PSYCHOMETRIC_MODIFIER_STRONG;
      rfqBand = 'floor breach';
    }
    modifier += rfqComponent;

    if (interviewSignals) {
      const mentalizing = interviewSignals.mentalizingPillar ?? null;
      if (mentalizing !== null) {
        if (s < RFQ_MENTALIZING_LOW_SELF_REPORT_MAX && mentalizing >= INTERVIEW_MENTALIZING_STRONG_MIN) {
          consistencyFlags.push('rfq_mentalizing_divergence_low_self_report');
        }
        if (s >= RFQ_MENTALIZING_HIGH_SELF_REPORT_MIN && mentalizing <= INTERVIEW_MENTALIZING_WEAK_MAX) {
          consistencyFlags.push('rfq_mentalizing_divergence_high_self_report');
        }
      }
    }
  }

  modifier = Math.min(0, Math.round(modifier * 100) / 100);

  const straightLineFlags = detectPsychometricStraightLineFlags(
    {
      brsScore: scores.brsScore,
      anxietyTraitScore: scores.anxietyTraitScore,
      scsSfScore: scores.scsSfScore,
      gaspScore: scores.gaspScore,
      dweckScore: scores.dweckScore,
      aaq2Score: scores.aaq2Score,
      rsesScore: scores.rsesScore,
      scsPublicScore: scores.scsPublicScore,
      scsPrivateScore: scores.scsPrivateScore,
      mspssFriendsScore: scores.mspssFriendsScore,
      sd3NarcissismScore: scores.sd3NarcissismScore,
      rfqScore: scores.rfqScore,
    },
    rawResponses,
  );

  psychometricFloorBreaches.length = 0;
  psychometricFloorBreaches.push(
    ...collectPsychometricFloorGateFailReasons(
      {
        rfqScore: scores.rfqScore,
        gaspScore: scores.gaspScore,
        gaspGuiltRepairScore: scores.gaspGuiltRepairScore,
        gaspShameWithdrawScore: scores.gaspShameWithdrawScore,
        dweckScore: scores.dweckScore,
        scsSfScore: scores.scsSfScore,
        sd3NarcissismScore: scores.sd3NarcissismScore,
        npiEntitlementScore: scores.npiEntitlementScore,
        brsScore: scores.brsScore,
        anxietyTraitScore: scores.anxietyTraitScore,
        aaq2Score: scores.aaq2Score,
        rsesScore: scores.rsesScore,
        scsPublicScore: scores.scsPublicScore,
        scsPrivateScore: scores.scsPrivateScore,
        gaspResponses: rawResponses?.gasp,
      },
      straightLineFlags,
    ),
  );

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log('[PsychometricModifier] total:', modifier);
    console.log('[PsychometricModifier] consistency flags:', consistencyFlags, 'straight-line flags:', straightLineFlags);
  }

  return {
    modifier,
    brsComponent,
    anxietyTraitComponent,
    scsSfComponent,
    gaspComponent,
    dweckComponent,
    aaq2Component,
    rsesComponent,
    scsComponent,
    mspssComponent,
    sd3NarcissismComponent,
    npiEntitlementComponent,
    rfqComponent,
    consistencyFlags,
    straightLineFlags,
    psychometricFloorBreaches,
    breakdown: {
      brsBand,
      anxietyTraitBand,
      scsSfBand,
      gaspBand,
      dweckBand,
      aaq2Band,
      rsesBand,
      scsOrientation,
      mspssBand,
      sd3NarcissismBand,
      npiEntitlementBand,
      rfqBand,
    },
  };
}
