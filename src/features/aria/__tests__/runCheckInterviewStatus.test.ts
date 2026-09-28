import { runCheckInterviewStatus } from '@features/aria/runCheckInterviewStatus';
import type { CheckInterviewStatusDeps } from '@features/aria/checkInterviewStatusTypes';

function buildDeps(overrides: Partial<CheckInterviewStatusDeps> = {}): CheckInterviewStatusDeps {
  const interviewStatusRef = { current: 'not_started' };
  const statusRef = { current: 'intro' };
  const resumeLoadingFlowActiveRef = { current: false };
  const hasResumedRef = { current: false };
  return {
    supabase: {
      auth: { getSession: jest.fn(async () => ({ data: { session: { user: { email: 'u@test.com' } } } })) },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(async () => ({
              data: { interview_completed: false, latest_attempt_id: null },
              error: null,
            })),
          })),
        })),
      })),
    } as unknown as CheckInterviewStatusDeps['supabase'],
    navigation: {},
    interviewStatusRef,
    isInterviewCompleteRef: { current: false },
    statusRef,
    resumeLoadingFlowActiveRef,
    hasResumedRef,
    interviewSessionIdRef: { current: 'session-1' },
    userInterviewRoutingTable: 'users',
    userInterviewPassSelect: 'interview_completed, latest_attempt_id',
    isAmoraeaAdminConsoleEmail: () => false,
    resolveInterviewCompletedForUser: jest.fn(async () => false),
    takeInterviewJustCompletedInSession: () => false,
    takeInterviewLastCommittedAttemptId: () => null,
    hasPreparingResultsSession: () => false,
    markPreparingResultsSession: jest.fn(),
    clearPreparingResultsSession: jest.fn(),
    waitForInterviewAttemptScoringReady: jest.fn(),
    clearInterviewFromStorage: jest.fn(),
    replaceWithStandardApplicantPostInterviewHandoffForUser: jest.fn(),
    setInterviewStatus: jest.fn((value) => {
      interviewStatusRef.current = typeof value === 'function' ? value(interviewStatusRef.current) : value;
    }),
    setAnalysisAttemptId: jest.fn(),
    setPendingScoringSyncAttemptId: jest.fn(),
    remoteLog: jest.fn(),
    ...overrides,
  };
}

describe('runCheckInterviewStatus', () => {
  it('does not reset to not_started while resume hydration is in flight', async () => {
    const deps = buildDeps();
    deps.resumeLoadingFlowActiveRef!.current = true;
    await runCheckInterviewStatus(deps, {
      userId: 'user-1',
      userEmail: 'u@test.com',
      isInterviewAppRoute: true,
      preparingHandoffPollTick: 0,
    });
    expect(deps.setInterviewStatus).not.toHaveBeenCalled();
  });

  it('does not reset to not_started while interviewStatus is still loading', async () => {
    const deps = buildDeps();
    deps.interviewStatusRef.current = 'loading';
    await runCheckInterviewStatus(deps, {
      userId: 'user-1',
      userEmail: 'u@test.com',
      isInterviewAppRoute: true,
      preparingHandoffPollTick: 0,
    });
    expect(deps.setInterviewStatus).not.toHaveBeenCalled();
  });

  it('does not reset to not_started after resume commits in_progress', async () => {
    const deps = buildDeps();
    deps.interviewStatusRef.current = 'in_progress';
    deps.statusRef.current = 'active';
    await runCheckInterviewStatus(deps, {
      userId: 'user-1',
      userEmail: 'u@test.com',
      isInterviewAppRoute: true,
      preparingHandoffPollTick: 0,
    });
    expect(deps.setInterviewStatus).not.toHaveBeenCalled();
  });

  it('hands standard applicants off after in-session completion instead of the admin results screen', async () => {
    const deps = buildDeps({
      takeInterviewJustCompletedInSession: () => true,
      takeInterviewLastCommittedAttemptId: () => 'attempt-1',
      waitForInterviewAttemptScoringReady: jest.fn(async () => true),
    });
    await runCheckInterviewStatus(deps, {
      userId: 'user-1',
      userEmail: 'u@test.com',
      isInterviewAppRoute: true,
      preparingHandoffPollTick: 0,
    });
    expect(deps.setInterviewStatus).toHaveBeenCalledWith('preparing_results');
    expect(deps.setInterviewStatus).not.toHaveBeenCalledWith('congratulations');
    expect(deps.replaceWithStandardApplicantPostInterviewHandoffForUser).toHaveBeenCalled();
  });

  it('does not open the admin results screen when an admin just finished in-session', async () => {
    const deps = buildDeps({
      isAmoraeaAdminConsoleEmail: () => true,
      takeInterviewJustCompletedInSession: () => true,
      takeInterviewLastCommittedAttemptId: () => 'attempt-1',
    });
    await runCheckInterviewStatus(deps, {
      userId: 'user-1',
      userEmail: 'admin@test.com',
      isInterviewAppRoute: true,
      preparingHandoffPollTick: 0,
    });
    expect(deps.setInterviewStatus).toHaveBeenCalledWith('preparing_results');
    expect(deps.setInterviewStatus).not.toHaveBeenCalledWith('congratulations');
    expect(deps.replaceWithStandardApplicantPostInterviewHandoffForUser).not.toHaveBeenCalled();
  });
});
