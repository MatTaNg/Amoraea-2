import { computeFinalCompatibilityScore } from '../styleCompatibilityScore';

describe('computeFinalCompatibilityScore', () => {
  it('weights style toward neutral when styleConfidence is 0', () => {
    const score = computeFinalCompatibilityScore({
      attachmentScore: 1,
      valuesScore: 1,
      semanticScore: 1,
      styleScore: 0,
      styleConfidence: 0,
      dealbreakerMultiplier: 1,
    });
    // weightedStyle = 0 * 0 + 0.5 * 1 = 0.5
    // final = (1*0.35 + 1*0.3 + 0.5*0.2 + 1*0.15) * 1 = 0.35+0.3+0.1+0.15 = 0.9
    expect(score).toBeCloseTo(0.9, 5);
  });

  it('uses full style score when styleConfidence is 1', () => {
    const score = computeFinalCompatibilityScore({
      attachmentScore: 0.8,
      valuesScore: 0.8,
      semanticScore: 0.8,
      styleScore: 1,
      styleConfidence: 1,
      dealbreakerMultiplier: 1,
    });
    const weightedStyle = 1;
    const expected =
      (0.8 * 0.35 + 0.8 * 0.3 + weightedStyle * 0.2 + 0.8 * 0.15) * 1;
    expect(score).toBeCloseTo(expected, 5);
  });

  it('clamps styleConfidence: below 0 treated as 0', () => {
    const clamped = computeFinalCompatibilityScore({
      attachmentScore: 0.5,
      valuesScore: 0.5,
      semanticScore: 0.5,
      styleScore: 0.2,
      styleConfidence: -1,
      dealbreakerMultiplier: 1,
    });
    const sameAsZero = computeFinalCompatibilityScore({
      attachmentScore: 0.5,
      valuesScore: 0.5,
      semanticScore: 0.5,
      styleScore: 0.2,
      styleConfidence: 0,
      dealbreakerMultiplier: 1,
    });
    expect(clamped).toBe(sameAsZero);
  });

  it('clamps styleConfidence: above 1 treated as 1', () => {
    const clamped = computeFinalCompatibilityScore({
      attachmentScore: 0.5,
      valuesScore: 0.5,
      semanticScore: 0.5,
      styleScore: 0.2,
      styleConfidence: 2,
      dealbreakerMultiplier: 1,
    });
    const sameAsOne = computeFinalCompatibilityScore({
      attachmentScore: 0.5,
      valuesScore: 0.5,
      semanticScore: 0.5,
      styleScore: 0.2,
      styleConfidence: 1,
      dealbreakerMultiplier: 1,
    });
    expect(clamped).toBe(sameAsOne);
  });

  it('applies dealbreaker multiplier', () => {
    const full = computeFinalCompatibilityScore({
      attachmentScore: 1,
      valuesScore: 1,
      semanticScore: 1,
      styleScore: 1,
      styleConfidence: 1,
      dealbreakerMultiplier: 1,
    });
    const half = computeFinalCompatibilityScore({
      attachmentScore: 1,
      valuesScore: 1,
      semanticScore: 1,
      styleScore: 1,
      styleConfidence: 1,
      dealbreakerMultiplier: 0.5,
    });
    expect(half).toBeCloseTo(full * 0.5, 5);
  });

  it('clamps output to 0..1', () => {
    const s = computeFinalCompatibilityScore({
      attachmentScore: 2,
      valuesScore: 2,
      semanticScore: 2,
      styleScore: 2,
      styleConfidence: 1,
      dealbreakerMultiplier: 1,
    });
    expect(s).toBe(1);
  });
});
