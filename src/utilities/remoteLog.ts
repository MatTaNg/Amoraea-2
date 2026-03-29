/**
 * Remote logging for tracing interview completion on TestFlight builds
 * where console.log is not visible. Remove after diagnosis.
 */
import { supabase } from '@data/supabase/client';

const __DEV__ = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

export async function remoteLog(message: string, data: Record<string, unknown> = {}): Promise<void> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id ?? null;

    const { error } = await supabase.from('debug_logs').insert({
      message,
      user_id: userId,
      data: data as Record<string, unknown>,
    });
    if (error && __DEV__) {
      console.warn('[remoteLog] insert failed:', error.message, error.code, error.details);
    }
  } catch (e) {
    if (__DEV__) {
      console.warn('[remoteLog] threw:', e instanceof Error ? e.message : e);
    }
  }
}
