import {
  syncValidationPartnerPair,
  type ValidationPartnerPairSyncResult,
} from '../relationshipValidationService';

jest.mock('@data/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

import { supabase } from '@data/supabase/client';

const mockRpc = supabase.rpc as jest.Mock;

describe('syncValidationPartnerPair', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('parses a confirmed mutual pair with both psychometrics complete', async () => {
    mockRpc.mockResolvedValue({
      data: {
        confirmed: true,
        partner_user_id: 'partner-1',
        self_comparison_id: 'self-comp-1',
        partner_comparison_id: 'partner-comp-1',
        self_psychometrics_complete: true,
        partner_psychometrics_complete: true,
        partner_complete: true,
      },
      error: null,
    });

    const result: ValidationPartnerPairSyncResult = await syncValidationPartnerPair('user-1');
    expect(result.confirmed).toBe(true);
    expect(result.partnerComplete).toBe(true);
    expect(result.partnerUserId).toBe('partner-1');
  });

  it('surfaces when the partner has not entered the caller email', async () => {
    mockRpc.mockResolvedValue({
      data: {
        confirmed: false,
        reason: 'partner_has_not_entered_your_email',
        partner_user_id: 'partner-1',
        self_comparison_id: 'self-comp-1',
      },
      error: null,
    });

    const result = await syncValidationPartnerPair('user-1');
    expect(result.confirmed).toBe(false);
    expect(result.reason).toBe('partner_has_not_entered_your_email');
  });
});
