jest.mock('@utilities/interviewPassEffective', () => ({
  fetchInterviewPassAdminOverride: jest.fn(),
  interviewPassWhileScoringPending: jest.fn((override: boolean | null | undefined) =>
    override === true ? true : override === false ? false : null,
  ),
}));

import { fetchInterviewPassAdminOverride } from '@utilities/interviewPassEffective';
import { commitStandardOnboardingUsersAfterAttempt } from '../scoreInterviewOnboardingCommit';

describe('commitStandardOnboardingUsersAfterAttempt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetchInterviewPassAdminOverride as jest.Mock).mockResolvedValue(null);
  });

  it('updates users row with pending pass when gate ok and no admin override', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    const rpc = jest.fn(() => Promise.resolve({ error: null }));
    const supabase = {
      from: jest.fn(() => ({ update })),
      rpc,
    } as unknown as Parameters<typeof commitStandardOnboardingUsersAfterAttempt>[0];

    await commitStandardOnboardingUsersAfterAttempt(supabase, {
      userId: 'user-1',
      attemptIdForUserRow: 'attempt-9',
      gateOkForInterviewPassed: true,
      interviewAttemptCount: 2,
    });

    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        interview_completed: true,
        interview_passed: null,
        interview_passed_computed: null,
        interview_attempt_count: 2,
        latest_attempt_id: 'attempt-9',
        interview_completed_at: expect.any(String),
      }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('sets interview_passed false when gate not ok', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    const supabase = {
      from: jest.fn(() => ({ update })),
      rpc: jest.fn(() => Promise.resolve({ error: null })),
    } as unknown as Parameters<typeof commitStandardOnboardingUsersAfterAttempt>[0];

    await commitStandardOnboardingUsersAfterAttempt(supabase, {
      userId: 'user-2',
      attemptIdForUserRow: 'attempt-1',
      gateOkForInterviewPassed: false,
      interviewAttemptCount: 1,
    });

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ interview_passed: false }));
  });

  it('reads attempt_number when interviewAttemptCount omitted', async () => {
    const usersEq = jest.fn(() => Promise.resolve({ error: null }));
    const usersUpdate = jest.fn(() => ({ eq: usersEq }));
    const attemptsMaybeSingle = jest.fn(() => Promise.resolve({ data: { attempt_number: 3 }, error: null }));
    const attemptsEqUser = jest.fn(() => ({ maybeSingle: attemptsMaybeSingle }));
    const attemptsEqId = jest.fn(() => ({ eq: attemptsEqUser }));
    const attemptsSelect = jest.fn(() => ({ eq: attemptsEqId }));
    const supabase = {
      from: jest.fn((table: string) =>
        table === 'users'
          ? { update: usersUpdate }
          : { select: attemptsSelect },
      ),
      rpc: jest.fn(() => Promise.resolve({ error: null })),
    } as unknown as Parameters<typeof commitStandardOnboardingUsersAfterAttempt>[0];

    await commitStandardOnboardingUsersAfterAttempt(supabase, {
      userId: 'user-3',
      attemptIdForUserRow: 'attempt-3',
      gateOkForInterviewPassed: true,
    });

    expect(attemptsSelect).toHaveBeenCalledWith('attempt_number');
    expect(usersUpdate).toHaveBeenCalledWith(expect.objectContaining({ interview_attempt_count: 3 }));
  });
});
