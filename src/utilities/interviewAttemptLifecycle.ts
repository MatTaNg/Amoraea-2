/**
 * Persist interview lifecycle on the current attempt row (Supabase).
 * No-op: `session_lifecycle` is not present on all deployed schemas; avoid runtime update errors.
 */
export async function persistInterviewAttemptSessionLifecycle(
  _attemptId: string | null | undefined,
  _lifecycle: 'not_started' | 'in_progress' | 'completed' | 'scoring'
): Promise<void> {
  /* intentionally empty */
}
