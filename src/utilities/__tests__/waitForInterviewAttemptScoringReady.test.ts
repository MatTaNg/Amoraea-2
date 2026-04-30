import { waitForInterviewAttemptScoringReady } from '../waitForInterviewAttemptScoringReady';
import type { SupabaseClient } from '@supabase/supabase-js';

function mockClient(rows: unknown[]) {
  let i = 0;
  return {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(async () => {
        const data = rows[Math.min(i, rows.length - 1)];
        i += 1;
        return { data, error: null };
      }),
    })),
  } as unknown as SupabaseClient;
}

describe('waitForInterviewAttemptScoringReady', () => {
  it('returns true when pillar_scores is meaningful and scenario slices are null (insert gaps)', async () => {
    const row = {
      completed_at: new Date().toISOString(),
      weighted_score: 6.2,
      pillar_scores: { commitment_threshold: 5, narrative: 6 },
      scenario_1_scores: null,
      scenario_2_scores: null,
      scenario_3_scores: null,
    };
    const client = mockClient([row]);
    const ok = await waitForInterviewAttemptScoringReady(client, 'attempt-1', {
      maxMs: 2_000,
      intervalMs: 10,
    });
    expect(ok).toBe(true);
  });

  it('returns true when scenario bundles use nested pillarScores', async () => {
    const row = {
      completed_at: new Date().toISOString(),
      weighted_score: 6,
      pillar_scores: { trust: 5 },
      scenario_1_scores: { pillarScores: { trust: 5 } },
      scenario_2_scores: { pillarScores: { trust: 5 } },
      scenario_3_scores: { pillarScores: { trust: 5 } },
    };
    const client = mockClient([row]);
    const ok = await waitForInterviewAttemptScoringReady(client, 'a', { maxMs: 500, intervalMs: 5 });
    expect(ok).toBe(true);
  });

  it('returns false before deadline when row never becomes ready', async () => {
    const client = mockClient([
      {
        completed_at: null,
        weighted_score: null,
        pillar_scores: null,
        scenario_1_scores: null,
        scenario_2_scores: null,
        scenario_3_scores: null,
      },
    ]);
    const ok = await waitForInterviewAttemptScoringReady(client, 'a', { maxMs: 80, intervalMs: 20 });
    expect(ok).toBe(false);
  });

  it('returns false immediately when attempt row is missing (no long poll)', async () => {
    const client = {
      from: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      })),
    } as unknown as SupabaseClient;
    const t0 = Date.now();
    const ok = await waitForInterviewAttemptScoringReady(client, 'deleted-attempt', { maxMs: 5000, intervalMs: 400 });
    expect(ok).toBe(false);
    expect(Date.now() - t0).toBeLessThan(800);
  });
});
