jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@data/supabase/client';
import { updateUserInterviewApplication } from '../usersInterviewRepo';

describe('updateUserInterviewApplication', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps application fields and updates users', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    await updateUserInterviewApplication('user-1', {
      applicationStatus: 'approved',
      name: 'Alex',
      prompts: [{ promptId: 'p1', answer: 'Hi' }],
    });

    expect(supabase.from).toHaveBeenCalledWith('users');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        application_status: 'approved',
        name: 'Alex',
        display_name: 'Alex',
        profile_prompts: [{ promptId: 'p1', answer: 'Hi' }],
        updated_at: expect.any(String),
      }),
    );
    expect(eq).toHaveBeenCalledWith('id', 'user-1');
  });

  it('skips update when patch is empty', async () => {
    await updateUserInterviewApplication('user-1', {});
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('maps basicInfo onto users row', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: null }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    const basicInfo = { firstName: 'Jo', age: 25 };
    await updateUserInterviewApplication('user-1', { basicInfo });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        basic_info: basicInfo,
      }),
    );
  });

  it('throws when supabase returns an error', async () => {
    const eq = jest.fn(() => Promise.resolve({ error: { message: 'denied' } }));
    const update = jest.fn(() => ({ eq }));
    (supabase.from as jest.Mock).mockReturnValue({ update });

    await expect(
      updateUserInterviewApplication('user-1', { applicationStatus: 'pending' }),
    ).rejects.toThrow('Failed to update user application fields: denied');
  });
});
