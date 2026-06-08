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
  scsPublicScore: number | null;
  scsPrivateScore: number | null;
  mspssFriendsScore: number | null;
  mspssFamilyScore: number | null;
  sd3NarcissismScore: number | null;
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
    rfqBand: string;
  };
}

/**
 * Sums per-instrument three-tier band penalties into a single psychometric modifier applied to the final gate score.
 * Each instrument uses strong (0), average (-0.10), or poor (-0.25) bands; extreme scores are handled by floor
 * breaches, not additional modifier tiers. Range is [worst-case negative sum, 0] — never a positive boost.
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
    if (s >= 4.0) {
      scsSfComponent = 0;
      scsSfBand = 'strong self-compassion';
    } else if (s >= 3.0) {
      scsSfComponent = -0.1;
      scsSfBand = 'average self-compassion';
    } else if (s >= 2.5) {
      scsSfComponent = -0.25;
      scsSfBand = 'poor self-compassion';
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
    if (s <= 2.5) {
      gaspComponent = 0;
      gaspBand = 'strong — low externalization';
    } else if (s <= 3.5) {
      gaspComponent = -0.1;
      gaspBand = 'average externalization';
    } else if (s < 4.6) {
      gaspComponent = -0.25;
      gaspBand = 'poor externalization';
    } else {
      gaspComponent = 0;
      gaspBand = 'floor breach';
    }
    modifier += gaspComponent;

    if (rawResponses?.gasp && new Set(Object.values(rawResponses.gasp)).size === 1) {
      straightLineFlags.push('gasp_straight_line');
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
    if (s >= 33) {
      rsesComponent = 0;
      rsesBand = 'strong self-esteem';
    } else if (s >= 28) {
      rsesComponent = -0.1;
      rsesBand = 'average self-esteem';
    } else if (s > 24) {
      rsesComponent = -0.25;
      rsesBand = 'poor self-esteem';
    } else {
      rsesComponent = 0;
      rsesBand = 'floor breach';
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

  let scsOrientation = 'not assessed';
  if (scores.scsPublicScore !== null && scores.scsPrivateScore !== null) {
    const diff = scores.scsPrivateScore - scores.scsPublicScore;

    if (diff >= 2) {
      scsComponent = 0;
      scsOrientation = 'strong internal orientation';
    } else if (diff >= -2) {
      scsComponent = -0.1;
      scsOrientation = 'balanced to mildly external';
    } else {
      scsComponent = -0.25;
      scsOrientation = 'poor — externally oriented';
    }
    modifier += scsComponent;

    if (rawResponses?.scs && new Set(Object.values(rawResponses.scs)).size <= 2) {
      straightLineFlags.push('scs_straight_line');
    }

    if (interviewSignals) {
      const stronglyExternal = diff <= -7;
      const behavioralInternal =
        interviewSignals.disclosureCalibration === 'calibrated' &&
        (interviewSignals.moment4Concreteness === 'high' ||
          interviewSignals.moment5Concreteness === 'high') &&
        (interviewSignals.personalMomentVocabDensity ?? 0) >= 1.0;

      if (stronglyExternal && behavioralInternal) consistencyFlags.push('scs_consistency_review');
    }
  }

  let mspssBand = 'not assessed';
  if (scores.mspssFriendsScore !== null) {
    const s = scores.mspssFriendsScore;
    if (s >= 5.5) {
      mspssComponent = 0;
      mspssBand = 'strong social network';
    } else if (s >= 4.0) {
      mspssComponent = 0;
      mspssBand = 'adequate social network';
    } else if (s >= 2.5) {
      mspssComponent = -0.1;
      mspssBand = 'limited social network';
    } else {
      mspssComponent = -0.2;
      mspssBand = 'isolated — high dependency risk';
    }
    modifier += mspssComponent;

    if (rawResponses?.mspss) {
      const values = Object.values(rawResponses.mspss);
      if (values.length === 8 && new Set(values).size === 1 && (values[0] === 1 || values[0] === 7)) {
        straightLineFlags.push('mspss_straight_line');
      }
    }
  }

  let sd3NarcissismBand = 'not assessed';
  if (scores.sd3NarcissismScore !== null) {
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
        brsScore: scores.brsScore,
        anxietyTraitScore: scores.anxietyTraitScore,
        aaq2Score: scores.aaq2Score,
        rsesScore: scores.rsesScore,
        scsPublicScore: scores.scsPublicScore,
        scsPrivateScore: scores.scsPrivateScore,
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
      rfqBand,
    },
  };
}
