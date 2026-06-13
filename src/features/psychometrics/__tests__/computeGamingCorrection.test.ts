import { describe, expect, it } from '@jest/globals';
import {
  computeGamingCorrection,
  type InstrumentModifierComponents,
} from '../computeGamingCorrection';

const POSITIVE_COMPONENTS: InstrumentModifierComponents = {
  gasp: 0.1,
  brs: 0.1,
  anxiety_trait: 0,
  aaq2: 0.1,
  rfq: 0.15,
  sd3_narcissism: 0,
  dweck: 0.05,
  rses: -0.4,
  scs_sf: 0.15,
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

function totalModifier(components: InstrumentModifierComponents): number {
  return Object.values(components).reduce((a, b) => a + b, 0);
}

describe('computeGamingCorrection', () => {
  it('applies no correction when no gaming indicators', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: [],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(0);
    expect(result.correctedModifier).toBeCloseTo(total, 3);
    expect(result.correctionApplied).toBe(0);
    expect(result.additionalPenalty).toBe(0);
  });

  it('level 1 straight-line strips only flagged instrument positive', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['rfq_straight_line'],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(1);
    expect(result.strippedInstruments).toEqual(['rfq']);
    expect(result.correctedModifier).toBeCloseTo(total - 0.15, 3);
  });

  it('level 1 aaq2_straight_line strips AAQ-II positive modifier contribution', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['aaq2_straight_line'],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(1);
    expect(result.strippedInstruments).toEqual(['aaq2']);
    expect(result.correctedModifier).toBeCloseTo(total - 0.1, 3);
  });

  it('level 2 straight-line strips all positives', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['rfq_straight_line', 'gasp_straight_line'],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(2);
    expect(result.allPositivesStripped).toBe(true);
    expect(result.correctedModifier).toBe(-0.4);
    expect(result.additionalPenalty).toBe(0);
  });

  it('level 3 straight-line strips all positives and applies -0.3 penalty', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['rfq_straight_line', 'gasp_straight_line', 'brs_straight_line'],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(3);
    expect(result.correctedModifier).toBe(-0.7);
    expect(result.additionalPenalty).toBe(-0.3);
  });

  it('level 1 consistency divergence strips RFQ only', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: [],
      uncertaintyScore: 0.3,
      pillarScores: { mentalizing: 4.0, accountability: null, contempt: null, regulation: null },
      psychometricScores: { ...ZERO_PSYCH, rfq: 5.5 },
    });
    expect(result.correctionLevel).toBe(1);
    expect(result.strippedInstruments).toEqual(['rfq']);
    expect(result.correctedModifier).toBeCloseTo(total - 0.15, 3);
  });

  it('level 2 consistency divergence strips all positives', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: [],
      uncertaintyScore: 0.3,
      pillarScores: { mentalizing: 4.0, accountability: 4.0, contempt: null, regulation: 4.0 },
      psychometricScores: {
        ...ZERO_PSYCH,
        rfq: 5.5,
        brs: 4.5,
      },
    });
    expect(result.correctionLevel).toBe(2);
    expect(result.correctedModifier).toBe(-0.4);
  });

  it('level 3 consistency divergence strips all positives plus penalty', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: [],
      uncertaintyScore: 0.3,
      pillarScores: { mentalizing: 4.0, accountability: 4.0, contempt: 4.0, regulation: 4.0 },
      psychometricScores: {
        ...ZERO_PSYCH,
        rfq: 5.5,
        brs: 4.5,
        scs_sf: 4.5,
      },
    });
    expect(result.correctionLevel).toBe(3);
    expect(result.correctedModifier).toBe(-0.7);
  });

  it('level 2 uncertainty strips all positives', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: [],
      uncertaintyScore: 0.72,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(2);
    expect(result.correctedModifier).toBe(-0.4);
  });

  it('level 3 uncertainty strips all positives plus penalty', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: [],
      uncertaintyScore: 0.85,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(3);
    expect(result.correctedModifier).toBe(-0.7);
  });

  it('applies -0.3 penalty only once when multiple level 3 triggers fire', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['rfq_straight_line', 'gasp_straight_line', 'brs_straight_line'],
      uncertaintyScore: 0.85,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctionLevel).toBe(3);
    expect(result.additionalPenalty).toBe(-0.3);
    expect(result.correctedModifier).toBe(-0.7);
  });

  it('preserves negative contributions when all positives stripped', () => {
    const components = { ...POSITIVE_COMPONENTS };
    const total = totalModifier(components);
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['rfq_straight_line', 'gasp_straight_line'],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    expect(result.correctedModifier).toBe(-0.4);
  });

  it('gate pass impact: level 2 correction removes positive boost', () => {
    const components: InstrumentModifierComponents = {
      gasp: 0.1,
      brs: 0.1,
      anxiety_trait: 0,
      aaq2: 0.1,
      rfq: 0.15,
  sd3_narcissism: 0,
  npi_entitlement: 0,
  dweck: 0,
      rses: 0,
      scs_sf: 0,
    };
    const total = 0.5;
    const result = computeGamingCorrection({
      instrumentComponents: components,
      totalModifier: total,
      straightLineFlags: ['rfq_straight_line', 'gasp_straight_line'],
      uncertaintyScore: 0.3,
      pillarScores: ZERO_PILLARS,
      psychometricScores: ZERO_PSYCH,
    });
    const depthModified = 5.8;
    const withRaw = depthModified + total;
    const withCorrected = depthModified + result.correctedModifier;
    expect(withRaw).toBe(6.3);
    expect(withCorrected).toBe(5.8);
    expect(withCorrected).toBeLessThan(6.0);
  });
});
