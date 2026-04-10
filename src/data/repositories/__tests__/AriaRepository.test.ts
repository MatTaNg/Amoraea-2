jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

import type { AriaAnswerRecord } from '@domain/models/AriaSession';
import { supabase } from '@data/supabase/client';
import { AriaRepository } from '../AriaRepository';

const sampleAnswers: AriaAnswerRecord[] = [
  { pillarId: 'conflict_regulation_repair', usedFallback: false, answer: 'a' },
];

const sessionRow = {
  id: 's1',
  profile_id: 'p1',
  answers: sampleAnswers,
  created_at: '2024-01-01T00:00:00.000Z',
  updated_at: '2024-01-02T00:00:00.000Z',
};

describe('AriaRepository', () => {
  let repo: AriaRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new AriaRepository();
  });

  it('createSession maps insert result', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: sessionRow, error: null })),
        })),
      })),
    });

    const out = await repo.createSession('p1', sampleAnswers);
    expect(out.id).toBe('s1');
    expect(out.profileId).toBe('p1');
    expect(out.answers).toEqual(sessionRow.answers);
  });

  it('createSession throws on error', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() =>
            Promise.resolve({ data: null, error: { message: 'rls' } })
          ),
        })),
      })),
    });

    await expect(repo.createSession('p1', [])).rejects.toThrow(/Failed to create Aria session/);
  });

  it('getLatestSession returns mapped row', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: sessionRow, error: null })
              ),
            })),
          })),
        })),
      })),
    });

    const out = await repo.getLatestSession('p1');
    expect(out?.id).toBe('s1');
  });

  it('getLatestSession returns null when no row', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: null, error: null })
              ),
            })),
          })),
        })),
      })),
    });

    await expect(repo.getLatestSession('p1')).resolves.toBeNull();
  });

  it('getLatestSession throws on Supabase error', async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              maybeSingle: jest.fn(() =>
                Promise.resolve({ data: null, error: { message: 'db' } })
              ),
            })),
          })),
        })),
      })),
    });

    await expect(repo.getLatestSession('p1')).rejects.toThrow(/Failed to fetch Aria session/);
  });
});
