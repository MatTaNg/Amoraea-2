import { fetchUserInterviewCompletionStatus } from '../interviewCompletionStatus';
import { resolveInitialInterviewRoute } from '../resolveInitialInterviewRoute';

jest.mock('../interviewCompletionStatus', () => ({
  ...jest.requireActual('../interviewCompletionStatus'),
  fetchUserInterviewCompletionStatus: jest.fn(),
}));

const mockFetchStatus = fetchUserInterviewCompletionStatus as jest.MockedFunction<
  typeof fetchUserInterviewCompletionStatus
>;

describe('resolveInitialInterviewRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requests market research when routing row is missing (new account bootstrap)', async () => {
    mockFetchStatus.mockResolvedValue({
      interviewCompleted: false,
      psychometricsCompletedAt: null,
      gateResultFinalizedAt: null,
      routingRow: null,
    });

    const result = await resolveInitialInterviewRoute('user-new');

    expect(result.needsMarketResearch).toBe(true);
  });

  it('requests market research when market_research_completed_at is null', async () => {
    mockFetchStatus.mockResolvedValue({
      interviewCompleted: false,
      psychometricsCompletedAt: null,
      gateResultFinalizedAt: null,
      routingRow: { market_research_completed_at: null },
    });

    const result = await resolveInitialInterviewRoute('user-new');

    expect(result.needsMarketResearch).toBe(true);
  });

  it('skips market research when already completed', async () => {
    mockFetchStatus.mockResolvedValue({
      interviewCompleted: false,
      psychometricsCompletedAt: null,
      gateResultFinalizedAt: null,
      routingRow: { market_research_completed_at: '2026-06-10T12:00:00Z' },
    });

    const result = await resolveInitialInterviewRoute('user-done');

    expect(result.needsMarketResearch).toBe(false);
  });
});
