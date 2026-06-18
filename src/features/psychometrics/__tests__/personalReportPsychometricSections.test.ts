import { describe, expect, it } from 'vitest';
import { shouldNarrateInstrument } from '../../reports/narrativeCalibration';
import type { GamingCorrectionResult } from '../computeGamingCorrection';
import {
  buildBrsPersonalReportInstruction,
  buildPersonalPsychometricSectionInstructions,
  buildScsSfPersonalReportInstruction,
} from '../personalReportPsychometricSections';

const emptyPsychometrics = {
  brsScore: null,
  scsSfScore: null,
  scsSfSelfKindnessScore: null,
  scsSfCommonHumanityScore: null,
  scsSfMindfulnessScore: null,
  mspssScore: null,
  mspssFamilyScore: null,
  mspssFriendsScore: null,
  rfqScore: null,
};

describe('shouldNarrateInstrument', () => {
  it('returns false when score is null', () => {
    expect(shouldNarrateInstrument(null, 'brs', null, [])).toBe(false);
  });

  it('returns false when instrument is stripped in gaming correction', () => {
    const gaming: GamingCorrectionResult = {
      correctedModifier: 0,
      originalModifier: 0,
      correctionApplied: 0,
      additionalPenalty: 0,
      strippedInstruments: ['brs'],
      allPositivesStripped: false,
      correctionLevel: 1,
      activeTriggers: [],
      explanation: 'test',
    };
    expect(shouldNarrateInstrument(3.2, 'brs', gaming, [])).toBe(false);
  });

  it('returns false when straight-line flag matches instrument', () => {
    expect(shouldNarrateInstrument(3.2, 'brs', null, ['brs_straight_line'])).toBe(false);
  });

  it('does not suppress BRS when only rses_straight_line is flagged', () => {
    expect(shouldNarrateInstrument(3.2, 'brs', null, ['rses_straight_line'])).toBe(true);
  });

  it('returns true for valid score without flags', () => {
    expect(shouldNarrateInstrument(3.2, 'brs', null, [])).toBe(true);
  });
});

describe('personalReportPsychometricSections', () => {
  it('omits BRS instruction when score is null', () => {
    expect(
      buildBrsPersonalReportInstruction(emptyPsychometrics, null, []),
    ).toBeNull();
  });

  it('includes BRS instruction when score is present', () => {
    const block = buildBrsPersonalReportInstruction(
      { ...emptyPsychometrics, brsScore: 3.8 },
      null,
      [],
    );
    expect(block).toMatch(/How You Recover From Hard Periods/i);
    expect(block).toMatch(/omit instrument name in report/i);
  });

  it('integrates SCS-SF subscale pattern guidance', () => {
    const block = buildScsSfPersonalReportInstruction(
      {
        ...emptyPsychometrics,
        scsSfScore: 3.2,
        scsSfSelfKindnessScore: 4.1,
        scsSfCommonHumanityScore: 2.4,
        scsSfMindfulnessScore: 3.0,
      },
      null,
      [],
    );
    expect(block).toMatch(/integrate this with the existing experiential-avoidance/i);
    expect(block).toMatch(/Warmth toward self/i);
  });

  it('buildPersonalPsychometricSectionInstructions returns empty when no narratable data', () => {
    expect(
      buildPersonalPsychometricSectionInstructions({
        psychometrics: emptyPsychometrics,
        gamingCorrection: null,
        psychometricStraightLineFlags: [],
      }),
    ).toBe('');
  });
});
