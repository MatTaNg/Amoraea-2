import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('@features/interview/finalizeInterviewAttemptForRouting', () => ({
  ...jest.requireActual('@features/interview/finalizeInterviewAttemptForRouting'),
  finalizeInterviewAttemptForRouting: jest.fn(),
  reconcileUnfinalizedInterviewAttemptForUser: jest.fn(),
}));

import { supabase } from '@data/supabase/client';
import {
  finalizeInterviewAttemptForRouting,
  reconcileUnfinalizedInterviewAttemptForUser,
} from '@features/interview/finalizeInterviewAttemptForRouting';
import { resolveInterviewCompletedForUser } from '../interviewCompletionStatus';

const mockFinalize = finalizeInterviewAttemptForRouting as jest.MockedFunction<
  typeof finalizeInterviewAttemptForRouting
>;
const mockReconcile = reconcileUnfinalizedInterviewAttemptForUser as jest.MockedFunction<
  typeof reconcileUnfinalizedInterviewAttemptForUser
>;

function mockAttemptSelect(row: Record<string, unknown> | null) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: row, error: null }),
  };
  (supabase.from as jest.Mock).mockReturnValue(chain);
  return chain;
}

describe('resolveInterviewCompletedForUser', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReconcile.mockResolvedValue(false);
  });

  it('returns true when users.interview_completed is already set', async () => {
    const result = await resolveInterviewCompletedForUser('user-1', {
      interview_completed: true,
      latest_attempt_id: 'attempt-1',
    });
    expect(result).toBe(true);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('reconciles unfinalized finished attempt on latest_attempt_id', async () => {
    mockAttemptSelect({
      completed_at: null,
      transcript: [
        {
          role: 'user',
          content:
            'I had a conflict with my friend and we talked it through after a retreat and listened to each other until we understood where each person was coming from even though we still disagree on some points.',
          interviewMoment: 5,
        },
      ],
      scenario_1_scores: { pillarScores: { repair: 5 } },
      scenario_2_scores: { pillarScores: { repair: 5 } },
      scenario_3_scores: { pillarScores: { repair: 5 } },
    });
    mockFinalize.mockResolvedValue(true);

    const result = await resolveInterviewCompletedForUser('user-1', {
      interview_completed: false,
      latest_attempt_id: 'attempt-1',
    });

    expect(result).toBe(true);
    expect(mockFinalize).toHaveBeenCalledWith('user-1', 'attempt-1');
  });

  it('falls back to reconcileUnfinalizedInterviewAttemptForUser when latest attempt is still open', async () => {
    mockAttemptSelect({ completed_at: null, transcript: [] });
    mockReconcile.mockResolvedValue(true);

    const result = await resolveInterviewCompletedForUser('user-1', {
      interview_completed: false,
      latest_attempt_id: 'attempt-1',
    });

    expect(result).toBe(true);
    expect(mockReconcile).toHaveBeenCalledWith('user-1');
  });
});
