import type { SupabaseClient } from '@supabase/supabase-js';

/** Effective pass for routing: admin override wins when set, otherwise gate result. */
export function effectiveInterviewPass(override: boolean | null | undefined, gatePass: boolean): boolean {
  return override != null ? override : gatePass;
}

export async function fetchInterviewPassAdminOverride(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean | null> {
  const { data, error } = await supabase
    .from('users')
    .select('interview_passed_admin_override')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[interviewPass] fetch override', error.message);
    return null;
  }
  const o = (data as { interview_passed_admin_override?: boolean | null } | null)?.interview_passed_admin_override;
  return o === true || o === false ? o : null;
}

/** Use when persisting a new gate result from the client. */
export async function buildUsersRowInterviewPassFromGate(
  supabase: SupabaseClient,
  userId: string,
  gatePass: boolean,
): Promise<{ interview_passed_computed: boolean; interview_passed: boolean }> {
  const o = await fetchInterviewPassAdminOverride(supabase, userId);
  return {
    interview_passed_computed: gatePass,
    interview_passed: effectiveInterviewPass(o, gatePass),
  };
}

/**
 * While scoring is still pending (server), keep `interview_passed` null only if there is no admin override
 * to show in the meantime.
 */
export function interviewPassWhileScoringPending(adminOverride: boolean | null | undefined): boolean | null {
  if (adminOverride === true) return true;
  if (adminOverride === false) return false;
  return null;
}
