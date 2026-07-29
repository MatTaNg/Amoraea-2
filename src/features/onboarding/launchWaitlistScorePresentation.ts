import type { InterviewReportAttempt } from '@features/onboarding/loadInterviewReportAttempt';

export function formatLaunchWaitlistScoreDisplay(score: number | null | undefined): string {
  if (score == null || !Number.isFinite(score)) return '—';
  return `${Math.round(score * 10) / 10}`;
}

/** Same precedence as partial/full report final score. */
export function resolveFinalModifiedScoreForDisplay(
  attempt: InterviewReportAttempt | null | undefined,
): number | null {
  if (!attempt) return null;
  const score =
    attempt.modified_weighted_score_with_psychometrics ??
    attempt.modified_weighted_score ??
    attempt.weighted_score;
  return typeof score === 'number' && Number.isFinite(score) ? score : null;
}
