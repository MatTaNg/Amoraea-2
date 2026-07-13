import { describe, expect, it } from '@jest/globals';
import { navigateToDatingProfileOnboardingEntry } from '../navigateToDatingProfileOnboardingEntry';

describe('navigateToDatingProfileOnboardingEntry', () => {
  it('opens the nested stack at DatingOnboardingEntry', () => {
    const navigate = jest.fn();
    navigateToDatingProfileOnboardingEntry({ navigate }, 'user-42');
    expect(navigate).toHaveBeenCalledWith('DatingProfileOnboarding', {
      userId: 'user-42',
      screen: 'DatingOnboardingEntry',
    });
  });
});
