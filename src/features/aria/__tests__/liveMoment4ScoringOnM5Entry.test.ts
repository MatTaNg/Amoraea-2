import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';

const mockFetchAttemptScoringBaseline = jest.fn();
const mockScoreAndPersistMoment4Slice = jest.fn();
const mockMoment4AggregateFromBaselinePatterns = jest.fn();

jest.mock('@data/supabase/client', () => ({
  supabase: {},
}));

jest.mock('@features/aria/anthropicClientConfig', () => ({
  ANTHROPIC_API_KEY: 'test-key',
  ANTHROPIC_PROXY_URL: '',
  getAnthropicEndpoint: () => 'https://example.test/v1/messages',
  buildAnthropicMessagesHeaders: () => ({ 'content-type': 'application/json' }),
}));

jest.mock('@utilities/persistPersonalMomentScoresIncremental', () => ({
  fetchAttemptScoringBaseline: (...args: unknown[]) => mockFetchAttemptScoringBaseline(...args),
}));

jest.mock('@features/aria/scoreAndPersistMoment4Slice', () => ({
  scoreAndPersistMoment4Slice: (...args: unknown[]) => mockScoreAndPersistMoment4Slice(...args),
  moment4AggregateFromBaselinePatterns: (...args: unknown[]) =>
    mockMoment4AggregateFromBaselinePatterns(...args),
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn().mockResolvedValue(undefined),
}));

import {
  clearLiveMoment4ScoringRegistry,
  triggerLiveMoment4ScoringOnM5Entry,
} from '@features/aria/liveMoment4ScoringOnM5Entry';

const M4_MESSAGES = [
  { role: 'assistant', content: 'Tell me about a time you held a grudge.', interviewMoment: 4 },
  {
    role: 'user',
    content: 'I held a grudge after my friend lied to me about practice.',
    interviewMoment: 4,
  },
  {
    role: 'assistant',
    content: 'At what point do you decide when a relationship is something to work through?',
    interviewMoment: 4,
  },
  { role: 'user', content: 'When trust is gone and repair feels impossible.', interviewMoment: 4 },
  {
    role: 'assistant',
    content: 'Tell me about a real conflict with someone important to you.',
    interviewMoment: 5,
  },
];

describe('triggerLiveMoment4ScoringOnM5Entry', () => {
  beforeEach(() => {
    clearLiveMoment4ScoringRegistry();
    mockFetchAttemptScoringBaseline.mockReset();
    mockScoreAndPersistMoment4Slice.mockReset();
    mockMoment4AggregateFromBaselinePatterns.mockReset();
    mockMoment4AggregateFromBaselinePatterns.mockReturnValue(null);
    mockFetchAttemptScoringBaseline.mockResolvedValue({
      patterns: {},
      moment_4_concreteness: null,
      moment_5_concreteness: null,
      ego_development_level: null,
      personal_moment_emotional_vocab_low: false,
      personal_moment_emotional_vocab_density: null,
      disclosure_calibration: null,
      defense_patterns: null,
      mentalizing_overcertainty_count: 0,
    });
    mockScoreAndPersistMoment4Slice.mockResolvedValue({
      moment4ForAggregate: { pillarScores: { accountability: 6 } },
      scoringBaseline: { patterns: {} },
      skippedNoUserTurns: false,
    });
  });

  afterEach(() => {
    clearLiveMoment4ScoringRegistry();
  });

  it('no-ops without attempt id', () => {
    triggerLiveMoment4ScoringOnM5Entry({
      trigger: 'test',
      userId: 'u1',
      isAdmin: false,
      attemptId: null,
      messages: M4_MESSAGES,
      deferredMoment4NarrativeRef: { current: null },
      moment4SpecificityScoringRef: { current: null },
    });
    expect(mockFetchAttemptScoringBaseline).not.toHaveBeenCalled();
  });

  it('scores once per attempt when called twice', async () => {
    const params = {
      trigger: 'test',
      userId: 'u1',
      isAdmin: false,
      attemptId: 'attempt-1',
      messages: M4_MESSAGES,
      deferredMoment4NarrativeRef: { current: null },
      moment4SpecificityScoringRef: { current: null },
    };
    triggerLiveMoment4ScoringOnM5Entry(params);
    triggerLiveMoment4ScoringOnM5Entry({ ...params, trigger: 'test-2' });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockFetchAttemptScoringBaseline).toHaveBeenCalledTimes(1);
    expect(mockScoreAndPersistMoment4Slice).toHaveBeenCalledTimes(1);
  });

  it('skips Claude when moment_4_scores already persisted', async () => {
    mockMoment4AggregateFromBaselinePatterns.mockReturnValue({
      pillarScores: { accountability: 7 },
    });
    triggerLiveMoment4ScoringOnM5Entry({
      trigger: 'test',
      userId: 'u1',
      isAdmin: false,
      attemptId: 'attempt-2',
      messages: M4_MESSAGES,
      deferredMoment4NarrativeRef: { current: null },
      moment4SpecificityScoringRef: { current: null },
    });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockScoreAndPersistMoment4Slice).not.toHaveBeenCalled();
  });
});
