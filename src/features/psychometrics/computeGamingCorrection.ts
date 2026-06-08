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
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  } else if (straightLineCount >= 3) {
    activeTriggers.push({
      type: 'straight_line',
      detail: `${straightLineCount} straight-line flags detected. All positive modifier contributions stripped and -0.3 penalty applied.`,
      level: 3,
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  }

  const divergences: { instrument: string; detail: string }[] = [];

  const checkDivergence = (condition: boolean, instrument: string, detail: string) => {
    if (condition) divergences.push({ instrument, detail });
  };

  const p = pillarScores;
  const ps = psychometricScores;

  checkDivergence(
    ps.rfq !== null &&
      ps.rfq >= 5.0 &&
      p.mentalizing !== null &&
      p.mentalizing <= 4.5,
    'rfq',
    `RFQ self-reports strong mentalization (${ps.rfq}) but interview mentalizing pillar is low (${p.mentalizing}). RFQ positive contribution stripped.`,
  );

  checkDivergence(
    ps.gasp !== null &&
      ps.gasp <= 2.5 &&
      p.accountability !== null &&
      p.accountability <= 4.5,
    'gasp',
    `GASP self-reports low externalization (${ps.gasp}) but interview accountability is low (${p.accountability}). GASP positive contribution stripped.`,
  );

  checkDivergence(
    ps.gasp !== null && ps.gasp <= 2.5 && p.contempt !== null && p.contempt <= 5.0,
    'gasp',
    `GASP self-reports low externalization (${ps.gasp}) but interview contempt is low (${p.contempt}). GASP positive contribution stripped.`,
  );

  checkDivergence(
    ps.brs !== null && ps.brs >= 4.0 && p.regulation !== null && p.regulation <= 4.5,
    'brs',
    `BRS self-reports high resilience (${ps.brs}) but interview regulation is low (${p.regulation}). BRS positive contribution stripped.`,
  );

  checkDivergence(
    ps.brs !== null && ps.brs <= 1.8 && p.regulation !== null && p.regulation >= 7.0,
    'brs',
    `BRS self-reports very low resilience (${ps.brs}) but interview regulation is strong (${p.regulation}). BRS negative contribution may understate behavioral stability.`,
  );

  checkDivergence(
    ps.aaq2 !== null && ps.aaq2 >= 33 && p.regulation !== null && p.regulation >= 7.0,
    'aaq2',
    `AAQ-II self-reports severe experiential avoidance (${ps.aaq2}) but interview regulation is strong (${p.regulation}). AAQ-II negative contribution may understate behavioral flexibility.`,
  );

  checkDivergence(
    ps.rses !== null && ps.rses <= 24 && p.accountability !== null && p.accountability >= 7.0,
    'rses',
    `RSES self-reports low self-esteem (${ps.rses}) but interview accountability is strong (${p.accountability}). RSES negative contribution may understate relational self-worth signals.`,
  );

  checkDivergence(
    ps.scs_sf !== null &&
      ps.scs_sf >= 4.0 &&
      p.accountability !== null &&
      p.accountability <= 4.5,
    'scs_sf',
    `SCS-SF self-reports high self-compassion (${ps.scs_sf}) but interview accountability is low (${p.accountability}). SCS-SF positive contribution stripped.`,
  );

  checkDivergence(
    ps.aaq2 !== null && ps.aaq2 <= 14 && p.regulation !== null && p.regulation <= 4.5,
    'aaq2',
    `AAQ-II self-reports high flexibility (${ps.aaq2}) but interview regulation is low (${p.regulation}). AAQ-II positive contribution stripped.`,
  );

  checkDivergence(
    ps.rses !== null &&
      ps.rses >= 30 &&
      p.accountability !== null &&
      p.accountability <= 4.5,
    'rses',
    `RSES self-reports high self-esteem (${ps.rses}) but interview accountability is low (${p.accountability}). RSES positive contribution stripped.`,
  );

  checkDivergence(
    ps.sd3_narcissism !== null &&
      ps.sd3_narcissism <= 2.0 &&
      p.contempt !== null &&
      p.contempt <= 5.0,
    'sd3_narcissism',
    `SD3 self-reports low narcissism (${ps.sd3_narcissism}) but interview contempt is low (${p.contempt}). SD3 positive contribution stripped.`,
  );

  checkDivergence(
    ps.dweck !== null &&
      ps.dweck >= 4.5 &&
      p.mentalizing !== null &&
      p.mentalizing <= 4.5,
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
  } else if (divergenceCount >= 3) {
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

  if (uncertaintyScore >= 0.6 && uncertaintyScore < 0.7) {
    activeTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} — positive contributions stripped from flagged instruments.`,
      level: 1,
    });
  } else if (uncertaintyScore >= 0.7 && uncertaintyScore < 0.8) {
    activeTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} — all positive modifier contributions stripped.`,
      level: 2,
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  } else if (uncertaintyScore >= 0.8) {
    activeTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} — all positive modifier contributions stripped and -0.3 penalty applied.`,
      level: 3,
    });
    Object.keys(instrumentComponents).forEach((k) => strippedInstruments.add(k));
  }

  const maxLevel =
    activeTriggers.length > 0
      ? (Math.max(...activeTriggers.map((t) => t.level)) as 0 | 1 | 2 | 3)
      : 0;

  const additionalPenalty = maxLevel >= 3 ? -0.3 : 0;

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
    explanation = `Gaming correction level ${maxLevel} applied. ${
      allPositivesStripped
        ? 'All positive modifier contributions stripped.'
        : `Positive contributions stripped from: ${[...strippedInstruments].join(', ')}.`
    }${additionalPenalty < 0 ? ` Additional penalty of ${additionalPenalty} applied.` : ''} Triggers: ${triggerSummary}`;
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
