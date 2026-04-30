/** 48-hour applicant-facing processing window after `interview_attempts.completed_at`. */
export const POST_INTERVIEW_PROCESSING_MS = 48 * 60 * 60 * 1000;

export type InterviewAttemptRevealFields = {
  completed_at: string | null;
  override_status: boolean | null;
  passed: boolean | null;
};

export type StandardPostInterviewReveal =
  | { kind: 'processing' }
  | { kind: 'reveal_pass' }
  | { kind: 'reveal_fail' };

/**
 * Standard post-interview routing from the latest attempt row (read-only). Order is fixed:
 * 1. If `override_status` is non-null (`true` / `false`), route by override only — ignores elapsed time and `passed`.
 * 2. If `override_status` is null and fewer than 48h since `completed_at`, stay processing — do not use `passed`.
 * 3. If `override_status` is null and 48h+ since `completed_at`, route by `passed` (`true` → pass, `false` → fail).
 * If data is missing or `passed` is still unset after the window, stay processing.
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

/**
 * When `interview_attempts.passed` is still null after the 48h window, `users.interview_passed` may already
 * reflect the gate — use it so standard applicants are not stuck on processing.
 * Does not apply inside the 48h window (deferral preserved). Skipped when `usersInterviewPassed` is nullish.
 */
export function evaluateStandardPostInterviewRevealWithUsersPassedFallback(
  att: InterviewAttemptRevealFields | null | undefined,
  usersInterviewPassed: boolean | null | undefined,
  nowMs: number = Date.now(),
): StandardPostInterviewReveal {
  const base = evaluateStandardPostInterviewReveal(att, nowMs);
  if (base.kind !== 'processing') return base;
  if (usersInterviewPassed !== true && usersInterviewPassed !== false) return base;
  if (!att?.completed_at) return base;
  const completedMs = new Date(att.completed_at).getTime();
  if (!Number.isFinite(completedMs)) return base;
  if (nowMs < completedMs + POST_INTERVIEW_PROCESSING_MS) return base;
  if (usersInterviewPassed === true) return { kind: 'reveal_pass' };
  return { kind: 'reveal_fail' };
}

export type StandardPostInterviewStackRoute =
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
      return 'PostInterviewProcessing';
    default: {
      const _exhaustive: never = ev;
      return _exhaustive;
    }
  }
}
