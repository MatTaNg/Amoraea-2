import { describe, expect, it, jest } from '@jest/globals';

import { fetchLaunchWaitlistScoreAverages } from '@features/onboarding/fetchLaunchWaitlistScoreAverages';

jest.mock('@data/supabase/client', () => ({
  supabase: {
    rpc: jest.fn(),
  },
}));

describe('fetchLaunchWaitlistScoreAverages', () => {
  it('parses numeric strings from the RPC row', async () => {
    const { supabase } = require('@data/supabase/client') as {
      supabase: { rpc: jest.Mock };
    };
    supabase.rpc.mockResolvedValue({
      data: [{ cohort_average_final_score: '6.38', scored_user_count: '91' }],
      error: null,
    });

    await expect(fetchLaunchWaitlistScoreAverages()).resolves.toEqual({
      cohortAverageFinalScore: 6.38,
      scoredUserCount: 91,
    });
  });
});
