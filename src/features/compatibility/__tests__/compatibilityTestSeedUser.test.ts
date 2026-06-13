import {
  COMPATIBILITY_TEST_SEED_EMAIL_SUFFIX,
  COMPATIBILITY_TEST_SEED_TAG,
  isCompatibilityTestSeedEmail,
  isCompatibilityTestSeedProfileJson,
  isCompatibilityTestSeedUser,
} from '../compatibilityTestSeedUser';

describe('compatibilityTestSeedUser', () => {
  test('isCompatibilityTestSeedEmail matches seed script email domain', () => {
    expect(isCompatibilityTestSeedEmail(`compat-${COMPATIBILITY_TEST_SEED_TAG}-alice${COMPATIBILITY_TEST_SEED_EMAIL_SUFFIX}`)).toBe(true);
    expect(isCompatibilityTestSeedEmail('real@amoraea.com')).toBe(false);
  });

  test('isCompatibilityTestSeedProfileJson reads compatibilityTestSeed tag', () => {
    expect(
      isCompatibilityTestSeedProfileJson({
        compatibilityTestSeed: { tag: COMPATIBILITY_TEST_SEED_TAG, label: 'Ideal Alice' },
      }),
    ).toBe(true);
    expect(isCompatibilityTestSeedProfileJson({ compatibilityTestSeed: { tag: 'other' } })).toBe(false);
  });

  test('isCompatibilityTestSeedUser checks id set and email fallback', () => {
    const ids = new Set(['uuid-1']);
    expect(isCompatibilityTestSeedUser({ id: 'uuid-1', email: 'x@amoraea.com' }, ids)).toBe(true);
    expect(isCompatibilityTestSeedUser({ id: 'uuid-2', email: `x${COMPATIBILITY_TEST_SEED_EMAIL_SUFFIX}` }, ids)).toBe(true);
    expect(isCompatibilityTestSeedUser({ id: 'uuid-3', email: 'x@amoraea.com' }, ids)).toBe(false);
  });
});
