import type { SupabaseClient } from '@supabase/supabase-js';

export type EnsureValidSessionDeps = {
  supabase: SupabaseClient;
};

export async function runEnsureValidSession(deps: EnsureValidSessionDeps): Promise<void> {
  const {
    data: { session },
    error,
  } = await deps.supabase.auth.getSession();
  if (error || !session) {
    const { error: refreshError } = await deps.supabase.auth.refreshSession();
    if (refreshError) throw new Error('Session could not be refreshed');
  }
}
