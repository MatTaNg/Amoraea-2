import { describe, expect, it } from '@jest/globals';
import {
  bothPersonalMomentsAbsentOrLow,
  normalizeResponseConcreteness,
  personalMomentConcretenessModifierFromLevels,
} from '../responseConcreteness';

describe('responseConcreteness', () => {
  it('normalizes known levels', () => {
    expect(normalizeResponseConcreteness('HIGH')).toBe('high');
    expect(normalizeResponseConcreteness(' absent ')).toBe('absent');
    expect(normalizeResponseConcreteness('maybe')).toBeNull();
  });

  it('modifier rules for paired moments', () => {
    expect(personalMomentConcretenessModifierFromLevels('absent', 'absent')).toBe(-0.3);
    expect(personalMomentConcretenessModifierFromLevels('low', 'low')).toBe(-0.2);
    expect(personalMomentConcretenessModifierFromLevels('absent', 'low')).toBe(-0.25);
    expect(personalMomentConcretenessModifierFromLevels('low', 'absent')).toBe(-0.25);
    expect(personalMomentConcretenessModifierFromLevels('absent', 'moderate')).toBe(0);
    expect(personalMomentConcretenessModifierFromLevels(null, 'low')).toBe(0);
  });

  it('bothPersonalMomentsAbsentOrLow', () => {
    expect(bothPersonalMomentsAbsentOrLow('absent', 'low')).toBe(true);
    expect(bothPersonalMomentsAbsentOrLow('high', 'low')).toBe(false);
    expect(bothPersonalMomentsAbsentOrLow(null, 'low')).toBe(false);
  });
});
