import { describe, expect, it } from '@jest/globals';

import {
  initialLifestyleQuestionIndex,
  resumeLifestyleQuestionIndex,
} from '../MatchPreferencesModal';

describe('resumeLifestyleQuestionIndex', () => {
  it('starts at the first unanswered lifestyle question', () => {
    expect(
      resumeLifestyleQuestionIndex({
        longTermLivingPreference: 'City',
        lifestylePreference: '',
        relocationPreference: '',
      }),
    ).toBe(1);
  });

  it('opens the relocate question when backing in, even if answers are missing', () => {
    expect(initialLifestyleQuestionIndex({}, true)).toBe(2);
  });

  it('returns the last lifestyle question when every answer is already filled', () => {
    expect(
      resumeLifestyleQuestionIndex({
        longTermLivingPreference: 'City',
        lifestylePreference: 'Active',
        relocationPreference: 'Yes',
      }),
    ).toBe(2);
  });
});
