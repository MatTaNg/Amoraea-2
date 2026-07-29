import { QueryClient } from '@tanstack/react-query';

import { fetchLaunchWaitlistPassedCount } from '@features/onboarding/fetchLaunchWaitlistPassedCount';
import {
  fetchLaunchWaitlistScoreSummary,
  postInterviewLaunchQueryKeys,
  POST_INTERVIEW_LAUNCH_QUERY_STALE_MS,
} from '@features/onboarding/postInterviewLaunchQueries';

jest.mock('@features/onboarding/fetchLaunchWaitlistPassedCount', () => ({
  fetchLaunchWaitlistPassedCount: jest.fn(() => Promise.resolve(12)),
}));

jest.mock('@features/onboarding/loadInterviewReportAttempt', () => ({
  loadInterviewReportAttempt: jest.fn(() =>
    Promise.resolve({
      modified_weighted_score_with_psychometrics: 6.7,
    }),
  ),
}));

jest.mock('@features/onboarding/fetchLaunchWaitlistScoreAverages', () => ({
  fetchLaunchWaitlistScoreAverages: jest.fn(() =>
    Promise.resolve({
      cohortAverageFinalScore: 6.2,
      scoredUserCount: 12,
    }),
  ),
}));

describe('postInterviewLaunchQueries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses a long stale window for congrats-page queries', () => {
    expect(POST_INTERVIEW_LAUNCH_QUERY_STALE_MS).toBeGreaterThanOrEqual(5 * 60 * 1000);
  });

  it('reuses cached passed count without refetching while data is fresh', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const first = await queryClient.fetchQuery({
      queryKey: postInterviewLaunchQueryKeys.passedCount(),
      queryFn: fetchLaunchWaitlistPassedCount,
      staleTime: POST_INTERVIEW_LAUNCH_QUERY_STALE_MS,
    });
    const second = await queryClient.fetchQuery({
      queryKey: postInterviewLaunchQueryKeys.passedCount(),
      queryFn: fetchLaunchWaitlistPassedCount,
      staleTime: POST_INTERVIEW_LAUNCH_QUERY_STALE_MS,
    });

    expect(first).toBe(12);
    expect(second).toBe(12);
    expect(fetchLaunchWaitlistPassedCount).toHaveBeenCalledTimes(1);
  });

  it('builds score summary from attempt and cohort averages', async () => {
    await expect(fetchLaunchWaitlistScoreSummary('user-1')).resolves.toEqual({
      finalModifiedScore: 6.7,
      cohortAverageScore: 6.2,
    });
  });
});
