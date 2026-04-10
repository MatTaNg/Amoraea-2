jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import { supabase } from '@data/supabase/client';
import { TypologyRepository } from '../TypologyRepository';

const typologyRow = {
  id: 't1',
  profile_id: 'user-1',
  typology_type: 'big_five',
  typology_data: { o: 4 },
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
};

describe('TypologyRepository', () => {
  let repo: TypologyRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new TypologyRepository();
  });

  describe('getTypology', () => {
    it('maps row to domain', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: typologyRow, error: null })
              ),
            })),
          })),
        })),
      });

      const t = await repo.getTypology('user-1', 'big_five');
      expect(t?.typologyType).toBe('big_five');
      expect(t?.typologyData).toEqual({ o: 4 });
    });

    it('returns null when missing', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: null, error: null })
              ),
            })),
          })),
        })),
      });

      await expect(repo.getTypology('user-1', 'big_five')).resolves.toBeNull();
    });

    it('throws on error', async () => {
      (supabase.from as jest.Mock).mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: null, error: { message: 'x' } })
              ),
            })),
          })),
        })),
      });

      await expect(repo.getTypology('user-1', 'big_five')).rejects.toThrow(
        /Failed to fetch typology/
      );
    });
  });

  describe('upsertTypology', () => {
    it('updates when row exists', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn(() =>
                    Promise.resolve({ data: { id: 't1' }, error: null })
                  ),
                })),
              })),
            })),
          };
        }
        return {
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => ({
                single: jest.fn(() =>
                  Promise.resolve({ data: typologyRow, error: null })
                ),
              })),
            })),
          })),
        };
      });

      const t = await repo.upsertTypology('user-1', 'big_five', {
        typologyData: { o: 5 },
      });
      expect(t.id).toBe('t1');
    });

    it('inserts when no row', async () => {
      const insertedRow = { ...typologyRow, typology_type: 'attachment_style' };
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn(() =>
                    Promise.resolve({ data: null, error: null })
                  ),
                })),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({ data: insertedRow, error: null })
              ),
            })),
          })),
        };
      });

      const t = await repo.upsertTypology('user-1', 'attachment_style', {
        typologyData: {},
      });
      expect(t.typologyType).toBe('attachment_style');
    });

    it('throws on insert failure', async () => {
      let fromCalls = 0;
      (supabase.from as jest.Mock).mockImplementation(() => {
        fromCalls += 1;
        if (fromCalls === 1) {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                eq: jest.fn(() => ({
                  maybeSingle: jest.fn(() =>
                    Promise.resolve({ data: null, error: null })
                  ),
                })),
              })),
            })),
          };
        }
        return {
          insert: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn(() =>
                Promise.resolve({ data: null, error: { message: 'dup' } })
              ),
            })),
          })),
        };
      });

      await expect(
        repo.upsertTypology('user-1', 'big_five', { typologyData: {} })
      ).rejects.toThrow(/Failed to create typology/);
    });
  });
});
