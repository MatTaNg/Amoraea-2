import { describe, expect, it } from '@jest/globals';
import {
  computeGamingCorrection,
  type InstrumentModifierComponents,
} from '../computeGamingCorrection';

const LIVE_POSITIVE: InstrumentModifierComponents = {
  gasp: 0.1,
  brs: 0.1,
  anxiety_trait: 0,
  aaq2: 0.1,
  rfq: 0.15,
  mspss: 0,
  sd3_narcissism: 0,
  npi_entitlement: 0,
  dweck: 0.05,
  rses: -0.4,
  scs_sf: 0.15,
  scs: 0,
};

const ZERO_PILLARS = {
  mentalizing: null,
  accountability: null,
  contempt: null,
  regulation: null,
};

const ZERO_PSYCH = {
  rfq: null,
  gasp: null,
  brs: null,
  scs_sf: null,
  aaq2: null,
  rses: null,
  sd3_narcissism: null,
  npi_entitlement: null,
  dweck: null,
};

function liveModifier(components: InstrumentModifierComponents): number {
  return (
    components.gasp +
    components.brs +
    components.anxiety_trait +
    components.rses +
    components.scs_sf
  );
}

function runCorrection(
  overrides: Partial<Parameters<typeof computeGamingCorrection>[0]> = {},
  components: InstrumentModifierComponents = LIVE_POSITIVE,
) {
  return computeGamingCorrection({
    instrumentComponents: components,
    totalModifier: liveModifier(components),
    straightLineFlags: [],
    uncertaintyScore: 0.3,
    pillarScores: ZERO_PILLARS,
    psychometricScores: ZERO_PSYCH,
    ...overrides,
  });
}

describe('computeGamingCorrection', () => {
  it('applies no score correction when there are no active-instrument gaming indicators', () => {
    const live = liveModifier(LIVE_POSITIVE);
    const result = runCorrection();
    expect(result.correctionLevel).toBe(0);
    expect(result.correctedModifier).toBeCloseTo(live, 3);
    expect(result.correctionApplied).toBe(0);
    expect(result.additionalPenalty).toBe(0);
    expect(result.strippedInstruments).toEqual([]);
  });

  it('retired RFQ/AAQ straight-line flags do not strip instruments or change the modifier', () => {
    const live = liveModifier(LIVE_POSITIVE);
    const rfq = runCorrection({ straightLineFlags: ['rfq_straight_line'] });
    expect(rfq.correctionLevel).toBe(0);
    expect(rfq.strippedInstruments).toEqual([]);
    expect(rfq.correctedModifier).toBeCloseTo(live, 3);

    const aaq = runCorrection({ straightLineFlags: ['aaq2_straight_line'] });
    expect(aaq.correctionLevel).toBe(0);
    expect(aaq.strippedInstruments).toEqual([]);
    expect(aaq.correctedModifier).toBeCloseTo(live, 3);
  });

  it('level 1 active-instrument straight-line strips only that instrument’s positive contribution', () => {
    const live = liveModifier(LIVE_POSITIVE);
    const result = runCorrection({ straightLineFlags: ['gasp_straight_line'] });
    expect(result.correctionLevel).toBe(1);
    expect(result.strippedInstruments).toEqual(['gasp']);
    expect(result.correctedModifier).toBeCloseTo(live - 0.1, 3);
    expect(result.additionalPenalty).toBe(0);
  });

  it('level 2 active-instrument straight-line strips all live positives and keeps negatives', () => {
    const result = runCorrection({
      straightLineFlags: ['gasp_straight_line', 'brs_straight_line'],
    });
    expect(result.correctionLevel).toBe(2);
    expect(result.allPositivesStripped).toBe(true);
    expect(result.correctedModifier).toBe(-0.4);
    expect(result.additionalPenalty).toBe(0);
  });

  it('level 3 active-instrument straight-line strips live positives with no extra penalty', () => {
    const result = runCorrection({
      straightLineFlags: ['gasp_straight_line', 'brs_straight_line', 'scs_sf_straight_line'],
    });
    expect(result.correctionLevel).toBe(3);
    expect(result.correctedModifier).toBe(-0.4);
    expect(result.additionalPenalty).toBe(0);
  });

  it('psych/interview divergence is review metadata only and does not change the modifier', () => {
    const live = liveModifier(LIVE_POSITIVE);
    const result = runCorrection({
      pillarScores: { mentalizing: 4.0, accountability: 4.0, contempt: 4.0, regulation: 4.0 },
      psychometricScores: { ...ZERO_PSYCH, rfq: 5.5, brs: 4.5, scs_sf: 4.5 },
    });
    expect(result.correctionLevel).toBe(0);
    expect(result.correctedModifier).toBeCloseTo(live, 3);
    expect(result.additionalPenalty).toBe(0);
  });

  it('high uncertainty is review metadata only and does not change the modifier', () => {
    const live = liveModifier(LIVE_POSITIVE);
    const mild = runCorrection({ uncertaintyScore: 0.72 });
    expect(mild.correctionLevel).toBe(0);
    expect(mild.correctedModifier).toBeCloseTo(live, 3);
    expect(mild.reviewTriggers.some((t) => t.type === 'high_uncertainty')).toBe(true);

    const severe = runCorrection({ uncertaintyScore: 0.85 });
    expect(severe.correctionLevel).toBe(0);
    expect(severe.correctedModifier).toBeCloseTo(live, 3);
    expect(severe.additionalPenalty).toBe(0);
    expect(severe.reviewTriggers.some((t) => t.type === 'high_uncertainty')).toBe(true);
  });

  it('identical live scores keep the same corrected modifier across uncertainty values', () => {
    const low = runCorrection({ uncertaintyScore: 0.1 });
    const high = runCorrection({ uncertaintyScore: 0.95 });
    expect(low.correctedModifier).toBe(high.correctedModifier);
  });

  it('Gina-like case: gasp straight-line plus high uncertainty strips without extra penalty', () => {
    const components: InstrumentModifierComponents = {
      gasp: 0,
      brs: 0,
      anxiety_trait: 0,
      aaq2: 0,
      rfq: 0,
      mspss: 0,
      sd3_narcissism: 0,
      npi_entitlement: 0,
      dweck: 0,
      rses: -0.2,
      scs_sf: 0,
      scs: 0,
    };
    const result = runCorrection(
      {
        straightLineFlags: ['gasp_straight_line'],
        uncertaintyScore: 1.0,
      },
      components,
    );
    expect(result.correctionLevel).toBe(1);
    expect(result.additionalPenalty).toBe(0);
    expect(result.correctedModifier).toBe(-0.2);
    expect(result.reviewTriggers.some((t) => t.type === 'high_uncertainty')).toBe(true);
  });
});
