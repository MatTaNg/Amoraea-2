import { describe, expect, it } from '@jest/globals';
import {
  computeGaspExternalizationModifier,
  computePsychometricModifier,
} from '../computePsychometricModifier';
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
import { NPI_ENTITLEMENT_ENABLED } from '../interviewCompletionStatus';
import {
  ACTIVE_NARCISSISM_FLOOR_CODE,
  NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED,
  narcissismFloorBreachScores,
  narcissismModifierPoorBandScores,
  narcissismModifierAverageBandScores,
} from '../narcissismInstrumentTestFixtures';
import { REFERENCE_PSYCHOMETRIC_CALIBRATION } from '@config/psychometrics/referencePsychometricCalibration';

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
  npiEntitlementScore: null as number | null,
  rfqScore: null as number | null,
};

describe('computePsychometricModifier', () => {
  it('applies anxiety_trait modifier bands and straight-line detection', () => {
    const poor = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 4.2 });
    expect(poor.anxietyTraitComponent).toBe(-0.25);
    expect(poor.breakdown.anxietyTraitBand).toBe('poor — high anxiety');

    const average = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 3.4 });
    expect(average.anxietyTraitComponent).toBe(-0.1);
    expect(average.breakdown.anxietyTraitBand).toBe('average anxiety');

    const poorMid = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 3.6 });
    expect(poorMid.anxietyTraitComponent).toBe(-0.25);
    expect(poorMid.breakdown.anxietyTraitBand).toBe('poor — high anxiety');

    const strong = computePsychometricModifier({ ...FULL_SCORES, anxietyTraitScore: 2.9 });
    expect(strong.anxietyTraitComponent).toBe(0);
    expect(strong.breakdown.anxietyTraitBand).toBe('strong — low chronic anxiety');

    const atReference = computePsychometricModifier({
      ...FULL_SCORES,
      anxietyTraitScore: REFERENCE_PSYCHOMETRIC_CALIBRATION.anxietyTrait,
    });
    expect(atReference.anxietyTraitComponent).toBe(-0.1);
    expect(atReference.breakdown.anxietyTraitBand).toBe('average anxiety');

    const straightLine = computePsychometricModifier(
      { ...FULL_SCORES, anxietyTraitScore: 3 },
      undefined,
      { anxiety_trait: { 1: 4, 2: 4, 3: 4, 4: 4 } },
    );
    expect(straightLine.straightLineFlags).toContain('anxiety_trait_straight_line');
  });

  it('applies AAQ-II average band through score 32 and floor at 33 without a poor tier', () => {
    const average = computePsychometricModifier({ ...FULL_SCORES, aaq2Score: 32 });
    expect(average.aaq2Component).toBe(-0.1);
    expect(average.breakdown.aaq2Band).toBe('average flexibility');
    expect(average.psychometricFloorBreaches).not.toContain('aaq2_high_experiential_avoidance_floor');

    const floor = computePsychometricModifier({ ...FULL_SCORES, aaq2Score: 33 });
    expect(floor.aaq2Component).toBe(0);
    expect(floor.breakdown.aaq2Band).toBe('floor breach');
    expect(floor.psychometricFloorBreaches).toContain('aaq2_high_experiential_avoidance_floor');
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
        ...narcissismFloorBreachScores(false),
        npiEntitlementScore: NPI_ENTITLEMENT_ENABLED ? 1 : null,
        sd3NarcissismScore: NPI_ENTITLEMENT_ENABLED ? null : 1.5,
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
    expect(result.sd3NarcissismComponent).toBe(0);
    expect(result.rfqComponent).toBe(0);
    expect(result.modifier).toBeLessThanOrEqual(0);
    expect(result.psychometricFloorBreaches).toHaveLength(0);
  });

  it('recalibrated RSES modifier bands apply expected penalties', () => {
    expect(computePsychometricModifier({ ...FULL_SCORES, rsesScore: 26 }).rsesComponent).toBe(0);
    expect(computePsychometricModifier({ ...FULL_SCORES, rsesScore: 28 }).rsesComponent).toBe(0);
    expect(computePsychometricModifier({ ...FULL_SCORES, rsesScore: 30 }).rsesComponent).toBe(0);
    expect(computePsychometricModifier({ ...FULL_SCORES, rsesScore: 19 }).rsesComponent).toBe(-0.15);
    expect(computePsychometricModifier({ ...FULL_SCORES, rsesScore: 18 }).rsesComponent).toBe(-0.25);

    const atFloor = computePsychometricModifier({ ...FULL_SCORES, rsesScore: 20 });
    expect(atFloor.rsesComponent).toBe(-0.15);
    expect(atFloor.psychometricFloorBreaches).toContain('rses_low_self_esteem_floor');
  });

  it('flags low self-esteem floor at RSES <= 20', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      aaq2Score: 20,
      rsesScore: 19,
    });
    expect(result.psychometricFloorBreaches).toContain('rses_low_self_esteem_floor');
  });

  it('flags active narcissism floor at threshold without straight-line', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      ...narcissismFloorBreachScores(true),
    });
    if (NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED) {
      expect(result.psychometricFloorBreaches).toEqual([ACTIVE_NARCISSISM_FLOOR_CODE]);
      expect(result.straightLineFlags).not.toContain('sd3_narcissism_straight_line');
    } else {
      expect(result.psychometricFloorBreaches).toHaveLength(0);
      expect(result.npiEntitlementComponent).toBe(0);
    }
  });

  it('flags narcissism floor when straight-line is active but score breaches threshold', () => {
    if (NPI_ENTITLEMENT_ENABLED) {
      const result = computePsychometricModifier({
        ...FULL_SCORES,
        npiEntitlementScore: 5,
      });
      expect(result.psychometricFloorBreaches).not.toContain(ACTIVE_NARCISSISM_FLOOR_CODE);
      expect(result.npiEntitlementComponent).toBe(0);
      return;
    }
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

  it('does not flag narcissism floor below threshold', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      ...narcissismFloorBreachScores(false),
    });
    expect(result.psychometricFloorBreaches).not.toContain(ACTIVE_NARCISSISM_FLOOR_CODE);
  });

  it('forces final gate fail when narcissism floor breaches even with high weighted score', () => {
    if (!NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED) return;

    const result = computePsychometricModifier({
      ...FULL_SCORES,
      ...narcissismFloorBreachScores(true),
    });
    const depthSignalModifiedScore = 9.0;
    const finalModifiedScore = depthSignalModifiedScore + result.modifier;
    const allFailReasons = [...result.psychometricFloorBreaches];
    const interviewGatePass =
      allFailReasons.length === 0 && depthSignalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
    const finalPass = interviewGatePass && finalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
    expect(allFailReasons).toEqual([ACTIVE_NARCISSISM_FLOOR_CODE]);
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
      { gasp: Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8].map((id) => [id, 7])) },
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
    expect(result.scsSfComponent).toBe(-0.1);
    expect(result.breakdown.scsSfBand).toBe('low self-compassion');
  });

  it('recalibrated SCS-SF modifier bands apply expected penalties', () => {
    expect(computePsychometricModifier({ ...FULL_SCORES, scsSfScore: 3.875 }).scsSfComponent).toBe(0);
    expect(computePsychometricModifier({ ...FULL_SCORES, scsSfScore: 3.0 }).scsSfComponent).toBe(-0.05);
    expect(computePsychometricModifier({ ...FULL_SCORES, scsSfScore: 2.3 }).scsSfComponent).toBe(-0.1);
  });

  it('does not flag SCS-SF floor at moderate self-compassion scores', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, scsSfScore: 3.5 });
    expect(result.psychometricFloorBreaches).not.toContain(SCS_SF_LOW_SELF_COMPASSION_FLOOR_CODE);
  });

  it('SCS-SF floor uses reverse-scored stored mean not raw item responses', () => {
    const reverseIds = [1, 9, 11];
    const itemIds = [1, 2, 3, 5, 6, 7, 9, 11];
    const rawResponses = Object.fromEntries(
      itemIds.map((id) => [id, reverseIds.includes(id) ? 5 : 1]),
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
      { scs_sf: Object.fromEntries([1, 2, 3, 5, 6, 7, 9, 11].map((id) => [id, 1])) },
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

  it('does not flag GASP straight-line when fewer than 4 externalization items answered', () => {
    const partial = computePsychometricModifier(
      { ...FULL_SCORES, gaspScore: 3 },
      undefined,
      { gasp: { 1: 4, 2: 4, 3: 4 } },
    );
    expect(partial.straightLineFlags).not.toContain('gasp_straight_line');
  });

  it('applies average three-tier bands across 9 active instruments (~-0.9 total)', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 2.6,
      anxietyTraitScore: 3.4,
      scsSfScore: 3.0,
      gaspScore: 4.2,
      dweckScore: 3.05,
      aaq2Score: 32,
      rsesScore: 20,
      ...narcissismModifierAverageBandScores(),
      rfqScore: 3.1,
    });
    expect(result.modifier).toBe(NPI_ENTITLEMENT_ENABLED ? -0.8 : -0.9);
    expect(result.brsComponent).toBe(-0.1);
    expect(result.anxietyTraitComponent).toBe(-0.1);
    expect(result.scsSfComponent).toBe(-0.05);
    expect(result.gaspComponent).toBe(-0.1);
    expect(result.dweckComponent).toBe(-0.1);
    expect(result.aaq2Component).toBe(-0.1);
    expect(result.rsesComponent).toBe(-0.15);
    if (NPI_ENTITLEMENT_ENABLED) {
      expect(result.npiEntitlementComponent).toBe(0);
    } else {
      expect(result.sd3NarcissismComponent).toBe(-0.1);
    }
    expect(result.rfqComponent).toBe(-0.1);
  });

  it('applies poor three-tier bands just above floors (~-1.75 worst-case across 9 instruments)', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 1.9,
      anxietyTraitScore: 4.89,
      scsSfScore: 2.5,
      gaspScore: 4.59,
      dweckScore: 2.4,
      aaq2Score: 32,
      rsesScore: 25,
      ...narcissismModifierPoorBandScores(),
      rfqScore: 2.0,
    });
    expect(result.modifier).toBe(NPI_ENTITLEMENT_ENABLED ? -1.4 : -1.5);
    expect(result.psychometricFloorBreaches).toHaveLength(0);
  });

  it('reference calibration profile gets modifier reductions without auto-fail floors', () => {
    const ref = REFERENCE_PSYCHOMETRIC_CALIBRATION;
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: ref.brs,
      anxietyTraitScore: ref.anxietyTrait,
      scsSfScore: ref.scsSf,
      gaspScore: ref.gaspExternalization,
      dweckScore: ref.dweck,
      aaq2Score: ref.aaq2,
      rsesScore: ref.rses,
      rfqScore: ref.rfq,
    });

    expect(result.modifier).toBeLessThan(0);
    expect(result.psychometricFloorBreaches).toHaveLength(0);
    expect(result.brsComponent).toBe(-0.1);
    expect(result.anxietyTraitComponent).toBe(-0.1);
    expect(result.scsSfComponent).toBe(-0.05);
    expect(result.gaspComponent).toBe(-0.1);
    expect(result.dweckComponent).toBe(-0.1);
    expect(result.aaq2Component).toBe(-0.1);
    expect(result.rsesComponent).toBe(-0.1);
    expect(result.rfqComponent).toBe(-0.1);
  });

  it('scores strictly better than reference calibration avoid modifier penalties', () => {
    const ref = REFERENCE_PSYCHOMETRIC_CALIBRATION;
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: ref.brs + 0.1,
      anxietyTraitScore: ref.anxietyTrait - 0.1,
      scsSfScore: ref.scsSf + 0.1,
      gaspScore: ref.gaspExternalization - 0.5,
      dweckScore: ref.dweck + 0.2,
      aaq2Score: ref.aaq2 - 1,
      rsesScore: ref.rses + 1,
      rfqScore: ref.rfq + 0.1,
    });

    expect(result.modifier).toBe(0);
    expect(result.psychometricFloorBreaches).toHaveLength(0);
  });

  it('worst-case modifier across 9 active instruments uses poor bands (-1.75)', () => {
    const result = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 1.9,
      anxietyTraitScore: 4.89,
      scsSfScore: 2.5,
      gaspScore: 4.59,
      dweckScore: 2.4,
      aaq2Score: 32,
      rsesScore: 25,
      ...narcissismModifierPoorBandScores(),
      rfqScore: 2.0,
    });
    expect(result.modifier).toBe(NPI_ENTITLEMENT_ENABLED ? -1.4 : -1.5);
  });

  it('fires floor breaches independently of modifier bands', () => {
    const floorBreach = computePsychometricModifier({
      ...FULL_SCORES,
      brsScore: 1.5,
      anxietyTraitScore: 4.95,
      scsSfScore: 1.9,
      gaspScore: 4.8,
      dweckScore: 2.0,
      aaq2Score: 40,
      rsesScore: 20,
      ...narcissismFloorBreachScores(true),
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
        RFQ_LOW_REFLECTIVE_FUNCTIONING_FLOOR_CODE,
        ...(NARCISSISM_PSYCHOMETRIC_GATE_FLOOR_ENABLED ? [ACTIVE_NARCISSISM_FLOOR_CODE] : []),
      ]),
    );
    expect(floorBreach.brsComponent).toBe(0);
    expect(floorBreach.anxietyTraitComponent).toBe(0);
    expect(floorBreach.scsSfComponent).toBe(0);
    expect(floorBreach.gaspComponent).toBe(0);
    expect(floorBreach.dweckComponent).toBe(0);
    expect(floorBreach.aaq2Component).toBe(0);
    expect(floorBreach.rsesComponent).toBe(-0.15);
    expect(floorBreach.sd3NarcissismComponent).toBe(0);
    expect(floorBreach.rfqComponent).toBe(0);
    expect(floorBreach.modifier).toBe(-0.15);
  });
});

