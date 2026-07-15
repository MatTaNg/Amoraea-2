import { computeGateResultCore, GATE_PASS_WEIGHTED_MIN } from '../computeGateResultCore';
import { SCENARIO_COMPOSITE_PASS_MIN } from '../scenarioCompositeFloor';
import { INTERVIEW_MARKER_IDS } from '../interviewMarkers';

const allMarkers = (score: number) =>
  Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, score])) as Record<string, number>;

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation((msg?: unknown) => {
    if (typeof msg === 'string' && msg.includes('[WEIGHTED_SCORE_BREAKDOWN]')) return;
  });
});
afterAll(() => {
  jest.restoreAllMocks();
});

describe('computeGateResultCore', () => {
  it('fails with no_assessed_markers when no construct is scored above zero', () => {
    const zeros = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 0])) as Record<string, number>;
    const r = computeGateResultCore(zeros);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('no_assessed_markers');
    expect(r.weightedScore).toBeNull();
  });

  it('calls onWeightedBreakdown with contributions when provided', () => {
    const onWeightedBreakdown = jest.fn();
    computeGateResultCore(allMarkers(7), null, { onWeightedBreakdown });
    expect(onWeightedBreakdown).toHaveBeenCalledWith(
      expect.objectContaining({
        contributions: expect.any(Array),
        weightedScore: expect.any(Number),
      })
    );
  });

  it('applies skepticism modifier before floors and weighted sum', () => {
    const scores = allMarkers(7);
    scores.repair = 6;
    const down = computeGateResultCore(scores, { pillarId: 'repair', adjustment: -2 });
    expect(down.pass).toBe(false);
    expect(down.reason).toBe('floor_breach');
    expect(down.failReason).toContain('repair');
    expect(down.failReasonCodes).toContain('weighted_score');
  });

  it('still computes scenario composites and scenario_floor when holistic floor_breach fires first', () => {
    const pillars = allMarkers(7);
    pillars.repair = 4; /* below repair floor 5.0 */
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: hi,
        2: hi,
        /** Mean 4.0 < 5.0 */
        3: { accountability: 4, repair: 4 },
      },
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('floor_breach');
    expect(r.failReasonCodes).toContain('scenario_floor');
    expect(r.failReasonDetail?.scenario_floor?.breaches.some((b) => b.scenario === 3)).toBe(true);
    expect(r.scenarioComposites?.['3']).toBeLessThan(SCENARIO_COMPOSITE_PASS_MIN);
  });

  it('ignores skepticism modifier when pillar id is missing', () => {
    const r = computeGateResultCore(allMarkers(7), { pillarId: null, adjustment: -2 });
    expect(r.pass).toBe(true);
    expect(r.weightedScore).toBe(7);
  });

  it('passes weighted threshold at exactly GATE_PASS_WEIGHTED_MIN', () => {
    const r = computeGateResultCore(allMarkers(GATE_PASS_WEIGHTED_MIN));
    expect(r.pass).toBe(true);
    expect(r.weightedScore).toBe(GATE_PASS_WEIGHTED_MIN);
  });

  it('fails scenario_floor when weighted passes but a scenario composite is below minimum', () => {
    const pillars = allMarkers(GATE_PASS_WEIGHTED_MIN);
    const hi = Object.fromEntries(
      INTERVIEW_MARKER_IDS.map((id) => [id, 7]),
    ) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: hi,
        2: hi,
        /** Mean (4+4)/2 = 4.0 < 5.0 while holistic pillars still meet weighted gate. */
        3: { accountability: 4, repair: 4 },
      },
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('scenario_floor');
    expect(r.failReasonCodes).toContain('scenario_floor');
    expect(r.failReason).toContain('scenario_floor');
    expect(r.failReason).toContain('weighted_threshold_met');
    expect(r.scenarioComposites?.['3']).toBeLessThan(SCENARIO_COMPOSITE_PASS_MIN);
  });

  it('passes when scenario composites meet minimum alongside weighted threshold', () => {
    const pillars = allMarkers(GATE_PASS_WEIGHTED_MIN);
    const hi = Object.fromEntries(
      INTERVIEW_MARKER_IDS.map((id) => [id, 6]),
    ) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: hi, 2: hi, 3: hi },
    });
    expect(r.pass).toBe(true);
    expect(r.scenarioComposites?.['1']).toBeGreaterThanOrEqual(SCENARIO_COMPOSITE_PASS_MIN);
  });

  it('fails mentalizing_floor when mentalizing < 4 in 2+ assessed scenarios', () => {
    const pillars = allMarkers(GATE_PASS_WEIGHTED_MIN);
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: { ...hi, mentalizing: 3 },
        2: { ...hi, mentalizing: 3.5 },
        3: hi,
      },
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('mentalizing_floor');
    expect(r.failReasonCodes).toContain('mentalizing_floor');
    expect(r.failReason).toContain('mentalizing_floor');
  });

  it('fails repair_floor when repair < 4 in 2+ assessed scenarios', () => {
    const pillars = allMarkers(GATE_PASS_WEIGHTED_MIN);
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: { ...hi, repair: 3 },
        2: { ...hi, repair: 3 },
        3: hi,
      },
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('repair_floor');
    expect(r.failReasonCodes).toContain('repair_floor');
  });

  it('does not count null mentalizing toward the 2-scenario floor', () => {
    const pillars = allMarkers(GATE_PASS_WEIGHTED_MIN);
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const s: Record<string, number | null> = { ...hi, mentalizing: null };
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: { ...hi, mentalizing: 3 },
        2: s as Record<string, number | null | undefined>,
        3: hi,
      },
    });
    expect(r.pass).toBe(true);
  });

  it('accumulates weighted_score and scenario_floor when both fail', () => {
    const pillars = allMarkers(5.4);
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: hi,
        2: hi,
        3: { accountability: 4, repair: 4 },
      },
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('weighted_below_threshold');
    expect(r.failReasonCodes).toEqual(['weighted_score', 'scenario_floor']);
    expect(r.failReason).toContain('weighted_score');
    expect(r.failReason).toContain('scenario_floor');
  });

  it('deducts skip penalties from marker weighted score before threshold check', () => {
    const pillars = allMarkers(6.1);
    const r = computeGateResultCore(pillars, null, { skipPenaltyTotal: -0.3 });
    expect(r.markerWeightedScore).toBe(6.1);
    expect(r.weightedScore).toBe(5.8);
    expect(r.pass).toBe(false);
  });

  it('referral-weighted pass applies post-penalty score vs weightedPassMin', () => {
    const pillars = allMarkers(6.4);
    const r = computeGateResultCore(pillars, null, {
      weightedPassMin: 6.0,
      skipPenaltyTotal: -0.3,
    });
    expect(r.weightedScore).toBe(6.1);
    expect(r.pass).toBe(true);
  });

  it('third skip auto-fail forces weighted score to 0 and fails without extra deduction math', () => {
    const pillars = allMarkers(8);
    const r = computeGateResultCore(pillars, null, {
      skipPenaltyTotal: -0.9,
      skipAutoFail: true,
    });
    expect(r.markerWeightedScore).toBe(8);
    expect(r.weightedScore).toBe(0);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('weighted_below_threshold');
  });

  it('floor_breach returns marker weighted score even when skip penalties were supplied', () => {
    const pillars = allMarkers(7);
    pillars.repair = 4;
    const r = computeGateResultCore(pillars, null, { skipPenaltyTotal: -0.3 });
    expect(r.reason).toBe('floor_breach');
    expect(r.weightedScore).toBeGreaterThan(6);
  });

  it('adds ego_development_floor when holistic ego level is 1', () => {
    const pillars = allMarkers(7.5);
    const hi = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 1,
      scenarioPillarScoresByScenario: { 1: hi, 2: hi, 3: hi },
    });
    expect(r.pass).toBe(false);
    expect(r.failReasonCodes).toContain('ego_development_floor');
    expect(r.reason).toBe('ego_development_floor');
    expect(r.egoDevelopmentModifier).toBe(-0.3);
    expect(r.failReasonDetail?.ego_development_floor).toEqual({ level: 1, weightedScore: 7.2 });
  });

  it('fails ego_development_floor when ego level is 1 even if modified score clears threshold', () => {
    const pillars = allMarkers(7.6);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 1,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
    });
    expect(r.pass).toBe(false);
    expect(r.failReasonCodes).toContain('ego_development_floor');
  });

  it('applies 0 ego modifier for level 2 and still flags review', () => {
    const pillars = allMarkers(6.1);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 2,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
    });
    expect(r.egoDevelopmentModifier).toBe(0);
    expect(r.reviewFlags).toContain('ego_development_review');
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('weighted_below_threshold');
  });

  it('fails weighted gate at 6.4 with ego level 2 (no score modifier) vs 6.5 min', () => {
    const pillars = allMarkers(6.4);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 2,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
    });
    expect(r.egoDevelopmentModifier).toBe(0);
    expect(r.modifiedWeightedScore).toBe(6.4);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('weighted_below_threshold');
  });

  it('passes weighted gate at 6.8 with ego level 2 (no score modifier) vs 6.5 min', () => {
    const pillars = allMarkers(6.8);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 2,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
    });
    expect(r.modifiedWeightedScore).toBe(6.8);
    expect(r.pass).toBe(true);
  });

  it('fails scenario_floor when any single scenario composite is below 5.0', () => {
    const pillars = allMarkers(GATE_PASS_WEIGHTED_MIN);
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: hi,
        2: hi,
        3: { accountability: 4.9, repair: 4.9 },
      },
    });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('scenario_floor');
    expect(r.scenarioComposites?.['3']).toBe(4.9);
  });

  it('parses string ego level 2 and accumulates concreteness modifier (e.g. absent+low → -0.35 total)', () => {
    const pillars = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: '2' as unknown as number,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
      moment4Concreteness: 'absent',
      moment5Concreteness: 'low',
    });
    expect(r.egoDevelopmentModifier).toBe(0);
    expect(r.scoreModifier).toBeCloseTo(-0.35, 5);
    expect(r.modifiedWeightedScore).toBe(6.65);
  });

  it('applies +0.1 ego modifier for level 3', () => {
    const pillars = allMarkers(6.5);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 3,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
    });
    expect(r.egoDevelopmentModifier).toBe(0.1);
    expect(r.modifiedWeightedScore).toBe(6.6);
    expect(r.pass).toBe(true);
  });

  it('applies defense-pattern score adjustment (per-flag cap -0.4 plus -0.5 when 3+ flags)', () => {
    const pillars = allMarkers(6.2);
    const hi = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: hi, 2: hi, 3: hi },
      defensePatterns: {
        projection_detected: true,
        rationalization_detected: true,
        splitting_detected: true,
        denial_detected: true,
      },
    });
    expect(r.defensePatternScoreAdjustment).toBe(-0.8);
    expect(r.pass).toBe(false);
    expect(r.failReasonCodes).toContain('immature_defense_pattern');
    expect(r.reviewFlags).not.toContain('defense_pattern_review');
  });

  it('adds defense_pattern_review when exactly two defense flags fire', () => {
    const pillars = allMarkers(6.05);
    const hi = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: hi, 2: hi, 3: hi },
      defensePatterns: {
        projection_detected: true,
        rationalization_detected: true,
        splitting_detected: false,
        denial_detected: false,
      },
    });
    expect(r.reviewFlags).toContain('defense_pattern_review');
    expect(r.reviewFlags).not.toContain('immature_defense_pattern');
    expect(r.defensePatternScoreAdjustment).toBe(-0.35);
    expect(r.pass).toBe(false);
  });

  it('records immature_defense_pattern when 3+ flags and weighted threshold fails', () => {
    const pillars = allMarkers(6.0);
    const hi = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: hi, 2: hi, 3: hi },
      defensePatterns: {
        projection_detected: true,
        rationalization_detected: true,
        splitting_detected: true,
        denial_detected: false,
      },
    });
    expect(r.pass).toBe(false);
    expect(r.failReasonCodes).toContain('weighted_score');
    expect(r.failReasonCodes).toContain('immature_defense_pattern');
  });

  it('stacks ego level 2 (0 modifier) with a single defense flag', () => {
    const pillars = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      egoDevelopmentLevel: 2,
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
      defensePatterns: {
        projection_detected: true,
        rationalization_detected: false,
        splitting_detected: false,
        denial_detected: false,
      },
    });
    expect(r.scoreModifier).toBeCloseTo(-0.15, 5);
  });

  it('coerces string emotionRecognitionCorrectCount 0 into raw score and applies review flag only', () => {
    const pillars = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
      emotionRecognitionCorrectCount: '0' as unknown as number,
      emotionRecognitionResponses: ['A', 'A', 'A'],
    });
    expect(r.failReasonCodes ?? []).not.toContain('emotion_recognition_floor');
    expect(r.reviewFlags).toContain('emotion_recognition_review');
    expect(r.depthSignalModifier).toBeLessThan(0);
  });

  it('null emotion scores for incomplete battery do not fail gate or apply modifier', () => {
    const pillars = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
      emotionRecognitionRawScore: 0.333,
      emotionRecognitionResponses: ['B'],
    });
    expect(r.failReasonCodes ?? []).not.toContain('emotion_recognition_floor');
    expect(r.reviewFlags).not.toContain('emotion_recognition_review');
    expect(r.depthSignalModifier).toBe(0);
  });

  it('complete battery with low raw score applies modifier but not gate fail', () => {
    const pillars = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
      emotionRecognitionRawScore: 0,
      emotionRecognitionResponses: ['A', 'A', 'A'],
    });
    expect(r.failReasonCodes ?? []).not.toContain('emotion_recognition_floor');
    expect(r.reviewFlags).toContain('emotion_recognition_review');
    expect(r.depthSignalModifier).toBeCloseTo(-0.2, 5);
  });

  it('coerces string mentalizingOvercertaintyCount for overcertainty review', () => {
    const pillars = allMarkers(7);
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: { 1: pillars, 2: pillars, 3: pillars },
      mentalizingOvercertaintyCount: '2' as unknown as number,
    });
    expect(r.reviewFlags).toContain('mentalizing_overcertainty');
  });
});
