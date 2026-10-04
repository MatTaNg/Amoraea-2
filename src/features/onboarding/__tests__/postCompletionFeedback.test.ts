jest.mock('@data/supabase/client', () => ({
  supabase: { from: jest.fn() },
}));

jest.mock('@features/psychometrics/interviewCompletionStatus', () => ({
  fetchMostRecentCompletedInterviewAttemptId: jest.fn(() => Promise.resolve('attempt-9')),
}));

import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import {
  POST_COMPLETION_FEEDBACK_CATEGORY,
  POST_COMPLETION_FEEDBACK_PAGE_CONTEXT,
  POST_COMPLETION_SCENARIO_OPTIONS,
  buildPostCompletionFeedbackResponse,
  emptyPostCompletionFeedbackDraft,
  submitPostCompletionFeedback,
} from '../postCompletionFeedback';

describe('postCompletionFeedback', () => {
  const submittedAt = '2026-10-03T12:00:00.000Z';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a payload that keeps blank questions distinct from answered ones', () => {
    const response = buildPostCompletionFeedbackResponse(
      emptyPostCompletionFeedbackDraft(),
      'intro',
      submittedAt,
    );

    expect(response.kind).toBe('post_completion_v1');
    expect(response.questions.fatigue).toEqual({
      prompt: expect.any(String),
      selected: [],
      freeform: null,
      answered: false,
    });
    expect(response.questions.trust).toEqual({
      prompt: expect.any(String),
      value: null,
      answered: false,
    });
    expect(response.questions.missedDimensions.answered).toBe(false);
    expect(response.questions.bugs.answered).toBe(false);
    expect(response.questions.anythingElse.answered).toBe(false);
  });

  it('captures one selection and a single 1-10 score', () => {
    const draft = emptyPostCompletionFeedbackDraft();
    draft.fatigue.selected = [POST_COMPLETION_SCENARIO_OPTIONS[0]];
    draft.redundant.selected = [POST_COMPLETION_SCENARIO_OPTIONS[1]];
    draft.trust = 8;
    draft.difficulty = 3;

    const response = buildPostCompletionFeedbackResponse(draft, 'congrats', submittedAt);

    expect(response.questions.fatigue.answered).toBe(true);
    expect(response.questions.fatigue.selected).toEqual([POST_COMPLETION_SCENARIO_OPTIONS[0]]);
    expect(response.questions.fatigue.freeform).toBeNull();
    expect(response.questions.redundant.selected).toEqual([POST_COMPLETION_SCENARIO_OPTIONS[1]]);
    expect(response.questions.redundant.freeform).toBeNull();
    expect(response.questions.trust).toMatchObject({ value: 8, answered: true });
    expect(response.questions.difficulty).toMatchObject({ value: 3, answered: true });
    expect(response.questions.redundant.answered).toBe(true);
  });

  it('inserts an all-blank submission and sets the user flag only from submit', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'interview_feedback') return { insert };
      if (table === 'users') return { update };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await submitPostCompletionFeedback({
      userId: 'user-1',
      entryPoint: 'intro',
      draft: emptyPostCompletionFeedbackDraft(),
      submittedAt,
    });

    expect(result).toEqual({ error: null });
    expect(fetchMostRecentCompletedInterviewAttemptId).toHaveBeenCalledWith('user-1');
    expect(supabase.from).toHaveBeenCalledWith('interview_feedback');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt_id: 'attempt-9',
        user_id: 'user-1',
        category: POST_COMPLETION_FEEDBACK_CATEGORY,
        page_context: POST_COMPLETION_FEEDBACK_PAGE_CONTEXT,
        rating: null,
        message: expect.stringContaining('Fatigue: (blank)'),
        response: expect.objectContaining({
          kind: 'post_completion_v1',
          submittedAt,
          entryPoint: 'intro',
        }),
      }),
    );
    expect(update).toHaveBeenCalledWith({ post_completion_feedback_submitted_at: submittedAt });
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('does not set the user flag when the feedback insert fails', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: { message: 'denied' } }));
    const update = jest.fn();
    (supabase.from as jest.Mock).mockImplementation((table: string) => {
      if (table === 'interview_feedback') return { insert };
      if (table === 'users') return { update };
      throw new Error(`unexpected table ${table}`);
    });

    const result = await submitPostCompletionFeedback({
      userId: 'user-1',
      entryPoint: 'congrats',
      draft: emptyPostCompletionFeedbackDraft(),
      submittedAt,
    });

    expect(result).toEqual({ error: 'denied' });
    expect(update).not.toHaveBeenCalled();
  });
});
