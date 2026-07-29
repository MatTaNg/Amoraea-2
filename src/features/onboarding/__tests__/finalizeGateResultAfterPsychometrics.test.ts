jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

jest.mock('@features/psychometrics/applyPsychometricModifier', () => ({
  applyPsychometricModifierToAttempt: jest.fn(),
}));

jest.mock('@features/psychometrics/interviewCompletionStatus', () => ({
  fetchMostRecentCompletedInterviewAttemptId: jest.fn(),
}));

jest.mock('@features/referrals/referralInterview', () => ({
  applyReferralCompletionEffects: jest.fn(() => Promise.resolve()),
}));

jest.mock('@features/referrals/referralCompletionCongratsStorage', () => ({
  markReferralCompletionCongratsPending: jest.fn(() => Promise.resolve()),
}));

import { supabase } from '@data/supabase/client';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import { applyReferralCompletionEffects } from '@features/referrals/referralInterview';
import { markReferralCompletionCongratsPending } from '@features/referrals/referralCompletionCongratsStorage';
import { finalizeGateResultAfterPsychometrics } from '../finalizeGateResultAfterPsychometrics';

describe('finalizeGateResultAfterPsychometrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchMostRecentCompletedInterviewAttemptId as jest.Mock).mockResolvedValue('attempt-1');
    (applyPsychometricModifierToAttempt as jest.Mock).mockResolvedValue({ applied: true });
  });

  it('applies referral completion effects after gate finalization succeeds', async () => {
    const eqUser = jest.fn(() => Promise.resolve({ error: null }));
    const eqId = jest.fn(() => ({ eq: eqUser }));
    const update = jest.fn(() => ({ eq: eqId }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    const result = await finalizeGateResultAfterPsychometrics('user-1', 'attempt-1');

    expect(result).toEqual({ ok: true, attemptId: 'attempt-1' });
    expect(applyReferralCompletionEffects).toHaveBeenCalledWith('user-1');
    expect(markReferralCompletionCongratsPending).toHaveBeenCalledWith('user-1');
  });

  it('does not apply referral completion effects when gate finalization fails', async () => {
    (applyPsychometricModifierToAttempt as jest.Mock).mockResolvedValue({
      applied: false,
      skipReason: 'missing psychometrics',
    });

    const result = await finalizeGateResultAfterPsychometrics('user-1', 'attempt-1');

    expect(result.ok).toBe(false);
    expect(applyReferralCompletionEffects).not.toHaveBeenCalled();
  });
});
