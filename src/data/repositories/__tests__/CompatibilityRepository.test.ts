jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@data/supabase/client';
import { CompatibilityRepository } from '../CompatibilityRepository';

const compatRow = {
  id: 'c1',
  profile_id: 'user-1',
  compatibility_data: { attachment: 0.8 },
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
};

describe('CompatibilityRepository', () => {
  let repo: CompatibilityRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new CompatibilityRepository();
  });

  describe('getCompatibility', () => {
    it('maps a Supabase row to the domain model', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: compatRow, error: null })),
          })),
        })),
      });

      const r = await repo.getCompatibility('user-1');
      expect(r).not.toBeNull();
      expect(r!.id).toBe('c1');
      expect(r!.profileId).toBe('user-1');
      expect(r!.compatibilityData).toEqual({ attachment: 0.8 });
      expect(r!.createdAt).toBe(compatRow.created_at);
    });

    it('returns null when no row exists', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        })),
      });

      await expect(repo.getCompatibility('missing')).resolves.toBeNull();
    });

    it('throws when Supabase returns an error', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({ data: null, error: { message: 'permission denied' } })
            ),
          })),
        })),
      });

      await expect(repo.getCompatibility('user-1')).rejects.toThrow(/Failed to fetch compatibility/);
    });
  });

  describe('upsertCompatibility', () => {
    it('inserts when no existing compatibility row', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: compatRow, error: null })),
            })),
          })),
        };
      });

      const out = await repo.upsertCompatibility('user-1', {
        compatibilityData: { attachment: 0.8 },
      });
      expect(out.id).toBe('c1');
      expect(out.profileId).toBe('user-1');
    });

    it('updates when a row already exists', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: { id: 'c1' }, error: null })
                ),
              })),
            })),
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ data: compatRow, error: null })),
              })),
            })),
          })),
        };
      });

      const out = await repo.upsertCompatibility('user-1', {
        compatibilityData: { attachment: 0.8 },
      });
      expect(out.id).toBe('c1');
    });

    it('throws on insert error', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({ data: null, error: { message: 'duplicate key' } })
              ),
            })),
          })),
        };
      });

      await expect(
        repo.upsertCompatibility('user-1', { compatibilityData: {} })
      ).rejects.toThrow(/Failed to create compatibility/);
    });

    it('throws on update error', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(() =>
                  Promise.resolve({ data: { id: 'c1' }, error: null })
                ),
              })),
            })),
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({ data: null, error: { message: 'timeout' } })
                ),
              })),
            })),
          })),
        };
      });

      await expect(
        repo.upsertCompatibility('user-1', { compatibilityData: {} })
      ).rejects.toThrow(/Failed to update compatibility/);
    });
  });
});
