import { saveLifeDomainAnswersFromOnboarding } from '@/screens/profile/editProfile/lifeDomainProfileService';

const mockUpsert = jest.fn(async () => ({ error: null }));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({ upsert: mockUpsert })),
  },
}));

jest.mock('@/data/repos/profilesRepo', () => ({
  profilesRepo: {
    updateProfile: jest.fn(),
  },
}));

describe('saveLifeDomainAnswersFromOnboarding', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('batch upserts all answers in one request', async () => {
    await saveLifeDomainAnswersFromOnboarding('user-1', {
      finance: { yearlyIncome: '100k' },
      family: { wantKidsTimeline: 'Soon' },
    });

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    expect(mockUpsert.mock.calls[0]?.[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: 'user-1',
          domain_id: 'finance',
          question_id: 'yearlyIncome',
          answer: '100k',
        }),
        expect.objectContaining({
          user_id: 'user-1',
          domain_id: 'family',
          question_id: 'wantKidsTimeline',
          answer: 'Soon',
        }),
      ]),
    );
  });
});
