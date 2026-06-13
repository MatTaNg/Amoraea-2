import { isUserProfileMatchEligible } from '../adminMatchEligibleProfile';

describe('adminMatchEligibleProfile', () => {
  test('returns false for null or empty profile', () => {
    expect(isUserProfileMatchEligible(null)).toBe(false);
    expect(isUserProfileMatchEligible({})).toBe(false);
  });

  test('returns true for profile complete for matching', () => {
    expect(
      isUserProfileMatchEligible({
        displayName: 'Alex',
        gender: 'woman',
        relationshipStyle: 'Monogamous',
        location: 'Austin, TX',
        birthDate: '1990-01-01',
        birthTime: '12:00',
        birthLocation: 'Austin, TX',
        matchPreferences: {
          distanceRange: [0, 50],
          ageRange: [25, 45],
          genderPreference: ['men'],
        },
        lifeDomains: {
          intimacy: 50,
          finance: 50,
          spirituality: 50,
          family: 50,
          physicalHealth: 50,
        },
        photos: ['https://example.com/photo.jpg'],
        phoneNumber: '+15551234567',
        contactPreference: 'text',
      }),
    ).toBe(true);
  });
});
