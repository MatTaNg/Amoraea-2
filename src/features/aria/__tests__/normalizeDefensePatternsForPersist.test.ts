import {
  DEFAULT_DEFENSE_PATTERNS,
  isDefensePatternsShapeIncomplete,
  normalizeDefensePatternsForPersist,
} from '@features/aria/defensePatternsDetection';

describe('normalizeDefensePatternsForPersist', () => {
  it('replaces empty DB default object with all false flags', () => {
    expect(isDefensePatternsShapeIncomplete({})).toBe(true);
    expect(normalizeDefensePatternsForPersist({})).toEqual({
      ...DEFAULT_DEFENSE_PATTERNS,
    });
  });

  it('preserves explicit true flags', () => {
    expect(
      normalizeDefensePatternsForPersist({
        projection_detected: false,
        rationalization_detected: false,
        splitting_detected: true,
        denial_detected: false,
      }),
    ).toEqual({
      projection_detected: false,
      rationalization_detected: false,
      splitting_detected: true,
      denial_detected: false,
    });
  });

  it('treats missing keys as false', () => {
    expect(
      normalizeDefensePatternsForPersist({
        splitting_detected: true,
      } as Record<string, unknown>),
    ).toEqual({
      projection_detected: false,
      rationalization_detected: false,
      splitting_detected: true,
      denial_detected: false,
    });
  });
});
