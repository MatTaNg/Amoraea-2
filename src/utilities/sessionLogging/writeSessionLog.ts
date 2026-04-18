/**
 * Non-blocking inserts into `session_logs`. One automatic retry; failures are console-only.
 */
import { supabase } from '@data/supabase/client';
import { getSessionLogRuntime } from './sessionLogContext';

export type SessionPlatform = 'ios' | 'android' | 'web';

export type SessionLogInsert = {
  userId: string;
  attemptId: string | null;
  eventType: string;
  eventData: Record<string, unknown>;
  durationMs?: number | null;
  error?: string | null;
  platform: SessionPlatform | null;
};

/** Must not be named `__DEV__` — that shadows the Metro global and throws TDZ ("before initialization"). */
const isDevBundle = typeof __DEV__ !== 'undefined' && __DEV__;

async function insertOnce(row: SessionLogInsert): Promise<{ error: Error | null }> {
  try {
    const { error } = await supabase.from('session_logs').insert({
      user_id: row.userId,
      attempt_id: row.attemptId,
      event_type: row.eventType,
      event_data: row.eventData,
      duration_ms: row.durationMs ?? null,
      error: row.error ?? null,
      platform: row.platform,
    });
    if (error) {
      return { error: new Error(error.message) };
    }
    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e : new Error(String(e)) };
  }
}

/** Fire-and-forget. Retries once on failure. Never throws to callers. */
export function writeSessionLog(row: SessionLogInsert): void {
  const ctx = getSessionLogRuntime();
  if (
    isDevBundle &&
    ctx.sessionLogsRequireAttemptId &&
    row.attemptId == null &&
    row.userId &&
    row.eventType !== 'build_version'
  ) {
    console.error(
      '[session_logs] attempt_id is null after session initialization — event orphaned:',
      row.eventType,
      { eventDataKeys: Object.keys(row.eventData ?? {}) }
    );
  }
  void (async () => {
    const first = await insertOnce(row);
    if (!first.error) return;
    if (isDevBundle) {
      console.warn('[session_logs] insert failed, retrying once:', first.error.message);
    }
    const second = await insertOnce(row);
    if (second.error && isDevBundle) {
      console.warn('[session_logs] insert failed after retry:', second.error.message);
    }
  })();
}

/** Explicit Supabase write failures (call from catch blocks after mutations). */
export function logSupabaseWriteFailed(params: {
  userId: string | null;
  attemptId: string | null;
  platform: SessionPlatform | null;
  table: string;
  operation: string;
  errorMessage: string;
}): void {
  const uid = params.userId;
  if (!uid) {
    if (isDevBundle) console.warn('[session_logs] logSupabaseWriteFailed skipped (no userId)', params.table);
    return;
  }
  writeSessionLog({
    userId: uid,
    attemptId: params.attemptId,
    eventType: 'supabase_write_failed',
    eventData: {
      table: params.table,
      operation: params.operation,
      error_message: params.errorMessage,
    },
    durationMs: null,
    error: params.errorMessage,
    platform: params.platform,
  });
}
