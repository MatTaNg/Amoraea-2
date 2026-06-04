import { fetchUserInterviewCompletionStatus } from './interviewCompletionStatus';

/**
 * Legacy user: completed the AI interview before the psychometric battery existed
 * (`psychometrics_completed_at` is null) but interview completion is recorded on
 * `users.interview_completed` / `latest_attempt_id` → `interview_attempts.completed_at`.
 */
export async function isLegacyUserMissingPsychometrics(userId: string): Promise<boolean> {
  const { interviewCompleted, psychometricsCompletedAt } =
    await fetchUserInterviewCompletionStatus(userId);
  return interviewCompleted && psychometricsCompletedAt == null;
}
