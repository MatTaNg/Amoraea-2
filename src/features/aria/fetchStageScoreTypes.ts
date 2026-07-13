import type { InterviewResults } from '@features/aria/interviewResultsTypes';

export type FetchStageScoreDeps = {
  typologyContext: string | null | undefined;
};

export type FetchStageScoreParams = {
  finalMessages: Array<{ role: string; content: string }>;
};

export type FetchStageScoreFn = (
  finalMessages: Array<{ role: string; content: string }>,
) => Promise<InterviewResults>;
