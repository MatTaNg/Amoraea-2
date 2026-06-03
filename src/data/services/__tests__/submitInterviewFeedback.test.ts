jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@data/supabase/client';
import { submitInterviewFeedback } from '../submitInterviewFeedback';

describe('submitInterviewFeedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does nothing for blank message', async () => {
    const res = await submitInterviewFeedback({
      userId: 'u1',
      category: 'Feature request',
      message: '   ',
    });

    expect(res).toEqual({ error: null });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('inserts trimmed payload and returns null error', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: null }));
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    const res = await submitInterviewFeedback({
      userId: 'u1',
      attemptId: 'a1',
      category: 'Feature request',
      message: '  Add more life-domain prompts  ',
      rating: 5,
      pageContext: 'life_domain_questions:finance',
    });

    expect(supabase.from).toHaveBeenCalledWith('interview_feedback');
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        attempt_id: 'a1',
        user_id: 'u1',
        category: 'Feature request',
        message: 'Add more life-domain prompts',
        rating: 5,
        page_context: 'life_domain_questions:finance',
      }),
    );
    expect(res).toEqual({ error: null });
  });

  it('returns Supabase error message when insert fails', async () => {
    const insert = jest.fn(() => Promise.resolve({ error: { message: 'denied' } }));
    (supabase.from as jest.Mock).mockReturnValue({ insert });

    const res = await submitInterviewFeedback({
      userId: 'u1',
      category: 'Feature request',
      message: 'Need better options',
    });

    expect(res).toEqual({ error: 'denied' });
  });
});
