import { describe, expect, it } from '@jest/globals';
import { sexualCommunicationPairAdjustment } from '../sexualCommunicationCompatibility';

describe('sexualCommunicationPairAdjustment', () => {
  it('boosts when scores are within 0.5', () => {
    expect(sexualCommunicationPairAdjustment(4.2, 4.0)).toEqual({
      adjustment: 0.03,
      label: 'boost',
    });
  });

  it('penalizes when scores differ by more than 1.5', () => {
    expect(sexualCommunicationPairAdjustment(2.0, 4.5)).toEqual({
      adjustment: -0.05,
      label: 'penalty',
    });
  });

  it('is neutral in the middle band', () => {
    expect(sexualCommunicationPairAdjustment(2.0, 3.2)).toEqual({
      adjustment: 0,
      label: 'neutral',
    });
  });

  it('returns missing when either score is absent', () => {
    expect(sexualCommunicationPairAdjustment(null, 4)).toEqual({
      adjustment: 0,
      label: 'missing',
    });
  });
});
