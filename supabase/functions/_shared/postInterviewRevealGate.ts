/** Keep in sync with `src/utilities/postInterviewProcessingGate.ts`. */

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

/** @deprecated Use {@link evaluateStandardPostInterviewReveal}. */
export function evaluateStandardPostInterviewRevealWithUsersPassedFallback(
  att: InterviewAttemptRevealFields | null | undefined,
  _usersInterviewPassed?: boolean | null | undefined,
  nowMs: number = Date.now(),
  _usersInterviewPassedAdminOverride?: boolean | null,
  _usersInterviewPassedComputed?: boolean | null,
): StandardPostInterviewReveal {
  return evaluateStandardPostInterviewReveal(att, nowMs);
}
