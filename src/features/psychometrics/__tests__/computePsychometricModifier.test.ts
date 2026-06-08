import { describe, expect, it } from '@jest/globals';
import { computePsychometricModifier } from '../computePsychometricModifier';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import { SD3_NARCISSISM_FLOOR_FAIL_CODE } from '../sd3NarcissismFloor';
import {
  DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
  GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
  RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
  SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD,
} from '../psychometricFloorBreaches';
import { scoreAssessment } from '../assessmentContent';

const FULL_SCORES = {
  brsScore: null as number | null,
  anxietyTraitScore: null as number | null,
  scsSfScore: null as number | null,
  gaspScore: null as number | null,
  dweckScore: null as number | null,
  aaq2Score: null as number | null,
  rsesScore: null as number | null,
  scsPublicScore: null as number | null,
  scsPrivateScore: null as number | null,
  mspssFriendsScore: null as number | null,
  mspssFamilyScore: null as number | null,
  sd3NarcissismScore: null as number | null,
  rfqScore: null as number | null,
};

describe('computePsychometricModifier', () => {
  it('applies anxiety_trait modifier bands and straight-line detection', () => {
    const poor = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 4.2 });
    expect(poor.anxietyTraitComponent).toBe(-0.25);
    expect(poor.breakdown.anxietyTraitBand).toBe('poor — high anxiety');

    const average = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 3.0 });
    expect(average.anxietyTraitComponent).toBe(-0.1);
    expect(average.breakdown.anxietyTraitBand).toBe('average anxiety');

    const strong = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 2.0 });
    expect(strong.anxietyTraitComponent).toBe(0);
    expect(strong.breakdown.anxietyTraitBand).toBe('strong — low chronic anxiety');

    const straightLine = computePsychometricModifier(
      { ...FULL_SCORES, anxietyTraitScore: 3 },
      undefined,
      { anxiety_trait: { 1: 4, 2: 4, 3: 4, 4: 4 } },
    );
    expect(straightLine.straightLineFlags).toContain('anxiety_trait_straight_line');
  });

  it('returns zero modifier for strong scores on all instruments (no positive boost)', () => {
    const result = computePsychometricModifier(
      {
        ...FULL_SCORES,
        brsScore: 4.5,
        anxietyTraitScore: 1.5,
        scsSfScore: 4.2,
        gaspScore: 2,
        dweckScore: 5,
        aaq2Score: 14,
        rsesScore: 35,
        scsPublicScore: 8,
        scsPrivateScore: 13,
        mspssFriendsScore: 6,
        sd3NarcissismScore: 1.5,
        rfqScore: 5.5,
      },
      {
        disclosureCalibration: 'calibrated',
        moment5Concreteness: 'high',
        personalMomentVocabDensity: 1.2,
        regulationPillar: 8,
      },
    );
    expect(result.modifier).toBe(0);
    expect(result.brsComponent).toBe(0);
    expect(result.anxietyTraitComponent).toBe(0);
    expect(result.scsSfComponent).toBe(0);
    expect(result.gaspComponent).toBe(0);
    expect(result.dweckComponent).toBe(0);
    expect(result.aaq2Component).toBe(0);
    expect(result.rsesComponent).toBe(0);
    expect(result.scsComponent).toBe(0);
    expect(result.mspssComponent).toBe(0);
    expect(result.sd3NarcissismComponent).toBe(0);
    expect(result.rfqComponent).toBe(0);
    expect(result.modifier).toBeLessThanOrEqual(0);
    expect(result.psychometricFloorBreaches).toHaveLength(0);
  });

  it('flags low self-esteem floor at RSES <= 24', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      aaq2Score: 20,
      rsesScore: 22,
      scsPublicScore: 10,
      scsPrivateScore: 10,
    });
    expect(result.psychometricFloorBreaches).toContain('rses_low_self_esteem_floor');
  });

  it('flags SD3 narcissism floor at mean >= 4.0 without straight-line', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      sd3NarcissismScore: 4.2,
    });
    expect(result.psychometricFloorBreaches).toEqual([SD3_NARCISSISM_FLOOR_FAIL_CODE]);
    expect(result.straightLineFlags).not.toContain('sd3_narcissism_straight_line');
  });

  it('flags SD3 narcissism floor when straight-line is active but score breaches threshold', () => {
    const straightLineResponses = Object.fromEntries(
      Array.from({ length: 9 }, (_, i) => [i + 1, 5]),
    );
    const result = computePsychometricModifier(
      { ...FULL_SCORES, sd3NarcissismScore: 4.2 },
      undefined,
      { sd3_narcissism: straightLineResponses },
    );
    expect(result.straightLineFlags).toContain('sd3_narcissism_straight_line');
    expect(result.psychometricFloorBreaches).toContain(SD3_NARCISSISM_FLOOR_FAIL_CODE);
  });

  it('does not flag SD3 narcissism floor below threshold', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      sd3NarcissismScore: 3.8,
    });
    expect(result.psychometricFloorBreaches).not.toContain(SD3_NARCISSISM_FLOOR_FAIL_CODE);
  });

  it('forces final gate fail when SD3 narcissism floor breaches even with high weighted score', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      sd3NarcissismScore: 4.2,
    });
    const depthSignalModifiedScore = 9.0;
    const finalModifiedScore = depthSignalModifiedScore + result.modifier;
    const allFailReasons = [...result.psychometricFloorBreaches];
    const interviewGatePass =
      allFailReasons.length === 0 && depthSignalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
    const finalPass = interviewGatePass && finalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
    expect(allFailReasons).toEqual([SD3_NARCISSISM_FLOOR_FAIL_CODE]);
    expect(finalPass).toBe(false);
  });

  it('flags RFQ low reflective functioning floor below 2.0 without straight-line', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, rfqScore: 1.8 });
    expect(result.psychometricFloorBreaches).toContain(RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE);
    expect(result.rfqComponent).toBe(0);
    expect(result.breakdown.rfqBand).toBe('floor breach');
  });

  it('flags RFQ floor when straight-line is active but score breaches threshold', () => {
    const straightLineResponses = Object.fromEntries(
      Array.from({ length: 8 }, (_, i) => [i + 1, 1]),
    );
    const result = computePsychometricModifier(
      { ...FULL_SCORES, rfqScore: 1.8 },
      undefined,
      { rfq: straightLineResponses },
    );
    expect(result.straightLineFlags).toContain('rfq_straight_line');
    expect(result.psychometricFloorBreaches).toContain(RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE);
  });

  it('flags GASP extreme externalization floor at >= 4.6 without straight-line', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, gaspScore: 4.75 });
    expect(result.psychometricFloorBreaches).toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
    expect(result.gaspComponent).toBe(0);
    expect(result.breakdown.gaspBand).toBe('floor breach');
  });

  it('does not flag GASP floor below 4.6 at poor externalization', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, gaspScore: 3.0 });
    expect(result.psychometricFloorBreaches).not.toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
  });

  it('flags GASP floor when straight-line is active but score breaches threshold', () => {
    const result = computePsychometricModifier(
      { ...FULL_SCORES, gaspScore: 4.75 },
      undefined,
      { gasp: { 1: 7, 2: 7, 3: 7, 4: 7, 5: 7, 6: 7, 7: 7, 8: 7, 9: 7, 10: 7, 11: 7, 12: 7 } },
    );
    expect(result.straightLineFlags).toContain('gasp_straight_line');
    expect(result.psychometricFloorBreaches).toContain(GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE);
  });

  it('flags Dweck extreme fixed mindset floor below 2.4 without straight-line', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, dweckScore: 2.3 });
    expect(result.psychometricFloorBreaches).toContain(DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE);
    expect(result.dweckComponent).toBe(0);
    expect(result.breakdown.dweckBand).toBe('floor breach');
  });

  it('does not flag Dweck floor at moderate growth-oriented scores', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, dweckScore: 3.5 });
    expect(result.psychometricFloorBreaches).not.toContain(DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE);
  });

  it('flags Dweck floor when straight-line is active but score breaches threshold', () => {
    const straightLineResponses = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [i + 1, 1]),
    );
    const result = computePsychometricModifier(
      { ...FULL_SCORES, dweckScore: 2.3 },
      undefined,
      { dweck: straightLineResponses },
    );
    expect(result.straightLineFlags).toContain('dweck_straight_line');
    expect(result.psychometricFloorBreaches).toContain(DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE);
  });

  it('flags SCS-SF low self-compassion floor below 2.5 on reverse-scored mean', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, scsSfScore: 2.417 });
    expect(result.psychometricFloorBreaches).toContain(SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE);
    expect(result.scsSfComponent).toBe(0);
    expect(result.breakdown.scsSfBand).toBe('floor breach');
  });

  it('does not flag SCS-SF floor at moderate self-compassion scores', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, scsSfScore: 3.5 });
    expect(result.psychometricFloorBreaches).not.toContain(SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE);
  });

  it('SCS-SF floor uses reverse-scored stored mean not raw item responses', () => {
    const reverseIds = [1, 4, 9, 11, 12];
    const rawResponses = Object.fromEntries(
      Array.from({ length: 12 }, (_, i) => {
        const id = i + 1;
        return [id, reverseIds.includes(id) ? 5 : 1];
      }),
    );
    const scoredMean = scoreAssessment('scs_sf', rawResponses).total;
    expect(scoredMean).toBeLessThan(SCS_SF_LOW_SELF_COMPASSION_FLOOR_THRESHOLD);
    const result = computePsychometricModifier(
      { ...FULL_SCORES, scsSfScore: scoredMean },
      undefined,
      { scs_sf: rawResponses },
    );
    expect(result.psychometricFloorBreaches).toContain(SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE);
  });

  it('flags SCS-SF floor when straight-line is active but score breaches threshold', () => {
    const result = computePsychometricModifier(
      { ...FULL_SCORES, scsSfScore: 2.417 },
      undefined,
      { scs_sf: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 1])) },
    );
    expect(result.straightLineFlags).toContain('scs_sf_straight_line');
    expect(result.psychometricFloorBreaches).toContain(SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE);
  });

  it('flags multiple psychometric floors simultaneously', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      gaspScore: 4.75,
      dweckScore: 2.3,
    });
    expect(result.psychometricFloorBreaches).toEqual(
      expect.arrayContaining([
        GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
        DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
      ]),
    );
    const allFailReasons = [...result.psychometricFloorBreaches];
    const finalPass =
      allFailReasons.length === 0 && 9.0 >= GATE_PASS_WEIGHTED_MIN && 9.0 >= GATE_PASS_WEIGHTED_MIN;
    expect(finalPass).toBe(false);
  });

  it('flags GASP consistency when externalization is high but accountability pillar is strong', () => {
    const result = computePsychometricModifier(
      { ...FULL_SCORES, gaspScore: 5.5 },
      { accountabilityPillar: 8 },
    );
    expect(result.consistencyFlags).toContain('gasp_consistency_review');
  });

  it('applies MSPSS modifier from friends subscale bands', () => {
    const strong = computePsychometricModifier({ ...FULL_SCORES, mspssFriendsScore: 6, mspssFamilyScore: 4 });
    expect(strong.mspssComponent).toBe(0);
    expect(strong.breakdown.mspssBand).toBe('strong social network');

    const adequate = computePsychometricModifier({ ...FULL_SCORES, mspssFriendsScore: 4.5, mspssFamilyScore: 4 });
    expect(adequate.mspssComponent).toBe(0);

    const limited = computePsychometricModifier({ ...FULL_SCORES, mspssFriendsScore: 3, mspssFamilyScore: 6 });
    expect(limited.mspssComponent).toBe(-0.1);

    const isolated = computePsychometricModifier({ ...FULL_SCORES, mspssFriendsScore: 2, mspssFamilyScore: 6 });
    expect(isolated.mspssComponent).toBe(-0.2);
  });

  it('does not flag MSPSS straight-line for mid-range identical responses', () => {
    const midRange = computePsychometricModifier(
      { ...FULL_SCORES, mspssFriendsScore: 4 },
      undefined,
      { mspss: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, 4])) },
    );
    expect(midRange.straightLineFlags).not.toContain('mspss_straight_line');
  });

  it('flags MSPSS straight-line only for extreme identical responses', () => {
    const extreme = computePsychometricModifier(
      { ...FULL_SCORES, mspssFriendsScore: 7 },
      undefined,
      { mspss: Object.fromEntries(Array.from({ length: 8 }, (_, i) => [i + 1, 7])) },
    );
    expect(extreme.straightLineFlags).toContain('mspss_straight_line');
  });

  it('does not add MSPSS component to modifier when friends subscale is strong', () => {
    const without = computePsychometricModifier({ ...FULL_SCORES, brsScore: 4.5 });
    const withMspss = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 4.5,
      mspssFriendsScore: 6,
    });
    expect(withMspss.modifier).toBe(without.modifier);
  });

  it('applies average three-tier bands across all instruments (~-1.0 total)', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 3.0,
      anxietyTraitScore: 3.0,
      scsSfScore: 3.5,
      gaspScore: 3.0,
      dweckScore: 4.0,
      aaq2Score: 23,
      rsesScore: 30,
      scsPublicScore: 10,
      scsPrivateScore: 10,
      mspssFriendsScore: 4.5,
      sd3NarcissismScore: 2.5,
      rfqScore: 4.0,
    });
    expect(result.modifier).toBe(-1);
    expect(result.brsComponent).toBe(-0.1);
    expect(result.anxietyTraitComponent).toBe(-0.1);
    expect(result.scsSfComponent).toBe(-0.1);
    expect(result.gaspComponent).toBe(-0.1);
    expect(result.dweckComponent).toBe(-0.1);
    expect(result.aaq2Component).toBe(-0.1);
    expect(result.rsesComponent).toBe(-0.1);
    expect(result.scsComponent).toBe(-0.1);
    expect(result.mspssComponent).toBe(0);
    expect(result.sd3NarcissismComponent).toBe(-0.1);
    expect(result.rfqComponent).toBe(-0.1);
  });

  it('applies poor three-tier bands just above floors (~-2.70 total with MSPSS)', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 1.9,
      anxietyTraitScore: 4.89,
      scsSfScore: 2.5,
      gaspScore: 4.59,
      dweckScore: 2.4,
      aaq2Score: 32,
      rsesScore: 25,
      scsPublicScore: 12,
      scsPrivateScore: 9,
      mspssFriendsScore: 2,
      sd3NarcissismScore: 3.99,
      rfqScore: 2.0,
    });
    expect(result.modifier).toBe(-2.7);
    expect(result.psychometricFloorBreaches).toHaveLength(0);
  });

  it('worst-case modifier across all instruments uses poor bands plus MSPSS isolation', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 1.9,
      anxietyTraitScore: 4.89,
      scsSfScore: 2.5,
      gaspScore: 4.59,
      dweckScore: 2.4,
      aaq2Score: 32,
      rsesScore: 25,
      scsPublicScore: 12,
      scsPrivateScore: 9,
      mspssFriendsScore: 2,
      sd3NarcissismScore: 3.99,
      rfqScore: 2.0,
    });
    expect(result.modifier).toBe(-2.7);
  });

  it('fires floor breaches independently of modifier bands', () => {
    const floorBreach = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 1.5,
      anxietyTraitScore: 4.95,
      scsSfScore: 2.0,
      gaspScore: 4.8,
      dweckScore: 2.0,
      aaq2Score: 40,
      rsesScore: 20,
      scsPublicScore: 18,
      scsPrivateScore: 8,
      sd3NarcissismScore: 4.2,
      rfqScore: 1.5,
    });
    expect(floorBreach.psychometricFloorBreaches).toEqual(
      expect.arrayContaining([
        'brs_low_resilience_floor',
        'anxiety_trait_high_floor',
        SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE,
        GASP_EXTREME_EXTERNALIZATION_FLOOR_CODE,
        DWECK_EXTREME_FIXED_MINDSET_FLOOR_CODE,
        'aaq2_high_experiential_avoidance_floor',
        'rses_low_self_esteem_floor',
        'scs_low_private_self_awareness_floor',
        SD3_NARCISSISM_FLOOR_FAIL_CODE,
        RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
      ]),
    );
    expect(floorBreach.brsComponent).toBe(0);
    expect(floorBreach.anxietyTraitComponent).toBe(0);
    expect(floorBreach.scsSfComponent).toBe(0);
    expect(floorBreach.gaspComponent).toBe(0);
    expect(floorBreach.dweckComponent).toBe(0);
    expect(floorBreach.aaq2Component).toBe(0);
    expect(floorBreach.rsesComponent).toBe(0);
    expect(floorBreach.sd3NarcissismComponent).toBe(0);
    expect(floorBreach.rfqComponent).toBe(0);
    expect(floorBreach.scsComponent).toBe(-0.25);
    expect(floorBreach.modifier).toBe(-0.25);
  });
});
