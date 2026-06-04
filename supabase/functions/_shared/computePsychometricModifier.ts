import {
  detectRfqStraightLineFromResponses,
  RFQ_STRAIGHT_LINE_FLAG,
  collectPsychometricFloorGateFailReasons,
} from './psychometricFloorBreaches.ts';
import {
  detectSd3NarcissismStraightLineFromResponses,
  SD3_NARCISSISM_STRAIGHT_LINE_FLAG,
} from './sd3NarcissismFloor.ts';

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
 * Sums per-instrument band penalties into a single psychometric modifier applied to the final gate score.
 * Range is [worst-case negative sum, 0] — favorable self-report bands contribute 0, never a positive boost.
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
    if (s >= 4.0) {
      brsComponent = 0;
      brsBand = 'high resilience';
    } else if (s >= 3.0) {
      brsComponent = 0;
      brsBand = 'moderate resilience';
    } else {
      brsComponent = -0.15;
      brsBand = 'low resilience';
    }
    modifier += brsComponent;

    if (rawResponses?.brs && new Set(Object.values(rawResponses.brs)).size === 1) {
      straightLineFlags.push('brs_straight_line');
    }
  }

  let anxietyTraitBand = 'not assessed';
  if (scores.anxietyTraitScore !== null) {
    const s = scores.anxietyTraitScore;
    if (s >= 4.0) {
      anxietyTraitComponent = -0.15;
      anxietyTraitBand = 'high chronic anxiety';
    } else if (s >= 3.0) {
      anxietyTraitComponent = 0;
      anxietyTraitBand = 'moderate anxiety';
    } else {
      anxietyTraitComponent = 0;
      anxietyTraitBand = 'low anxiety';
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
      scsSfBand = 'high self-compassion';
    } else if (s >= 3.0) {
      scsSfComponent = 0;
      scsSfBand = 'moderate self-compassion';
    } else {
      scsSfComponent = -0.2;
      scsSfBand = 'low self-compassion';
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
      gaspBand = 'low externalization';
    } else if (s <= 4.5) {
      gaspComponent = 0;
      gaspBand = 'moderate externalization';
    } else {
      gaspComponent = -0.25;
      gaspBand = 'high externalization';
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
      dweckBand = 'growth mindset';
    } else if (s >= 3.5) {
      dweckComponent = 0;
      dweckBand = 'mixed mindset';
    } else if (s >= 2.5) {
      dweckComponent = -0.1;
      dweckBand = 'fixed-leaning mindset';
    } else {
      dweckComponent = -0.2;
      dweckBand = 'fixed mindset';
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
    if (s <= 14) {
      aaq2Component = 0;
      aaq2Band = 'high flexibility';
    } else if (s <= 24) {
      aaq2Component = 0;
      aaq2Band = 'moderate flexibility';
    } else if (s <= 34) {
      aaq2Component = -0.2;
      aaq2Band = 'mild avoidance';
    } else if (s <= 44) {
      aaq2Component = -0.4;
      aaq2Band = 'high avoidance';
    } else {
      aaq2Component = -0.6;
      aaq2Band = 'severe avoidance';
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
    if (s >= 30) {
      rsesComponent = 0;
      rsesBand = 'high self-esteem';
    } else if (s >= 23) {
      rsesComponent = 0;
      rsesBand = 'moderate-high self-esteem';
    } else if (s >= 17) {
      rsesComponent = -0.2;
      rsesBand = 'moderate-low self-esteem';
    } else if (s >= 11) {
      rsesComponent = -0.4;
      rsesBand = 'low self-esteem';
    } else {
      rsesComponent = -0.6;
      rsesBand = 'floor self-esteem';
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

    if (diff >= 4) {
      scsComponent = 0;
      scsOrientation = 'strongly internally oriented';
    } else if (diff >= 1) {
      scsComponent = 0;
      scsOrientation = 'mildly internally oriented';
    } else if (diff >= -1) {
      scsComponent = 0;
      scsOrientation = 'balanced';
    } else if (diff >= -4) {
      scsComponent = -0.1;
      scsOrientation = 'mildly externally oriented';
    } else if (diff >= -6) {
      scsComponent = -0.1;
      scsOrientation = 'moderately externally oriented';
    } else {
      scsComponent = -0.2;
      scsOrientation = 'strongly externally oriented';
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
      sd3NarcissismBand = 'low narcissism';
    } else if (s <= 3.5) {
      sd3NarcissismComponent = 0;
      sd3NarcissismBand = 'moderate narcissism';
    } else {
      sd3NarcissismComponent = -0.25;
      sd3NarcissismBand = 'high narcissism';
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
      rfqComponent = 0;
      rfqBand = 'moderate reflective functioning';
    } else {
      rfqComponent = -0.15;
      rfqBand = 'limited reflective functioning';
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
      },
      straightLineFlags,
      { aaq2Score: scores.aaq2Score, rsesScore: scores.rsesScore },
    ),
  );

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
