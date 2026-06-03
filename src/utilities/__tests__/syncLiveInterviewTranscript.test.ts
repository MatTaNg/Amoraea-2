import type { SupabaseClient } from '@supabase/supabase-js';
import { syncLiveInterviewTranscriptToAttempt } from '../syncLiveInterviewTranscript';

describe('syncLiveInterviewTranscriptToAttempt', () => {
  const transcript = [{ role: 'user', content: 'Hi' }];

  function buildClient(error: { message: string } | null = null) {
    const eqUser = jest.fn(() => Promise.resolve({ error }));
    const eqId = jest.fn(() => ({ eq: eqUser }));
    const update = jest.fn(() => ({ eq: eqId }));
    const from = jest.fn(() => ({ update }));
    const supabase = { from } as unknown as SupabaseClient;
    return { supabase, from, update, eqId, eqUser };
  }

  it('updates interview_attempts.transcript for the attempt and user', async () => {
    const { supabase, from, update, eqId, eqUser } = buildClient();
    await syncLiveInterviewTranscriptToAttempt(supabase, {
      attemptId: 'attempt-1',
      userId: 'user-1',
      transcript,
    });

    expect(from).toHaveBeenCalledWith('interview_attempts');
    expect(update).toHaveBeenCalledWith({ transcript });
    expect(eqId).toHaveBeenCalledWith('id', 'attempt-1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('includes resume_active_scenario when provided', async () => {
    const { supabase, update } = buildClient();
    await syncLiveInterviewTranscriptToAttempt(supabase, {
      attemptId: 'attempt-1',
      userId: 'user-1',
      transcript,
      resumeActiveScenario: 2,
    });

    expect(update).toHaveBeenCalledWith({
      transcript,
      resume_active_scenario: 2,
    });
  });

  it('does not throw when supabase returns an error', async () => {
    const { supabase } = buildClient({ message: 'RLS denied' });
    await expect(
      syncLiveInterviewTranscriptToAttempt(supabase, {
        attemptId: 'a',
        userId: 'u',
        transcript: [],
      }),
    ).resolves.toBeUndefined();
  });
});
