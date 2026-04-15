import { remoteLog } from '../remoteLog';
import { supabase } from '@data/supabase/client';

jest.mock('@data/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
    },
    from: jest.fn(),
  },
}));

const getSessionMock = supabase.auth.getSession as jest.Mock;
const fromMock = supabase.from as jest.Mock;

describe('remoteLog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('inserts message, user_id from session, and data into debug_logs', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: { id: 'u-debug-1' } } },
    });
    const insert = jest.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await remoteLog('hello', { step: 2 });

    expect(fromMock).toHaveBeenCalledWith('debug_logs');
    expect(insert).toHaveBeenCalledWith({
      message: 'hello',
      user_id: 'u-debug-1',
      data: { step: 2 },
    });
  });

  it('passes null user_id when there is no session user', async () => {
    getSessionMock.mockResolvedValue({
      data: { session: { user: null } },
    });
    const insert = jest.fn().mockResolvedValue({ error: null });
    fromMock.mockReturnValue({ insert });

    await remoteLog('anon');

    expect(insert).toHaveBeenCalledWith({
      message: 'anon',
      user_id: null,
      data: {},
    });
  });
});
