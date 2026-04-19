/**
 * Integration: final compatibility score math (no Supabase — pure modules only).
 */
import { computeFinalCompatibilityScore } from '@features/compatibility/styleCompatibilityScore';

describe('compatibility pipeline', () => {
  it('computes a bounded final compatibility score from sub-scores', () => {
    const final = computeFinalCompatibilityScore({
      attachmentScore: 0.9,
      valuesScore: 0.9,
      semanticScore: 0.9,
      styleScore: 0.85,
      styleConfidence: 0.9,
      dealbreakerMultiplier: 1,
    });
    expect(final).toBeGreaterThan(0);
    expect(final).toBeLessThanOrEqual(1);
  });
});
