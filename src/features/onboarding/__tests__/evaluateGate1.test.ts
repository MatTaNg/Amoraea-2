import { evaluateGate1, type Gate1ScoringResult } from '../evaluateGate1';

describe('evaluateGate1', () => {
  const baseResult: Gate1ScoringResult = {
    pillarScores: { '1': 7, '3': 7, '4': 7, '5': 7, '6': 7, '9': 7 },
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
      pillarScores: { '1': 6, '3': 6, '4': 6, '5': 6, '6': 6, '9': 6 },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('averageScore') && s.includes('6.5'))).toBe(true);
    expect(r.averageScore).toBe(6);
  });

  it('fails when Pillar 1 below 6', () => {
    const r = evaluateGate1({
      pillarScores: { '1': 5, '3': 7, '4': 7, '5': 7, '6': 7, '9': 7 },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('Pillar 1') && s.includes('5'))).toBe(true);
  });

  it('fails when Pillar 3 below 6', () => {
    const r = evaluateGate1({
      pillarScores: { '1': 7, '3': 4, '4': 7, '5': 7, '6': 7, '9': 7 },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('Pillar 3') && s.includes('4'))).toBe(true);
  });

  it('fails when high-confidence pillar score below 5', () => {
    const r = evaluateGate1({
      pillarScores: { '1': 7, '3': 7, '4': 4, '5': 7, '6': 7, '9': 7 },
      pillarConfidence: { '1': 'high', '3': 'high', '4': 'high', '5': 'high', '6': 'high', '9': 'high' },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('Pillar 4') && s.includes('high-confidence'))).toBe(true);
  });

  it('fails when more than one low-confidence pillar', () => {
    const r = evaluateGate1({
      pillarScores: { '1': 7, '3': 7, '4': 7, '5': 7, '6': 7, '9': 7 },
      pillarConfidence: { '1': 'low', '3': 'low', '4': 'high', '5': 'high', '6': 'high', '9': 'high' },
    });
    expect(r.passed).toBe(false);
    expect(r.failReasons.some((s) => s.includes('low-confidence'))).toBe(true);
  });

  it('passes with exactly one low-confidence pillar', () => {
    const r = evaluateGate1({
      pillarScores: { '1': 7, '3': 7, '4': 7, '5': 7, '6': 7, '9': 7 },
      pillarConfidence: { '1': 'low', '3': 'high', '4': 'high', '5': 'high', '6': 'high', '9': 'high' },
    });
    expect(r.passed).toBe(true);
  });

  it('handles missing pillarScores', () => {
    const r = evaluateGate1({});
    expect(r.passed).toBe(false);
    expect(r.averageScore).toBe(0);
  });
});
