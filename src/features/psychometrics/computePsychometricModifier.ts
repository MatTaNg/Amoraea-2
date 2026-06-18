import { GASP_EXTERNALIZATION_ITEM_IDS } from './assessmentContent';
import { GASP_EXTREME_EXTERNALIZATION_FLOOR_THRESHOLD } from './psychometricFloorBreaches';
import { NPI_ENTITLEMENT_ENABLED } from './psychometricsFeatureFlags';
import {
  detectRfqStraightLineFromResponses,
  RFQ_STRAIGHT_LINE_FLAG,
  collectPsychometricFloorGateFailReasons,
} from './psychometricFloorBreaches';
import {
  detectSd3NarcissismStraightLineFromResponses,
  SD3_NARCISSISM_STRAIGHT_LINE_FLAG,
} from './sd3NarcissismFloor';

export interface PsychometricScores {
  brsScore: number | null;
  anxietyTraitScore: number | null;
  scsSfScore: number | null;
  gaspScore: number | null;
  dweckScore: number | null;
  aaq2Score: number | null;
  rsesScore: number | null;
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

  // Items 1 and 3 are interpersonal conflict scenarios (supervisor criticism, party comment)
  // Items 2 and 4 are situational ambiguous scenarios (parked car, coworker upset)
  const item1 = gaspResponses[1];
  const item2 = gaspResponses[2];
  const item3 = gaspResponses[3];
  const item4 = gaspResponses[4];

  if (item1 == null || item2 == null || item3 == null || item4 == null) return false;

