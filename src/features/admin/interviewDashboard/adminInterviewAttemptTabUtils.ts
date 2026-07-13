import { parseObject } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow, AttemptSummary } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function getAttemptsSorted(attempts: AttemptRow[] | null | undefined): AttemptRow[] {
  if (!Array.isArray(attempts)) return [];
  return [...attempts].sort((a, b) => {
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    if (tb !== ta) return tb - ta;
    return b.attempt_number - a.attempt_number;
  });
}

export function formatAttemptTabLabel(attempt: AttemptSummary | AttemptRow): string {
  const raw = attempt.completed_at ?? attempt.created_at;
  let pending = attempt.reasoning_pending === true;
  if ('ai_reasoning' in attempt) {
    const ar = parseObject((attempt as AttemptRow).ai_reasoning);
    pending =
      pending ||
      !!(ar as { _reasoningPending?: boolean } | null)?._reasoningPending ||
      !!(ar as { _narrativeFailed?: boolean } | null)?._narrativeFailed ||
      !!(ar as { _completionHeld?: boolean } | null)?._completionHeld;
  }
  const suffix = pending ? ' · AI narrative pending' : '';
  const unc =
    'uncertainty_score' in attempt && typeof attempt.uncertainty_score === 'number'
      ? attempt.uncertainty_score
      : null;
  const uncSuffix = unc != null ? ` · U:${unc.toFixed(2)}` : '';
  if (!raw) return `Test ${attempt.attempt_number}${suffix}${uncSuffix}`;
  return (
    new Date(raw).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) +
    suffix +
    uncSuffix
  );
}
