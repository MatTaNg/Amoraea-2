/**
 * Documents legacy pass-flip guard expectations (integration covered in applyPsychometricModifier).
 * When preservePassIfPreviouslyPassing is set and attempt.passed was true but computed final fails,
 * persisted passed stays true and legacy_psychometric_pass_flip_review is added.
 */
import { LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG } from '@features/psychometrics/legacyPsychometricReview';

describe('legacy psychometric pass-flip review flag', () => {
  it('uses a stable review_flags token for admin dashboards', () => {
    expect(LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG).toBe('legacy_psychometric_pass_flip_review');
  });

  it('merges review flag without dropping existing flags', () => {
    const existing = ['ego_development_review'];
    const merged = [...new Set([...existing, LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG])];
    expect(merged).toEqual(['ego_development_review', LEGACY_PSYCHOMETRIC_PASS_FLIP_REVIEW_FLAG]);
  });
});
