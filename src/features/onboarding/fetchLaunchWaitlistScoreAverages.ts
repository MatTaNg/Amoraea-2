import { supabase } from '@data/supabase/client';

export type LaunchWaitlistScoreAverages = {
  cohortAverageFinalScore: number | null;
  scoredUserCount: number;
};

function parseRpcNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function parseRpcInteger(value: unknown): number {
  const parsed = parseRpcNumber(value);
  return parsed == null ? 0 : Math.max(0, Math.floor(parsed));
}

export async function fetchLaunchWaitlistScoreAverages(): Promise<LaunchWaitlistScoreAverages> {
  const { data, error } = await supabase.rpc('get_launch_waitlist_score_averages');
  if (error) {
    if (__DEV__) {
      console.warn('[LaunchWaitlist] failed to load score averages', error.message);
    }
    return { cohortAverageFinalScore: null, scoredUserCount: 0 };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== 'object') {
    return { cohortAverageFinalScore: null, scoredUserCount: 0 };
  }
  const record = row as Record<string, unknown>;
  return {
    cohortAverageFinalScore: parseRpcNumber(record.cohort_average_final_score),
    scoredUserCount: parseRpcInteger(record.scored_user_count),
  };
}
