/** Navigation lock: set when interview completes; prevents other effects from overriding. Survives remount. */
let interviewJustCompletedInSession = false;

/** Latest attempt id written in this session — avoids stale `users.latest_attempt_id` when profile refetch races. */
let interviewLastCommittedAttemptId: string | null = null;

export function peekInterviewJustCompletedInSession(): boolean {
  return interviewJustCompletedInSession;
}

export function setInterviewJustCompletedInSession(value: boolean): void {
  interviewJustCompletedInSession = value;
}

export function takeInterviewJustCompletedInSession(): boolean {
  const value = interviewJustCompletedInSession;
  interviewJustCompletedInSession = false;
  return value;
}

export function peekInterviewLastCommittedAttemptId(): string | null {
  return interviewLastCommittedAttemptId;
}

export function setInterviewLastCommittedAttemptId(value: string | null): void {
  interviewLastCommittedAttemptId = value;
}

export function takeInterviewLastCommittedAttemptId(): string | null {
  const value = interviewLastCommittedAttemptId;
  interviewLastCommittedAttemptId = null;
  return value;
}
