import {
  clearInterviewResumeHandle,
  isInterviewResumeHandleActive,
  runCoalescedInterviewResume,
} from '../interviewResumeHandleCoordinator';

describe('interviewResumeHandleCoordinator', () => {
  const userId = 'user-1';

  beforeEach(() => {
    clearInterviewResumeHandle(userId);
  });

  it('coalesces concurrent resume runs for the same user', async () => {
    let runs = 0;
    const first = runCoalescedInterviewResume(userId, async () => {
      runs += 1;
      await new Promise((r) => setTimeout(r, 20));
    });
    const second = runCoalescedInterviewResume(userId, async () => {
      runs += 1;
    });
    await Promise.all([first, second]);
    expect(runs).toBe(1);
    expect(isInterviewResumeHandleActive(userId)).toBe(false);
  });

  it('clearInterviewResumeHandle allows a new resume attempt', async () => {
    let runs = 0;
    await runCoalescedInterviewResume(userId, async () => {
      runs += 1;
    });
    clearInterviewResumeHandle(userId);
    await runCoalescedInterviewResume(userId, async () => {
      runs += 1;
    });
    expect(runs).toBe(2);
  });
});
