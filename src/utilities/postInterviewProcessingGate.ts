/** 48-hour applicant-facing processing window after `interview_attempts.completed_at`. */
export const POST_INTERVIEW_PROCESSING_MS = 48 * 60 * 60 * 1000;

export type InterviewAttemptRevealFields = {
  completed_at: string | null;
  override_status: boolean | null;
  /** Applicant-facing outcome on the attempt row — used only after the 48h window (not raw gate fields). */
  passed: boolean | null;
};

export type StandardPostInterviewReveal =
  | { kind: 'processing' }
  | { kind: 'reveal_pass' }
  | { kind: 'reveal_fail' };

/**
 * Standard post-interview routing from the latest attempt row (read-only). Order is fixed:
 * 1. If `override_status` is non-null (`true` / `false`), route by override only — ignores elapsed time and `passed`.
 * 2. If `override_status` is null and fewer than 48h since `completed_at`, stay on neutral review — do not use `passed`.
 * 3. If `override_status` is null and 48h+ since `completed_at`, route by `passed` (`true` → pass, `false` → fail).
 * If data is missing or `passed` is still unset after the window, stay on neutral review.
 *
 * User-facing routing must not read `final_gate_pass`, `gate_fail_reasons`, `weighted_score`, or `users.interview_passed`.
 */
export function evaluateStandardPostInterviewReveal(
  att: InterviewAttemptRevealFields | null | undefined,
  nowMs: number = Date.now(),
): StandardPostInterviewReveal {
  if (!att) return { kind: 'processing' };

  if (att.override_status === true) return { kind: 'reveal_pass' };
  if (att.override_status === false) return { kind: 'reveal_fail' };

  if (!att.completed_at) return { kind: 'processing' };
  const completedMs = new Date(att.completed_at).getTime();
  if (!Number.isFinite(completedMs)) return { kind: 'processing' };

  if (nowMs < completedMs + POST_INTERVIEW_PROCESSING_MS) {
    return { kind: 'processing' };
  }

  if (att.passed === true) return { kind: 'reveal_pass' };
  if (att.passed === false) return { kind: 'reveal_fail' };
  return { kind: 'processing' };
}

/** @deprecated Use {@link evaluateStandardPostInterviewReveal} — users-row pass/fail is not used for routing. */
export function evaluateStandardPostInterviewRevealWithUsersPassedFallback(
  att: InterviewAttemptRevealFields | null | undefined,
  _usersInterviewPassed?: boolean | null | undefined,
  nowMs: number = Date.now(),
  _usersInterviewPassedAdminOverride?: boolean | null,
  _usersInterviewPassedComputed?: boolean | null,
): StandardPostInterviewReveal {
  return evaluateStandardPostInterviewReveal(att, nowMs);
}

export type StandardPostInterviewStackRoute =
  | 'PostInterview'
  | 'PostInterviewProcessing'
  | 'PostInterviewPassed'
  | 'PostInterviewFailed';

export function standardPostInterviewRouteFromReveal(
  ev: StandardPostInterviewReveal,
): StandardPostInterviewStackRoute {
  switch (ev.kind) {
    case 'reveal_pass':
      return 'PostInterviewPassed';
    case 'reveal_fail':
      return 'PostInterviewFailed';
    case 'processing':
      return 'PostInterview';
    default: {
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}

export function resolveStandardPostInterviewStackRoute(
  att: InterviewAttemptRevealFields | null | undefined,
  _usersInterviewPassed?: boolean | null | undefined,
  _usersInterviewPassedAdminOverride?: boolean | null,
  _usersInterviewPassedComputed?: boolean | null,
  nowMs: number = Date.now(),
): StandardPostInterviewStackRoute {
  return standardPostInterviewRouteFromReveal(evaluateStandardPostInterviewReveal(att, nowMs));
}
