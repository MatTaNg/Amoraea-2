jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn().mockResolvedValue(undefined),
}));

import {
  computeGateResult,
  GATE_MARKER_BASE_WEIGHTS,
  GATE_PASS_WEIGHTED_MIN,
  REFERRAL_WEIGHTED_PASS_MIN,
} from '../computeGateResult';
import { INTERVIEW_MARKER_IDS } from '../interviewMarkers';

beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation((msg?: unknown, ...rest: unknown[]) => {
    if (typeof msg === 'string' && msg.includes('[WEIGHTED_SCORE_BREAKDOWN]')) return;
    // eslint-disable-next-line no-console -- pass through other logs
    (jest.requireActual('console') as { log: typeof console.log }).log(msg, ...rest);
  });
});
afterAll(() => {
  jest.restoreAllMocks();
});

const allAssessed = (score: number) =>
  Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, score])) as Record<string, number>;

describe('computeGateResult — research weights & floors', () => {
  it('base weights sum to 1.0', () => {
    const s = INTERVIEW_MARKER_IDS.reduce((a, id) => a + GATE_MARKER_BASE_WEIGHTS[id], 0);
    expect(s).toBeCloseTo(1, 6);
  });

  it('passes when all constructs at 6 (threshold inclusive)', () => {
    const r = computeGateResult(allAssessed(6));
    expect(r.pass).toBe(true);
    expect(r.reason).toBe('pass');
    expect(r.weightedScore).toBe(6);
    expect(r.failReason).toBeNull();
  });

  it('fails weighted when just below 6.0', () => {
    const scores = allAssessed(5.95);
    const r = computeGateResult(scores);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('weighted_below_threshold');
    expect(r.failReason).toMatch(/weighted_below_threshold/);
    expect(r.failReason).toContain('6.0');
  });

  it('excludes unassessed (0) from numerator and renormalizes weights', () => {
    const scores: Record<string, number> = { ...allAssessed(10), regulation: 0 };
    const r = computeGateResult(scores);
    expect(r.excludedMarkers).toContain('regulation');
    expect(r.weightedScore).toBe(10);
    expect(r.pass).toBe(true);
  });

  /** Attempt 111–style: blame-shift / weak repair; regulation often absent from aggregate. */
  it('Attempt 111: fails on floor breach (repair 3.8, accountability 4.0)', () => {
    const scores: Record<string, number> = {
      repair: 3.8,
      contempt: 6.5,
      attunement: 6.3,
      mentalizing: 7.2,
      appreciation: 5,
      accountability: 4,
      commitment_threshold: 7.4,
    };
    const r = computeGateResult(scores);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('floor_breach');
    expect(r.failReason).toMatch(/^floor_breach:/);
    expect(r.failReason).toContain('repair (3.8)');
    expect(r.failReason).toContain('accountability (4.0)');
    expect(r.weightedScore).not.toBeNull();
  });

  /** Strong profile: high weighted, all constructs above individual floors. */
  it('Attempt 109–style: passes with high uniform scores', () => {
    const r = computeGateResult(allAssessed(8.8));
    expect(r.pass).toBe(true);
    expect(r.weightedScore).toBe(8.8);
    expect(r.failReason).toBeNull();
  });

  /** Typical “solid but not stellar” mid-band above all floors. */
  it('Attempts ~73–105 style: repair/accountability ~5.5–6, contempt high → pass', () => {
    const scores = allAssessed(7);
    scores.repair = 5.5;
    scores.accountability = 5.5;
    scores.contempt = 8.5;
    scores.regulation = 6;
    const r = computeGateResult(scores);
    expect(r.pass).toBe(true);
    expect(r.reason).toBe('pass');
    expect(r.weightedScore).toBeGreaterThanOrEqual(GATE_PASS_WEIGHTED_MIN);
  });

  it('fails contempt floor at 4.9 when assessed', () => {
    const scores = allAssessed(7);
    scores.contempt = 4.9;
    const r = computeGateResult(scores);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('floor_breach');
    expect(r.failReason).toContain('contempt');
  });

  it('regulation floor 4.0: 3.9 fails', () => {
    const scores = allAssessed(7);
    scores.regulation = 3.9;
    const r = computeGateResult(scores);
    expect(r.pass).toBe(false);
    expect(r.failReason).toContain('regulation');
  });

  it('high weighted average does not override accountability floor breach', () => {
    const scores = allAssessed(9);
    scores.accountability = 4.0;
    const r = computeGateResult(scores);
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('floor_breach');
    expect(r.failReason).toContain('accountability (4.0)');
  });

  it('renormalizes when only a subset of constructs is assessed', () => {
    const scores: Record<string, number> = {
      contempt: 10,
      accountability: 10,
      repair: 10,
      mentalizing: 10,
    };
    const r = computeGateResult(scores);
    expect(r.assessedMarkerCount).toBe(4);
    expect(r.weightedScore).toBe(10);
    expect(r.pass).toBe(true);
  });

  it('referral boost: weightedPassMin 5.5 passes uniform 5.8 (would fail at 6.0)', () => {
    const scores = allAssessed(5.8);
    const r = computeGateResult(scores, null, { weightedPassMin: REFERRAL_WEIGHTED_PASS_MIN });
    expect(r.pass).toBe(true);
    expect(r.reason).toBe('pass');
  });

  it('referral boost: weightedPassMin 5.5 still fails uniform 5.4', () => {
    const scores = allAssessed(5.4);
    const r = computeGateResult(scores, null, { weightedPassMin: REFERRAL_WEIGHTED_PASS_MIN });
    expect(r.pass).toBe(false);
    expect(r.reason).toBe('weighted_below_threshold');
    expect(r.failReason).toContain('5.5');
  });
});
