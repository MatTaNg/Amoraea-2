import {
  GAMING_AAQ2_FLEXIBLE_MAX,
  GAMING_AAQ2_FLOOR_MIN,
  GAMING_ACCOUNTABILITY_STRONG_MIN,
  GAMING_ACCOUNTABILITY_WEAK_MAX,
  GAMING_BRS_FLOOR_MAX,
  GAMING_BRS_HIGH_MIN,
  GAMING_CONTEMPT_WEAK_MAX,
  GAMING_CORRECTION_LEVEL_SEVERE,
  GAMING_CORRECTION_MAX_PENALTY,
  GAMING_DIVERGENCE_SEVERE_MIN_COUNT,
  GAMING_DWECK_STRONG_MIN,
  GAMING_GASP_LOW_MAX,
  GAMING_MENTALIZING_WEAK_MAX,
  GAMING_REGULATION_STRONG_MIN,
  GAMING_REGULATION_WEAK_MAX,
  GAMING_RFQ_STRONG_MIN,
  GAMING_RSES_FLOOR_MAX,
  GAMING_RSES_HIGH_MIN,
  GAMING_SCS_SF_HIGH_MIN,
  GAMING_SD3_LOW_MAX,
  GAMING_STRAIGHT_LINE_SEVERE_MIN_COUNT,
  GAMING_UNCERTAINTY_TIER_MILD_MIN,
  GAMING_UNCERTAINTY_TIER_MODERATE_MIN,
  GAMING_UNCERTAINTY_TIER_SEVERE_MIN,
} from '../../../src/config/psychometrics/gamingCorrectionThresholds.ts';

export interface GamingCorrectionResult {
  correctedModifier: number;
  originalModifier: number;
  correctionApplied: number;
  additionalPenalty: number;
  strippedInstruments: string[];
  allPositivesStripped: boolean;
  correctionLevel: 0 | 1 | 2 | 3;
  activeTriggers: GamingTrigger[];
  explanation: string;
}

export interface GamingTrigger {
  type: 'straight_line' | 'consistency_divergence' | 'high_uncertainty';
  instrument?: string;
  detail: string;
  level: 1 | 2 | 3;
}

export interface InstrumentModifierComponents {
  gasp: number;
  brs: number;
  anxiety_trait: number;
  aaq2: number;
  rfq: number;
  mspss: number;
  sd3_narcissism: number;
  npi_entitlement: number;
  dweck: number;
  rses: number;
  scs_sf: number;
  scs: number;
}

export function instrumentComponentsFromModifierResult(result: {
  gaspComponent: number;
  brsComponent: number;
  anxietyTraitComponent: number;
  aaq2Component: number;
  rfqComponent: number;
  mspssComponent: number;
  sd3NarcissismComponent: number;
  npiEntitlementComponent?: number;
  dweckComponent: number;
  rsesComponent: number;
  scsSfComponent: number;
  scsComponent: number;
}): InstrumentModifierComponents {
  return {
    gasp: result.gaspComponent,
    brs: result.brsComponent,
    anxiety_trait: result.anxietyTraitComponent,
    aaq2: result.aaq2Component,
    rfq: result.rfqComponent,
    mspss: result.mspssComponent,
    sd3_narcissism: result.sd3NarcissismComponent,
    npi_entitlement: result.npiEntitlementComponent ?? 0,
    dweck: result.dweckComponent,
    rses: result.rsesComponent,
    scs_sf: result.scsSfComponent,
    scs: result.scsComponent,
  };
}

/** Plain JSON object for interview_attempts.gaming_correction (jsonb). */
export function gamingCorrectionForStorage(result: GamingCorrectionResult): GamingCorrectionResult {
  return {
    correctedModifier: result.correctedModifier,
    originalModifier: result.originalModifier,
    correctionApplied: result.correctionApplied,
    additionalPenalty: result.additionalPenalty,
    strippedInstruments: [...result.strippedInstruments],
    allPositivesStripped: result.allPositivesStripped,
    correctionLevel: result.correctionLevel,
    activeTriggers: result.activeTriggers.map((t) => ({ ...t })),
    explanation: result.explanation,
  };
}