describe('GASP externalization modifier — 4-item recalibration', () => {
  it('mean of 3.0 produces 0 modifier under recalibrated bands', () => {
    expect(computeGaspExternalizationModifier(3.0).modifier).toBe(0);
  });

  it('mean of 2.5 produces 0 modifier (was already strong band)', () => {
    expect(computeGaspExternalizationModifier(2.5).modifier).toBe(0);
  });

  it('mean of 4.1 produces -0.10 modifier (average band)', () => {
    expect(computeGaspExternalizationModifier(4.1).modifier).toBe(-0.1);
  });

  it('mean of 4.0 produces -0.10 modifier (reference externalization level)', () => {
    expect(computeGaspExternalizationModifier(4.0).modifier).toBe(-0.1);
  });

  it('mean of 4.25 produces -0.25 modifier (poor band)', () => {
    expect(computeGaspExternalizationModifier(4.25).modifier).toBe(-0.25);
  });

  it('mean of 4.5 produces -0.25 modifier (poor band)', () => {
    expect(computeGaspExternalizationModifier(4.5).modifier).toBe(-0.25);
  });

  it('mean of 4.6 triggers floor breach', () => {
    expect(computeGaspExternalizationModifier(4.6)).toMatchObject({ floorBreach: true });
  });

  it('pattern override: interpersonal items ≤ 3 and situational items ≤ 4 with mean ≤ 3.5 produces 0 modifier', () => {
    const result = computeGaspExternalizationModifier(3.0, { 1: 2, 2: 4, 3: 2, 4: 4 });
    expect(result.modifier).toBe(0);
  });

  it('pattern override applies at mean 3.5 when situational items stay ≤ 4', () => {
    const result = computeGaspExternalizationModifier(3.5, { 1: 3, 2: 4, 3: 3, 4: 4 });
    expect(result.modifier).toBe(0);
  });

  it('pattern override does not apply when mean exceeds 3.5 and lands in average band', () => {
    const result = computeGaspExternalizationModifier(4.2, { 1: 2, 2: 5, 3: 2, 4: 5 });
    expect(result.modifier).toBe(-0.1);
  });

  it('integrates recalibrated GASP band via computePsychometricModifier at mean 3.0', () => {
    const result = computePsychometricModifier({ ...FULL_SCORES, gaspScore: 3.0 });
    expect(result.gaspComponent).toBe(0);
    expect(result.breakdown.gaspBand).toBe('strong — low externalization');
  });
});
