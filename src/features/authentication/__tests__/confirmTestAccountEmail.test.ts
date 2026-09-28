import {
  confirmTestAccountEmailIfNeeded,
  isEmailNotConfirmedAuthError,
} from '../confirmTestAccountEmail';

const mockRpc = jest.fn();
const mockInvoke = jest.fn();

jest.mock('@data/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    functions: {
      invoke: (...args: unknown[]) => mockInvoke(...args),
    },
  },
}));

describe('confirmTestAccountEmailIfNeeded', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockInvoke.mockReset();
    mockRpc.mockResolvedValue({ error: null });
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
  });

  it('does not call rpc for other emails', async () => {
    await confirmTestAccountEmailIfNeeded('other@example.com', 'user-id');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('uses dev_auto_confirm_test_email rpc for mattang5280@gmail.com', async () => {
    await confirmTestAccountEmailIfNeeded('MattAng5280@Gmail.com', 'abc-123');
    expect(mockRpc).toHaveBeenCalledWith('dev_auto_confirm_test_email', {
      p_email: 'MattAng5280@Gmail.com',
      p_user_id: 'abc-123',
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('falls back to edge function when rpc is missing', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'function dev_auto_confirm_test_email does not exist' },
    });
    await confirmTestAccountEmailIfNeeded('mattang5280@gmail.com', 'abc-123');
    expect(mockInvoke).toHaveBeenCalledWith('dev-auto-confirm-test-email', {
      body: { email: 'mattang5280@gmail.com', userId: 'abc-123' },
    });
  });

  it('falls back to edge function when rpc hits generated confirmed_at column', async () => {
    mockRpc.mockResolvedValue({
      error: {
        message: 'column "confirmed_at" can only be updated to DEFAULT',
        code: '428C9',
      },
    });
    await confirmTestAccountEmailIfNeeded('mattang5280@gmail.com', 'abc-123');
    expect(mockInvoke).toHaveBeenCalledWith('dev-auto-confirm-test-email', {
      body: { email: 'mattang5280@gmail.com', userId: 'abc-123' },
    });
  });

  it('throws rpc errors that are not missing-function errors', async () => {
    mockRpc.mockResolvedValue({ error: { message: 'user not found' } });
    await expect(confirmTestAccountEmailIfNeeded('mattang5280@gmail.com')).rejects.toThrow(
      'user not found',
    );
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('throws when edge function returns an error payload', async () => {
    mockRpc.mockResolvedValue({
      error: { message: 'function dev_auto_confirm_test_email does not exist' },
    });
    mockInvoke.mockResolvedValue({ data: { error: 'User not found' }, error: null });
    await expect(confirmTestAccountEmailIfNeeded('mattang5280@gmail.com')).rejects.toThrow(
      'User not found',
    );
  });
});

describe('isEmailNotConfirmedAuthError', () => {
  it('detects email-not-confirmed auth errors', () => {
    expect(isEmailNotConfirmedAuthError(new Error('Email not confirmed'))).toBe(true);
    expect(isEmailNotConfirmedAuthError(new Error('Please confirm your email address'))).toBe(true);
    expect(isEmailNotConfirmedAuthError(new Error('Invalid login credentials'))).toBe(false);
  });
});