export function computeGamingCorrection(params: {
  instrumentComponents: InstrumentModifierComponents;
  totalModifier: number;
  straightLineFlags: string[];
  uncertaintyScore: number;
  pillarScores: {
    mentalizing: number | null;
    accountability: number | null;
    contempt: number | null;
    regulation: number | null;
  };
  psychometricScores: {
    rfq: number | null;
    gasp: number | null;
    brs: number | null;
    scs_sf: number | null;
    aaq2: number | null;
    rses: number | null;
    sd3_narcissism: number | null;
    npi_entitlement: number | null;
    dweck: number | null;
  };
}): GamingCorrectionResult {
  const {
    instrumentComponents,
    totalModifier,
    straightLineFlags,
    uncertaintyScore,
    pillarScores,
    psychometricScores,
  } = params;

  const activeTriggers: GamingTrigger[] = [];
  const strippedInstruments = new Set<string>();

  const straightLineCount = straightLineFlags.length;

  if (straightLineCount === 1) {
    const flaggedInstrument = straightLineFlags[0].replace('_straight_line', '');
    activeTriggers.push({
      type: 'straight_line',
      instrument: flaggedInstrument,
      detail: `Straight-line response pattern detected on ${flaggedInstrument}. Positive modifier contribution from this instrument stripped.`,
      level: 1,
    });
    strippedInstruments.add(flaggedInstrument);
  } else if (straightLineCount >= 2 && straightLineCount < 3) {
    activeTriggers.push({
      type: 'straight_line',
      detail: `${straightLineCount} straight-line flags detected. All positive modifier contributions stripped.`,
      level: 2,
    });
    Object.keys(instrumentComponents).forEach((k) => {
      if (k !== 'npi_entitlement') strippedInstruments.add(k);
    });
  } else if (straightLineCount >= GAMING_STRAIGHT_LINE_SEVERE_MIN_COUNT) {
    activeTriggers.push({
      type: 'straight_line',
      detail: `${straightLineCount} straight-line flags detected. All positive modifier contributions stripped (no additional penalty — straight-line alone).`,
      level: GAMING_CORRECTION_LEVEL_SEVERE,
    });
    Object.keys(instrumentComponents).forEach((k) => {
      if (k !== 'npi_entitlement') strippedInstruments.add(k);
    });
  }

  const divergences: { instrument: string; detail: string }[] = [];

  const checkDivergence = (condition: boolean, instrument: string, detail: string) => {
    if (condition) divergences.push({ instrument, detail });
  };

  const p = pillarScores;
  const ps = psychometricScores;

  checkDivergence(
    ps.rfq !== null &&
      ps.rfq >= GAMING_RFQ_STRONG_MIN &&
      p.mentalizing !== null &&
      p.mentalizing <= GAMING_MENTALIZING_WEAK_MAX,
    'rfq',
    `RFQ self-reports strong mentalization (${ps.rfq}) but interview mentalizing pillar is low (${p.mentalizing}). RFQ positive contribution stripped.`,
  );

  checkDivergence(
    ps.gasp !== null &&
      ps.gasp <= GAMING_GASP_LOW_MAX &&
      p.accountability !== null &&
      p.accountability <= GAMING_ACCOUNTABILITY_WEAK_MAX,
    'gasp',
    `GASP self-reports low externalization (${ps.gasp}) but interview accountability is low (${p.accountability}). GASP positive contribution stripped.`,
  );

  checkDivergence(
    ps.gasp !== null && ps.gasp <= GAMING_GASP_LOW_MAX && p.contempt !== null && p.contempt <= GAMING_CONTEMPT_WEAK_MAX,
    'gasp',
    `GASP self-reports low externalization (${ps.gasp}) but interview contempt is low (${p.contempt}). GASP positive contribution stripped.`,
  );

  checkDivergence(
    ps.brs !== null && ps.brs >= GAMING_BRS_HIGH_MIN && p.regulation !== null && p.regulation <= GAMING_REGULATION_WEAK_MAX,
    'brs',
    `BRS self-reports high resilience (${ps.brs}) but interview regulation is low (${p.regulation}). BRS positive contribution stripped.`,
  );

  checkDivergence(
    ps.brs !== null && ps.brs <= GAMING_BRS_FLOOR_MAX && p.regulation !== null && p.regulation >= GAMING_REGULATION_STRONG_MIN,
    'brs',
    `BRS self-reports very low resilience (${ps.brs}) but interview regulation is strong (${p.regulation}). BRS negative contribution may understate behavioral stability.`,
  );

  checkDivergence(
    ps.aaq2 !== null && ps.aaq2 >= GAMING_AAQ2_FLOOR_MIN && p.regulation !== null && p.regulation >= GAMING_REGULATION_STRONG_MIN,
    'aaq2',
    `AAQ-II self-reports severe experiential avoidance (${ps.aaq2}) but interview regulation is strong (${p.regulation}). AAQ-II negative contribution may understate behavioral flexibility.`,
  );

  checkDivergence(
    ps.rses !== null && ps.rses <= GAMING_RSES_FLOOR_MAX && p.accountability !== null && p.accountability >= GAMING_ACCOUNTABILITY_STRONG_MIN,
    'rses',
    `RSES self-reports low self-esteem (${ps.rses}) but interview accountability is strong (${p.accountability}). RSES negative contribution may understate relational self-worth signals.`,
  );

  checkDivergence(
    ps.scs_sf !== null &&
      ps.scs_sf >= GAMING_SCS_SF_HIGH_MIN &&
      p.accountability !== null &&
      p.accountability <= GAMING_ACCOUNTABILITY_WEAK_MAX,
    'scs_sf',
    `SCS-SF self-reports high self-compassion (${ps.scs_sf}) but interview accountability is low (${p.accountability}). SCS-SF positive contribution stripped.`,
  );

  checkDivergence(
    ps.aaq2 !== null && ps.aaq2 <= GAMING_AAQ2_FLEXIBLE_MAX && p.regulation !== null && p.regulation <= GAMING_REGULATION_WEAK_MAX,
    'aaq2',
    `AAQ-II self-reports high flexibility (${ps.aaq2}) but interview regulation is low (${p.regulation}). AAQ-II positive contribution stripped.`,
  );

  checkDivergence(
    ps.rses !== null &&
      ps.rses >= GAMING_RSES_HIGH_MIN &&
      p.accountability !== null &&
      p.accountability <= GAMING_ACCOUNTABILITY_WEAK_MAX,
    'rses',
    `RSES self-reports high self-esteem (${ps.rses}) but interview accountability is low (${p.accountability}). RSES positive contribution stripped.`,
  );

  checkDivergence(
    ps.sd3_narcissism !== null &&
      ps.sd3_narcissism <= GAMING_SD3_LOW_MAX &&
      p.contempt !== null &&
      p.contempt <= GAMING_CONTEMPT_WEAK_MAX,
    'sd3_narcissism',
    `SD3 self-reports low narcissism (${ps.sd3_narcissism}) but interview contempt is low (${p.contempt}). SD3 positive contribution stripped.`,
  );

  checkDivergence(
    ps.dweck !== null &&
      ps.dweck >= GAMING_DWECK_STRONG_MIN &&
      p.mentalizing !== null &&
      p.mentalizing <= GAMING_MENTALIZING_WEAK_MAX,
    'dweck',
    `Dweck/RBI self-reports strong growth mindset (${ps.dweck}) but interview mentalizing is low (${p.mentalizing}). Dweck positive contribution stripped.`,
  );

  const divergenceCount = divergences.length;

  if (divergenceCount === 1) {
    activeTriggers.push({
      type: 'consistency_divergence',
      instrument: divergences[0].instrument,
      detail: divergences[0].detail,
      level: 1,
    });
    strippedInstruments.add(divergences[0].instrument);
  } else if (divergenceCount === 2) {
    divergences.forEach((d) => {
      activeTriggers.push({
        type: 'consistency_divergence',
        instrument: d.instrument,
        detail: d.detail,
        level: 2,
      });
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  } else if (divergenceCount >= GAMING_DIVERGENCE_SEVERE_MIN_COUNT) {
    divergences.forEach((d) => {
      activeTriggers.push({
        type: 'consistency_divergence',
        instrument: d.instrument,
        detail: d.detail,
        level: 3,
      });
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  }

  if (uncertaintyScore >= GAMING_UNCERTAINTY_TIER_MILD_MIN && uncertaintyScore < GAMING_UNCERTAINTY_TIER_MODERATE_MIN) {
    activeTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} — positive contributions stripped from flagged instruments.`,
      level: 1,
    });
  } else if (uncertaintyScore >= GAMING_UNCERTAINTY_TIER_MODERATE_MIN && uncertaintyScore < GAMING_UNCERTAINTY_TIER_SEVERE_MIN) {
    activeTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} — all positive modifier contributions stripped.`,
      level: 2,
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  } else if (uncertaintyScore >= GAMING_UNCERTAINTY_TIER_SEVERE_MIN) {
    const uncertaintyPenaltyNote =
      straightLineFlags.length > 0
        ? 'all positive modifier contributions stripped (no additional penalty when straight-line flags present)'
        : `all positive modifier contributions stripped and ${GAMING_CORRECTION_MAX_PENALTY} penalty applied`;
    activeTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} — ${uncertaintyPenaltyNote}.`,
      level: GAMING_CORRECTION_LEVEL_SEVERE,
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  }

  const maxLevel =
    activeTriggers.length > 0
      ? (Math.max(...activeTriggers.map((t) => t.level)) as 0 | 1 | 2 | 3)
      : 0;

  /** Level 3 straight-line only strips positives; -0.3 applies for stronger L3 signals (divergence, or high uncertainty without straight-line). */
  const hasLevel3ConsistencyDivergence = activeTriggers.some(
    (t) => t.type === 'consistency_divergence' && t.level >= GAMING_CORRECTION_LEVEL_SEVERE,
  );
  const hasLevel3HighUncertainty = activeTriggers.some(
    (t) => t.type === 'high_uncertainty' && t.level >= GAMING_CORRECTION_LEVEL_SEVERE,
  );
  const hasAnyStraightLine = straightLineFlags.length > 0;
  const shouldApplyAdditionalPenalty =
    maxLevel >= GAMING_CORRECTION_LEVEL_SEVERE &&
    (hasLevel3ConsistencyDivergence || (hasLevel3HighUncertainty && !hasAnyStraightLine));
  const additionalPenalty = shouldApplyAdditionalPenalty ? GAMING_CORRECTION_MAX_PENALTY : 0;

  const allPositivesStripped =
    strippedInstruments.size === Object.keys(instrumentComponents).length;

  let correctedModifier = 0;
  for (const [instrument, component] of Object.entries(instrumentComponents)) {
    if (component > 0 && strippedInstruments.has(instrument)) {
      continue;
    }
    correctedModifier += component;
  }
  correctedModifier += additionalPenalty;

  const correctionApplied = correctedModifier - totalModifier;

  let explanation = '';
  if (activeTriggers.length === 0) {
    explanation = 'No gaming indicators detected. Full psychometric modifier applied.';
  } else {
    const triggerSummary = activeTriggers.map((t) => t.detail).join(' | ');
    const stripNote = allPositivesStripped
      ? 'Instrument strip applied: all positive modifier contributions removed.'
      : `Instrument strip applied: positive contributions removed from ${[...strippedInstruments].join(', ')}.`;
    const penaltyNote =
      additionalPenalty < 0
        ? `Additional penalty of ${additionalPenalty} applied (level-3 consistency divergence${hasLevel3HighUncertainty && !hasAnyStraightLine ? ' or high uncertainty without straight-line flags' : ''}).`
        : maxLevel >= GAMING_CORRECTION_LEVEL_SEVERE && hasAnyStraightLine
          ? 'No additional penalty applied (straight-line flags present — instrument strip only).'
          : 'No additional penalty applied.';
    explanation = `Gaming correction level ${maxLevel} applied. ${stripNote} ${penaltyNote} Triggers: ${triggerSummary}`;
  }

  return {
    correctedModifier: Math.round(correctedModifier * 1000) / 1000,
    originalModifier: totalModifier,
    correctionApplied: Math.round(correctionApplied * 1000) / 1000,
    additionalPenalty,
    strippedInstruments: [...strippedInstruments],
    allPositivesStripped,
    correctionLevel: maxLevel,
    activeTriggers,
    explanation,
  };
}
