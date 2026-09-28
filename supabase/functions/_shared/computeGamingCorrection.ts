import {
  GAMING_CORRECTION_LEVEL_SEVERE,
  GAMING_STRAIGHT_LINE_SEVERE_MIN_COUNT,
  isActiveNewUserModifierInstrument,
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
  /** Psych/interview divergence and uncertainty — metadata only, never changes the modifier. */
  reviewTriggers: GamingTrigger[];
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
    reviewTriggers: result.reviewTriggers.map((t) => ({ ...t })),
    explanation: result.explanation,
  };
}

function activeStraightLineInstruments(flags: string[]): string[] {
  const instruments: string[] = [];
  for (const flag of flags) {
    const instrument = flag.replace(/_straight_line$/, '');
    if (isActiveNewUserModifierInstrument(instrument) && !instruments.includes(instrument)) {
      instruments.push(instrument);
    }
  }
  return instruments;
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
  } = params;

  const activeTriggers: GamingTrigger[] = [];
  const reviewTriggers: GamingTrigger[] = [];
  const strippedInstruments = new Set<string>();
  const activeStraightLined = activeStraightLineInstruments(straightLineFlags);
  const activeStraightLineCount = activeStraightLined.length;

  if (activeStraightLineCount === 1) {
    const flaggedInstrument = activeStraightLined[0]!;
    activeTriggers.push({
      type: 'straight_line',
      instrument: flaggedInstrument,
      detail: `Straight-line response pattern detected on ${flaggedInstrument}. Positive modifier contribution from this instrument stripped.`,
      level: 1,
    });
    strippedInstruments.add(flaggedInstrument);
  } else if (activeStraightLineCount === 2) {
    activeTriggers.push({
      type: 'straight_line',
      detail: `${activeStraightLineCount} active-instrument straight-line flags detected. Positive contributions from live instruments stripped.`,
      level: 2,
    });
    for (const key of Object.keys(instrumentComponents)) {
      if (isActiveNewUserModifierInstrument(key)) strippedInstruments.add(key);
    }
  } else if (activeStraightLineCount >= GAMING_STRAIGHT_LINE_SEVERE_MIN_COUNT) {
    activeTriggers.push({
      type: 'straight_line',
      detail: `${activeStraightLineCount} active-instrument straight-line flags detected. Positive contributions from live instruments stripped (bounded strip; no extra penalty).`,
      level: GAMING_CORRECTION_LEVEL_SEVERE,
    });
    for (const key of Object.keys(instrumentComponents)) {
      if (isActiveNewUserModifierInstrument(key)) strippedInstruments.add(key);
    }
  }

  if (uncertaintyScore >= 0.6) {
    reviewTriggers.push({
      type: 'high_uncertainty',
      detail: `Uncertainty score ${uncertaintyScore.toFixed(2)} recorded as analytics/debug metadata only — no modifier change.`,
      level: uncertaintyScore >= 0.8 ? 3 : uncertaintyScore >= 0.7 ? 2 : 1,
    });
  }

  const maxLevel =
    activeTriggers.length > 0
      ? (Math.max(...activeTriggers.map((t) => t.level)) as 0 | 1 | 2 | 3)
      : 0;
  const additionalPenalty = 0;

  const liveKeys = Object.keys(instrumentComponents).filter(isActiveNewUserModifierInstrument);
  const allPositivesStripped =
    liveKeys.length > 0 && liveKeys.every((k) => strippedInstruments.has(k));

  let correctedModifier = 0;
  for (const [instrument, component] of Object.entries(instrumentComponents)) {
    if (!isActiveNewUserModifierInstrument(instrument)) continue;
    if (component > 0 && strippedInstruments.has(instrument)) continue;
    correctedModifier += component;
  }

  const correctionApplied = correctedModifier - totalModifier;

  let explanation = '';
  if (activeTriggers.length === 0) {
    explanation =
      'No score-affecting gaming indicators on active instruments. Full live psychometric modifier applied. Uncertainty and psych/interview divergence are review metadata only.';
  } else {
    const triggerSummary = activeTriggers.map((t) => t.detail).join(' | ');
    const stripNote = allPositivesStripped
      ? 'Instrument strip applied: positive contributions removed from all live instruments.'
      : `Instrument strip applied: positive contributions removed from ${[...strippedInstruments].join(', ')}.`;
    explanation = `Gaming correction level ${maxLevel} applied (straight-line on active instruments only). ${stripNote} No additional penalty. Triggers: ${triggerSummary}`;
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
    reviewTriggers,
    explanation,
  };
}
