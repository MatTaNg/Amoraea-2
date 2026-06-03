jest.mock('@data/services/submitInterviewFeedback', () => ({
  submitInterviewFeedback: jest.fn(() => Promise.resolve({ error: null })),
}));

import { submitInterviewFeedback } from '@data/services/submitInterviewFeedback';
import { FEEDBACK_CATEGORY_FEATURE_REQUEST } from '../../../../../shared/constants/feedbackCategories';
import {
  formatLifeDomainQuestionSuggestionMessage,
  submitLifeDomainQuestionSuggestion,
} from '../lifeDomainQuestionSuggestion';

describe('lifeDomainQuestionSuggestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('formats message with domain label and trimmed suggestion', () => {
    const msg = formatLifeDomainQuestionSuggestionMessage('finance', '  Ask about debt goals  ');
    expect(msg).toContain('[Life domain: Finances / Business / Career]');
    expect(msg).toContain('Question suggestion:\nAsk about debt goals');
  });

  it('skips submit when suggestion is blank', async () => {
    const res = await submitLifeDomainQuestionSuggestion('u1', 'health', '   ');
    expect(res).toEqual({ error: null });
    expect(submitInterviewFeedback).not.toHaveBeenCalled();
  });

  it('submits as Feature request with life-domain page context', async () => {
    await submitLifeDomainQuestionSuggestion('u1', 'spirituality', 'Ask about prayer routines');

    expect(submitInterviewFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u1',
        category: FEEDBACK_CATEGORY_FEATURE_REQUEST,
        pageContext: 'life_domain_questions:spirituality',
      }),
    );
    expect((submitInterviewFeedback as jest.Mock).mock.calls[0][0].message).toContain(
      'Ask about prayer routines',
    );
  });
});
