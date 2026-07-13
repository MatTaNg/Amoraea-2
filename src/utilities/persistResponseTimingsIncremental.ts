import type { MutableRefObject } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { remoteLog } from '@utilities/remoteLog';

export type InterviewResponseTimingEntry = {
  question_id: string;
  scenario: number | null;
  question_text: string;
  latency_ms: number;
  duration_ms: number;
  word_count: number;
};

function normalizeResponseTimings(
  value: unknown,
): InterviewResponseTimingEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row): row is InterviewResponseTimingEntry =>
      row != null &&
      typeof row === 'object' &&
      typeof (row as InterviewResponseTimingEntry).question_id === 'string',
  );
}

/** Prefer in-session ref when it has caught up; otherwise keep DB rows from incremental writes. */
export function resolveResponseTimingsForPersist(
  clientTimings: InterviewResponseTimingEntry[] | null | undefined,
  existingDbTimings: InterviewResponseTimingEntry[] | null | undefined,
): InterviewResponseTimingEntry[] | null {
  const client = normalizeResponseTimings(clientTimings);
  const db = normalizeResponseTimings(existingDbTimings);
  if (client.length === 0 && db.length === 0) return null;
  if (client.length === 0) return db;
  if (db.length === 0) return client;
  return client.length >= db.length ? client : db;
}

export async function persistResponseTimingsToAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  timings: InterviewResponseTimingEntry[],
): Promise<void> {
  if (!attemptId || !userId || timings.length === 0) return;
  try {
    const { error } = await supabase
      .from('interview_attempts')
      .update({ response_timings: timings })
      .eq('id', attemptId)
      .eq('user_id', userId);
    if (error) throw error;
  } catch (err) {
    console.error(`[Amoraea] Timing write failed for attempt ${attemptId}:`, err);
    void remoteLog('[Amoraea] response_timings persist failed', {
      attemptId,
      message: err instanceof Error ? err.message : String(err),
      timingCount: timings.length,
    });
  }
}

export async function hydrateResponseTimingsRefFromAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  responseTimingsRef: MutableRefObject<InterviewResponseTimingEntry[]>,
): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('interview_attempts')
      .select('response_timings')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    const merged = resolveResponseTimingsForPersist(
      responseTimingsRef.current,
      normalizeResponseTimings(data?.response_timings),
    );
    if (merged) {
      responseTimingsRef.current = merged;
    }
  } catch (err) {
    console.error(`[Amoraea] hydrate response_timings failed for attempt ${attemptId}:`, err);
  }
}
