import { supabase } from '@data/supabase/client';
import { clearInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { countSubstantiveInterviewAttemptsForUser } from '@features/interview/interviewAttemptLifecycle';

/** Matches Postgres `interval '6 months'` used in cooling-reset jobs. */
export const INTERVIEW_RETAKE_COOLING_MONTHS = 6;

export function addMonthsUtc(date: Date, months: number): Date {
  const out = new Date(date.getTime());
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

export function getInterviewRetakeEligibleAt(completedAt: Date): Date {
  return addMonthsUtc(completedAt, INTERVIEW_RETAKE_COOLING_MONTHS);
}

export function formatInterviewRetakeEligibleDate(
  completedAtIso: string,
  locale?: string,
): string | null {
  const completed = new Date(completedAtIso);
  if (Number.isNaN(completed.getTime())) return null;
  return getInterviewRetakeEligibleAt(completed).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isSixMonthInterviewRetakeEligible(
  completedAtIso: string | null | undefined,
  now: Date = new Date(),
): boolean {
  if (completedAtIso == null || typeof completedAtIso !== 'string' || !completedAtIso.trim()) {
    return false;
  }
  const completed = new Date(completedAtIso);
  if (Number.isNaN(completed.getTime())) return false;
  return now.getTime() >= getInterviewRetakeEligibleAt(completed).getTime();
}

export function isInterviewRetakeAdminAllowed(
  adminAllowedAt: string | null | undefined,
): boolean {
  return adminAllowedAt != null && typeof adminAllowedAt === 'string' && adminAllowedAt.length > 0;
}

export function shouldShowPostInterviewRetake(input: {
  referralSignupCode?: string | null;
  interviewRetakeAdminAllowedAt?: string | null;
  latestCompletedAttemptAt?: string | null;
  interviewCompletedAt?: string | null;
  isQaRetakeSignupCode?: (code: string | null | undefined) => boolean;
  now?: Date;
}): boolean {
  const isQa = input.isQaRetakeSignupCode?.(input.referralSignupCode) === true;
  if (isQa) return true;
  if (isInterviewRetakeAdminAllowed(input.interviewRetakeAdminAllowedAt)) return true;
  const completedAt = input.latestCompletedAttemptAt ?? input.interviewCompletedAt ?? null;
  return isSixMonthInterviewRetakeEligible(completedAt, input.now);
}

/** Latest completed attempt timestamp — source of truth for cooling windows. */
export async function fetchLatestCompletedInterviewAttemptAt(
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select('completed_at')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn('[interviewRetake] fetchLatestCompletedInterviewAttemptAt failed:', error.message);
    return null;
  }

  return typeof data?.completed_at === 'string' ? data.completed_at : null;
}

/**
 * Prepare account for a new interview run. Prior attempt rows are kept for admin history.
 */
export async function enableInterviewRetake(userId: string): Promise<void> {
  const substantiveCount = await countSubstantiveInterviewAttemptsForUser(userId);
  const nextAttemptNumber = substantiveCount + 1;
  const { error } = await supabase
    .from('users')
    .update({
      interview_completed: false,
      interview_passed: null,
      interview_passed_computed: null,
      interview_passed_admin_override: null,
      interview_completed_at: null,
      interview_attempt_count: nextAttemptNumber,
      latest_attempt_id: null,
      interview_retake_admin_allowed_at: null,
    })
    .eq('id', userId);
  if (error) throw error;
  await clearInterviewFromStorage(userId);
}

/** Admin action: mark allowed + reset routing so the user lands on a fresh interview. */
export async function allowInterviewRetakeByAdmin(userId: string): Promise<void> {
  const nowIso = new Date().toISOString();
  const { error: flagErr } = await supabase
    .from('users')
    .update({ interview_retake_admin_allowed_at: nowIso })
    .eq('id', userId);
  if (flagErr) throw flagErr;
  await enableInterviewRetake(userId);
}