  // Pattern: interpersonal items score ≤ 3 AND situational items score ≤ 4
  const interpersonalLow = item1 <= 3 && item3 <= 3;
  const situationalNeutralOrLow = item2 <= 4 && item4 <= 4;

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
    return { modifier: 0, band: 'floor breach', floorBreach: true };
  }

  // Pattern override: principled rejection on interpersonal + neutrality on situational
  // → treat as strong (0 modifier) even if mean is in the average band
  if (
    gaspMean <= 3.5 &&
    isGaspLowExternalizationPattern(gaspResponses)
  ) {
    return {
      modifier: 0,
      band: 'strong — low externalization (pattern override)',
      patternOverride: true,
      floorBreach: false,
    };
  }

  if (gaspMean <= 3.0) {
    return { modifier: 0, band: 'strong — low externalization', floorBreach: false };
  }
  if (gaspMean <= 4.0) {
    return { modifier: -0.1, band: 'average externalization', floorBreach: false };
  }
  return { modifier: -0.25, band: 'poor externalization', floorBreach: false };
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
  let sd3NarcissismComponent = 0;
  let npiEntitlementComponent = 0;
  let rfqComponent = 0;
  const consistencyFlags: string[] = [];
  const straightLineFlags: string[] = [];
  const psychometricFloorBreaches: string[] = [];

  let brsBand = 'not assessed';
  if (scores.brsScore !== null) {
    const s = scores.brsScore;
    if (s >= 3.5) {
      brsComponent = 0;
      brsBand = 'strong resilience';
    } else if (s >= 2.5) {
      brsComponent = -0.1;
      brsBand = 'average resilience';
    } else if (s > 1.8) {
      brsComponent = -0.25;
      brsBand = 'poor resilience';
    } else {
      brsComponent = 0;
      brsBand = 'floor breach';
    }
    modifier += brsComponent;

    if (rawResponses?.brs && new Set(Object.values(rawResponses.brs)).size === 1) {
      straightLineFlags.push('brs_straight_line');
    }
  }

  let anxietyTraitBand = 'not assessed';
  if (scores.anxietyTraitScore !== null) {
    const s = scores.anxietyTraitScore;
    if (s < 2.5) {
      anxietyTraitComponent = 0;
      anxietyTraitBand = 'strong — low chronic anxiety';
    } else if (s < 3.5) {
      anxietyTraitComponent = -0.1;
      anxietyTraitBand = 'average anxiety';
    } else if (s < 4.9) {
      anxietyTraitComponent = -0.25;
      anxietyTraitBand = 'poor — high anxiety';
    } else {
      anxietyTraitComponent = 0;
      anxietyTraitBand = 'floor breach';
    }
    modifier += anxietyTraitComponent;

    if (rawResponses?.anxiety_trait && new Set(Object.values(rawResponses.anxiety_trait)).size === 1) {
      straightLineFlags.push('anxiety_trait_straight_line');
    }
  }

  let scsSfBand = 'not assessed';
  if (scores.scsSfScore !== null) {
    const s = scores.scsSfScore;
    // SCS-SF recalibrated: scores above midpoint (3.5+) should not trigger modifier penalties.
    // A score of 3.875 represents average-to-good self-compassion and is not a relational risk signal.
    // Penalty bands begin below 3.5, meaningful penalty below 2.5.
    if (s >= 3.5) {
      scsSfComponent = 0;
      scsSfBand = 'strong self-compassion';
    } else if (s >= 2.5) {
      scsSfComponent = -0.05;
      scsSfBand = 'below average self-compassion';
    } else if (s >= 2.0) {
      scsSfComponent = -0.1;
      scsSfBand = 'low self-compassion';
    } else {
      scsSfComponent = 0;
      scsSfBand = 'floor breach';
    }
    modifier += scsSfComponent;

    if (rawResponses?.scs_sf && new Set(Object.values(rawResponses.scs_sf)).size === 1) {
      straightLineFlags.push('scs_sf_straight_line');
    }

  }

  let gaspBand = 'not assessed';
  if (scores.gaspScore !== null) {
    const s = scores.gaspScore;
    const gaspResult = computeGaspExternalizationModifier(s, rawResponses?.gasp);
    gaspComponent = gaspResult.modifier;
    gaspBand = gaspResult.band;
    modifier += gaspComponent;

    if (rawResponses?.gasp) {
      const extValues = GASP_EXTERNALIZATION_ITEM_IDS.map((id) => rawResponses.gasp![id]).filter(
        (v): v is number => v != null,
      );
      if (extValues.length === GASP_EXTERNALIZATION_ITEM_IDS.length && new Set(extValues).size === 1) {
        straightLineFlags.push('gasp_straight_line');
      }
    }

    if (interviewSignals && s > 4.5 && (interviewSignals.accountabilityPillar ?? 0) >= 7) {
      consistencyFlags.push('gasp_consistency_review');
    }
  }

  let dweckBand = 'not assessed';
  if (scores.dweckScore !== null) {
    const s = scores.dweckScore;
    if (s >= 4.5) {
      dweckComponent = 0;
      dweckBand = 'strong growth mindset';
    } else if (s >= 3.5) {
      dweckComponent = -0.1;
      dweckBand = 'average mindset';
    } else if (s >= 2.4) {
      dweckComponent = -0.25;
      dweckBand = 'poor — fixed-leaning mindset';
    } else {
      dweckComponent = 0;
      dweckBand = 'floor breach';
    }
    modifier += dweckComponent;

    if (rawResponses?.dweck) {
      const values = Object.values(rawResponses.dweck);
      if (values.length === 10 && new Set(values).size === 1) {
        straightLineFlags.push('dweck_straight_line');
      }
    }

  }

  let aaq2Band = 'not assessed';
  if (scores.aaq2Score !== null) {
    const s = scores.aaq2Score;
    if (s <= 18) {
      aaq2Component = 0;
      aaq2Band = 'strong psychological flexibility';
    } else if (s <= 28) {
      aaq2Component = -0.1;
      aaq2Band = 'average flexibility';
    } else if (s < 33) {
      aaq2Component = -0.25;
      aaq2Band = 'poor flexibility';
    } else {
      aaq2Component = 0;
      aaq2Band = 'floor breach';
    }
    modifier += aaq2Component;

    if (rawResponses?.aaq2 && new Set(Object.values(rawResponses.aaq2)).size <= 2) {
      straightLineFlags.push('aaq2_straight_line');
    }

    if (interviewSignals) {
      const highAvoidance = s >= 25;
      const lowAvoidance = s <= 14;
      const behavioralAvoidance =
        interviewSignals.disclosureCalibration === 'underdisclosure' ||
        interviewSignals.moment5Concreteness === 'low' ||
        interviewSignals.moment5Concreteness === 'absent' ||
        (interviewSignals.personalMomentVocabDensity != null &&
          interviewSignals.personalMomentVocabDensity < 0.8) ||
        (interviewSignals.regulationPillar != null && interviewSignals.regulationPillar <= 5);
      const behavioralHealth =
        interviewSignals.disclosureCalibration === 'calibrated' &&
        (interviewSignals.moment5Concreteness === 'high' ||
          interviewSignals.moment5Concreteness === 'moderate') &&
        (interviewSignals.personalMomentVocabDensity ?? 0) >= 0.8 &&
        (interviewSignals.regulationPillar ?? 0) >= 7;

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
    if (s >= 30) {
      rsesComponent = 0;
      rsesBand = 'healthy self-esteem';
    } else if (s >= 25) {
      rsesComponent = -0.1;
      rsesBand = 'below average self-esteem';
    } else if (s >= 20) {
      rsesComponent = -0.15;
      rsesBand = 'low self-esteem';
    } else {
      rsesComponent = -0.25;
      rsesBand = 'very low self-esteem';
    }
    modifier += rsesComponent;

    if (rawResponses?.rses && new Set(Object.values(rawResponses.rses)).size <= 2) {
      straightLineFlags.push('rses_straight_line');
    }

    if (interviewSignals) {
      const lowSelfEsteem = s <= 19;
      const highSelfEsteem = s >= 30;
      const behavioralAccountability =
        (interviewSignals.accountabilityPillar ?? 0) >= 7 &&
        (interviewSignals.egoDevelopmentLevel ?? 0) >= 3;
      const behavioralLowAccountability =
        (interviewSignals.accountabilityPillar ?? 10) <= 3 &&
        (interviewSignals.egoDevelopmentLevel ?? 5) <= 2;

      if (lowSelfEsteem && behavioralAccountability) consistencyFlags.push('rses_consistency_review');
      if (highSelfEsteem && behavioralLowAccountability) consistencyFlags.push('rses_consistency_review');
    }
  }

  let sd3NarcissismBand = 'not assessed';
  let npiEntitlementBand = 'not assessed';
  if (NPI_ENTITLEMENT_ENABLED) {
    if (scores.npiEntitlementScore !== null) {
      const s = scores.npiEntitlementScore;
      if (s <= 2) {
        npiEntitlementComponent = 0;
        npiEntitlementBand = 'strong — low entitlement';
      } else if (s <= 4) {
        npiEntitlementComponent = -0.1;
        npiEntitlementBand = 'average entitlement';
      } else {
        npiEntitlementComponent = 0;
        npiEntitlementBand = 'floor breach';
      }
      modifier += npiEntitlementComponent;

      if (
        interviewSignals &&
        s >= 4 &&
        (interviewSignals.accountabilityPillar ?? 0) >= 7
      ) {
        consistencyFlags.push('npi_entitlement_accountability_divergence');
      }
    }
  } else if (scores.sd3NarcissismScore !== null) {
    const s = scores.sd3NarcissismScore;
    if (s <= 2.0) {
      sd3NarcissismComponent = 0;
      sd3NarcissismBand = 'strong — low narcissism';
    } else if (s <= 3.0) {
      sd3NarcissismComponent = -0.1;
      sd3NarcissismBand = 'average narcissism';
    } else if (s < 4.0) {
      sd3NarcissismComponent = -0.25;
      sd3NarcissismBand = 'poor — high narcissism';
    } else {
      sd3NarcissismComponent = 0;
      sd3NarcissismBand = 'floor breach';
    }
    modifier += sd3NarcissismComponent;

    if (
      rawResponses?.sd3_narcissism &&
      detectSd3NarcissismStraightLineFromResponses(rawResponses.sd3_narcissism)
    ) {
      straightLineFlags.push(SD3_NARCISSISM_STRAIGHT_LINE_FLAG);
    }

    if (interviewSignals && s > 3.5 && (interviewSignals.contemptPillar ?? 10) < 5.0) {
      consistencyFlags.push('sd3_narcissism_contempt_divergence');
    }
  }

  let rfqBand = 'not assessed';
  if (scores.rfqScore !== null) {
    const s = scores.rfqScore;
    if (s >= 5.0) {
      rfqComponent = 0;
      rfqBand = 'strong reflective functioning';
    } else if (s >= 3.5) {
      rfqComponent = -0.1;
      rfqBand = 'average reflective functioning';
    } else if (s >= 2.0) {
      rfqComponent = -0.25;
      rfqBand = 'poor reflective functioning';
    } else {
      rfqComponent = 0;
      rfqBand = 'floor breach';
    }
    modifier += rfqComponent;

    if (rawResponses?.rfq && detectRfqStraightLineFromResponses(rawResponses.rfq)) {
      straightLineFlags.push(RFQ_STRAIGHT_LINE_FLAG);
    }

    if (interviewSignals) {
      const mentalizing = interviewSignals.mentalizingPillar ?? null;
      if (mentalizing !== null) {
        if (s < 3.5 && mentalizing >= 7.0) {
          consistencyFlags.push('rfq_mentalizing_divergence_low_self_report');
        }
        if (s >= 5.5 && mentalizing <= 4.0) {
          consistencyFlags.push('rfq_mentalizing_divergence_high_self_report');
        }
      }
    }
  }

  modifier = Math.min(0, Math.round(modifier * 100) / 100);

  psychometricFloorBreaches.length = 0;
  psychometricFloorBreaches.push(
    ...collectPsychometricFloorGateFailReasons(
      {
        rfqScore: scores.rfqScore,
        gaspScore: scores.gaspScore,
        dweckScore: scores.dweckScore,
        scsSfScore: scores.scsSfScore,
        sd3NarcissismScore: scores.sd3NarcissismScore,
        npiEntitlementScore: scores.npiEntitlementScore,
        brsScore: scores.brsScore,
        anxietyTraitScore: scores.anxietyTraitScore,
        aaq2Score: scores.aaq2Score,
        rsesScore: scores.rsesScore,
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
      sd3NarcissismBand,
      npiEntitlementBand,
      rfqBand,
    },
  };
}
