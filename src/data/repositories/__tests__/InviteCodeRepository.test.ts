jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
    auth: {
      getSession: jest.fn(),
    },
  },
}));

import { supabase } from '@data/supabase/client';
import { InviteCodeRepository } from '../InviteCodeRepository';

describe('InviteCodeRepository', () => {
  let repo: InviteCodeRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new InviteCodeRepository();
  });

  describe('findUserIdByCode', () => {
    it('returns null for blank code without calling rpc', async () => {
      await expect(repo.findUserIdByCode('   ')).resolves.toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('returns user id from rpc with trimmed code', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'uuid-1', error: null });
      await expect(repo.findUserIdByCode(' ABC123 ')).resolves.toBe('uuid-1');
      expect(supabase.rpc).toHaveBeenCalledWith('get_user_id_by_invite_code', {
        code: 'ABC123',
      });
    });

    it('returns null on rpc error', async () => {
      (supabase.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: 'not found' },
      });
      await expect(repo.findUserIdByCode('ABC123')).resolves.toBeNull();
    });
  });

  describe('ensureUserWithInviteCode', () => {
    it('returns existing user invite code without insert', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: { id: 'u1', invite_code: 'ZZZZZZ' },
                error: null,
              })
            ),
          })),
        })),
      });

      const r = await repo.ensureUserWithInviteCode('u1', {});
      expect(r.inviteCode).toBe('ZZZZZZ');
      expect(supabase.from).toHaveBeenCalledTimes(1);
    });

    it('inserts new user when none exists', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation((table: string) => {
        expect(table).toBe('users');
        fromCalls += 1;
        if (fromCalls === 1 || fromCalls === 2) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: null, error: null })
                ),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() => Promise.resolve({ error: null })),
        };
      });
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: { user: { id: 'u-new' } } },
      });

      const r = await repo.ensureUserWithInviteCode('u-new', { email: 'a@b.com' });
      expect(r.inviteCode).toHaveLength(6);
    });

    it('throws when insert fails', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1 || fromCalls === 2) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: null, error: null })
                ),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() =>
            Promise.resolve({ error: { message: 'duplicate', code: '42P01' } })
          ),
        };
      });
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      await expect(repo.ensureUserWithInviteCode('u-new', {})).rejects.toThrow(
        /Failed to create user/
      );
    });

    it('treats users_pkey race (23505) as success when row appears', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1 || fromCalls === 2) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: null, error: null })
                ),
              })),
            })),
          };
        }
        if (fromCalls === 3) {
          return {
            insert: jest.fn(() =>
              Promise.resolve({
                error: { message: 'duplicate key', code: '23505' },
              })
            ),
          };
        }
        return {
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({
                  data: { id: 'u-new', invite_code: 'ABCDEF' },
                  error: null,
                })
              ),
            })),
          })),
        };
      });
      (supabase.auth.getSession as jest.Mock).mockResolvedValue({
        data: { session: null },
      });

      const r = await repo.ensureUserWithInviteCode('u-new', {});
      expect(r.inviteCode).toBe('ABCDEF');
    });
  });
});
