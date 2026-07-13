import { describe, expect, it } from '@jest/globals';

import { buildInterviewCompletionScoringSyncExtra } from '@features/aria/buildInterviewCompletionScoringSyncExtra';

describe('buildInterviewCompletionScoringSyncExtra', () => {
  it('preserves scoring refs from the merged sync context', () => {
    const scenarioScoresRef = { current: { 1: { pillarScores: {} } } };
    const scenarioSkipConfirmedCountRef = { current: 2 };
    const interviewSessionIdRef = { current: 'session-abc' };
    const interviewSessionAttemptIdRef = { current: 'attempt-xyz' };
    const scoreInterviewInFlightRef = { current: false };

    const merged = buildInterviewCompletionScoringSyncExtra({
      userId: 'user-1',
      isAdmin: false,
      typologyContext: 'ctx',
      routeName: 'Amoraea',
      ensureValidSession: async () => {},
      scenarioScoresRef,
      scenarioSkipConfirmedCountRef,
      interviewSessionIdRef,
      interviewSessionAttemptIdRef,
      scoreInterviewInFlightRef,
      parallelStreamingTtsRef: { current: {} },
      kickCompletionScoring: () => false,
    });

    expect(merged.scenarioScoresRef).toBe(scenarioScoresRef);
    expect(merged.scenarioSkipConfirmedCountRef).toBe(scenarioSkipConfirmedCountRef);
    expect(merged.interviewSessionIdRef).toBe(interviewSessionIdRef);
    expect(merged.interviewSessionAttemptIdRef).toBe(interviewSessionAttemptIdRef);
    expect(merged.scoreInterviewInFlightRef).toBe(scoreInterviewInFlightRef);
    expect(merged.parallelStreamingTtsRef).toEqual({ current: {} });
    expect(merged.kickCompletionScoring).toEqual(expect.any(Function));
  });
});
