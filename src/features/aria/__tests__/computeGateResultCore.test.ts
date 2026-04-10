import {
  computeGateResultCore,
  GATE_PASS_WEIGHTED_MIN,
} from '../computeGateResultCore';
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
});
