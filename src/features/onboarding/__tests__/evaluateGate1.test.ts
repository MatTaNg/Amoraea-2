import { evaluateGate1, type Gate1ScoringResult } from '../evaluateGate1';

const mk = (n: number) => ({
  mentalizing: n,
  accountability: n,
  contempt: n,
  repair: n,
  regulation: n,
  attunement: n,
  appreciation: n,
  commitment_threshold: n,
});

describe('evaluateGate1', () => {
  const baseResult: Gate1ScoringResult = {
    pillarScores: mk(7),
    averageScore: 7,
  };

  it('passes when all conditions met', () => {
    const r = evaluateGate1(baseResult);
    expect(r.passed).toBe(true);
    expect(r.failReasons).toHaveLength(0);
    expect(r.averageScore).toBe(7);
  });

  it('fails when average below 6.5', () => {
    const r = evaluateGate1({
      pillarScores: mk(6),
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('averageScore') && s.includes('6.5'))).toBe(true);
    expect(r.averageScore).toBe(6);
  });

  it('passes when average exactly at threshold 6.5', () => {
    const r = evaluateGate1({
      pillarScores: mk(6.5),
    });
    expect(r.passed).toBe(true);
    expect(r.averageScore).toBe(6.5);
  });

  it('fails when average just below 6.5', () => {
    const r = evaluateGate1({
      pillarScores: mk(6.49),
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('averageScore'))).toBe(true);
  });

  it('passes when Repair exactly at minimum 6', () => {
    const r = evaluateGate1({
      pillarScores: { ...mk(7), repair: 6 },
    });
    expect(r.passed).toBe(true);
  });

  it('fails when Repair below 6', () => {
    const r = evaluateGate1({
      pillarScores: { ...mk(7), repair: 5 },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('Repair') && s.includes('5'))).toBe(true);
  });

  it('fails when Accountability below 6', () => {
    const r = evaluateGate1({
      pillarScores: { ...mk(7), accountability: 4 },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('Accountability') && s.includes('4'))).toBe(true);
  });

  it('fails when high-confidence marker score below 5', () => {
    const r = evaluateGate1({
      pillarScores: { ...mk(7), contempt: 4 },
      pillarConfidence: {
        mentalizing: 'high',
        accountability: 'high',
        contempt: 'high',
        repair: 'high',
        regulation: 'high',
        attunement: 'high',
        appreciation: 'high',
        commitment_threshold: 'high',
      },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('contempt') && s.includes('high-confidence'))).toBe(true);
  });

  it('fails when more than one low-confidence marker', () => {
    const r = evaluateGate1({
      pillarScores: mk(7),
      pillarConfidence: {
        mentalizing: 'low',
        accountability: 'low',
        contempt: 'high',
        repair: 'high',
        regulation: 'high',
        attunement: 'high',
        appreciation: 'high',
        commitment_threshold: 'high',
      },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('low-confidence'))).toBe(true);
  });

  it('passes with exactly one low-confidence marker', () => {
    const r = evaluateGate1({
      pillarScores: mk(7),
      pillarConfidence: {
        mentalizing: 'low',
        accountability: 'high',
        contempt: 'high',
        repair: 'high',
        regulation: 'high',
        attunement: 'high',
        appreciation: 'high',
        commitment_threshold: 'high',
      },
    });
    expect(r.passed).toBe(true);
  });

  it('handles missing pillarScores', () => {
    const r = evaluateGate1({});
    expect(r.passed).toBe(false);
    expect(r.averageScore).toBe(0);
  });
});
