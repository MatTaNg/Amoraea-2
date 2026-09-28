import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { resolveHybridMetaCommentLlmRefinement } from '@features/aria/resolveHybridMetaCommentLlmRefinement';
import type { ResolvedMetaComment } from '@features/aria/metaCommentClassificationTypes';
import { fetchInterviewMetaCommentFromLlm } from '@features/aria/fetchInterviewMetaCommentFromLlm';

jest.mock('@features/aria/fetchInterviewMetaCommentFromLlm', () => ({
  ...jest.requireActual<typeof import('@features/aria/fetchInterviewMetaCommentFromLlm')>(
    '@features/aria/fetchInterviewMetaCommentFromLlm',
  ),
  fetchInterviewMetaCommentFromLlm: jest.fn(),
}));

const mockedFetch = jest.mocked(fetchInterviewMetaCommentFromLlm);

function resolution(
  overrides: Partial<ResolvedMetaComment> &
    Pick<ResolvedMetaComment, 'raw' | 'effective'>,
): ResolvedMetaComment {
  return {
    exemptMetaCommentTurn: false,
    exemptMetaCommentTurnReason: 'no_exemption_condition_met',
    ...overrides,
  };
}

describe('resolveHybridMetaCommentLlmRefinement', () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it('returns heuristic unchanged when LLM is not awaited', async () => {
    const heuristic = resolution({
      raw: { type: 'frustration', confidence: 0.95 },
      effective: { type: 'frustration', confidence: 0.95 },
    });
    const result = await resolveHybridMetaCommentLlmRefinement({
      trimmed: 'this is ridiculous',
      activeQuestionPreview: 'What would you do?',
      metaResolved: heuristic,
      micStopTelemetry: null,
      interviewSessionId: 'sess-1',
    });
    expect(result).toEqual(heuristic);
    expect(mockedFetch).not.toHaveBeenCalled();
  });

  it('merges LLM inability for ambiguous short reply', async () => {
    mockedFetch.mockResolvedValue({
      metaType: 'inability',
      confidence: 0.91,
      reason: 'Explicit inability',
    });
    const heuristic = resolution({
      raw: { type: 'ambiguous_short', confidence: 0.35 },
      effective: { type: 'ambiguous_short', confidence: 0.35 },
    });
    const result = await resolveHybridMetaCommentLlmRefinement({
      trimmed: 'uh hmm okay',
      activeQuestionPreview: 'How would Ryan feel?',
      metaResolved: heuristic,
      micStopTelemetry: null,
      interviewSessionId: 'sess-2',
    });
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(result.effective?.type).toBe('inability');
  });

  it('returns heuristic when LLM fetch fails', async () => {
    mockedFetch.mockRejectedValue(new Error('timeout'));
    const heuristic = resolution({
      raw: { type: 'ambiguous_short', confidence: 0.35 },
      effective: { type: 'ambiguous_short', confidence: 0.35 },
    });
    const result = await resolveHybridMetaCommentLlmRefinement({
      trimmed: 'uh hmm okay',
      activeQuestionPreview: 'What would you do?',
      metaResolved: heuristic,
      micStopTelemetry: null,
      interviewSessionId: 'sess-3',
    });
    expect(result).toEqual(heuristic);
  });
});
