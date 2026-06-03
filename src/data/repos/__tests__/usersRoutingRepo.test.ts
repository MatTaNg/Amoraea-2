jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@data/supabase/client';
import { clearReferralNoticePending, updateUserOnboardingFlags } from '../usersRoutingRepo';

describe('clearReferralNoticePending', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('nulls referral_notice_pending on users', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    await clearReferralNoticePending('user-1');

    expect(update).toHaveBeenCalledWith({ referral_notice_pending: null });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('updates onboarding_step on users', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    await updateUserOnboardingFlags('user-1', { onboardingStep: 3, onboardingCompleted: true });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        onboarding_step: 3,
        onboarding_completed: true,
      }),
    );
  });

  it('skips update when onboarding patch is empty', async () => {
    await updateUserOnboardingFlags('user-1', {});
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('throws when clearReferralNoticePending fails', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: { message: 'denied' } }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    await expect(clearReferralNoticePending('user-1')).rejects.toThrow('denied');
  });

  it('throws when updateUserOnboardingFlags fails', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: { message: 'write failed' } }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    await expect(updateUserOnboardingFlags('user-1', { onboardingStep: 1 })).rejects.toThrow(
      'Failed to update onboarding flags: write failed',
    );
  });
});
