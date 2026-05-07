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
  });

  it('still computes scenario composites and scenario_floor when holistic floor_breach fires first', () => {
    const pillars = allMarkers(7);
    pillars.repair = 4; /* below repair floor 4.5 */
    const hi = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const r = computeGateResultCore(pillars, null, {
      scenarioPillarScoresByScenario: {
        1: hi,
        2: hi,
        /** Mean 4.0 < 4.5 */
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
        /** Mean (4+4)/2 = 4.0 < 4.5 while holistic pillars still meet weighted gate. */
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
    const pillars = allMarkers(6.1);
    const r = computeGateResultCore(pillars, null, {
      weightedPassMin: 5.5,
      skipPenaltyTotal: -0.3,
    });
    expect(r.weightedScore).toBe(5.8);
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
});
