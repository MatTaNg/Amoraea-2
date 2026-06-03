import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { sendResultsEmail } from './sendResultsEmail.ts';
import {
  type InterviewAttemptRevealFields,
  isResultsEmailRevealReady,
} from './postInterviewRevealGate.ts';

const ADMIN_CONSOLE_EMAIL = 'admin@amoraea.com';

async function isStandardApplicantAwaitingPostInterviewReveal(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: userRow } = await supabase
    .from('users')
    .select('email')
    .eq('id', userId)
    .maybeSingle();
  const email = (userRow?.email ?? '').trim().toLowerCase();
  if (email === ADMIN_CONSOLE_EMAIL) return false;
  return true;
}

function pickFirstNameFromRaw(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const first = trimmed.split(/\s+/).find((t) => t.length > 0) ?? '';
  const cleaned = first.replace(/[.!?,;:]+$/g, '').trim();
  if (!cleaned) return null;
  if (cleaned.length < 2 || cleaned.length > 30) return null;
  if (/[^A-Za-z'’-]/.test(cleaned)) return null;
  return cleaned;
}

async function loadAttemptRevealFieldsForEmail(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
): Promise<{ attempt: InterviewAttemptRevealFields | null }> {
  const [{ data: attemptRow }, { data: userRow }] = await Promise.all([
    supabase
      .from('interview_attempts')
      .select('completed_at, override_status, passed')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('users')
      .select('interview_passed_admin_override')
      .eq('id', userId)
      .maybeSingle(),
  ]);

  if (!attemptRow?.completed_at) {
    return { attempt: null };
  }

  let overrideStatus = (attemptRow as { override_status?: boolean | null }).override_status ?? null;
  const adminOverride = (userRow as { interview_passed_admin_override?: boolean | null } | null)
    ?.interview_passed_admin_override ?? null;
  if (overrideStatus !== true && overrideStatus !== false && (adminOverride === true || adminOverride === false)) {
    overrideStatus = adminOverride;
  }

  return {
    attempt: {
      completed_at: attemptRow.completed_at as string,
      override_status: overrideStatus,
      passed: (attemptRow as { passed?: boolean | null }).passed ?? null,
    },
  };
}

export async function isAttemptEligibleForResultsEmailReveal(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
): Promise<boolean> {
  const { attempt } = await loadAttemptRevealFieldsForEmail(supabase, attemptId, userId);
  return isResultsEmailRevealReady(attempt);
}

/**
 * Sends only when pass/fail has been revealed (admin override or 48h elapsed). Returns true if sent.
 */
export async function sendResultsEmailForAttemptIfRevealed(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
): Promise<boolean> {
  const standardAwaitingReveal = await isStandardApplicantAwaitingPostInterviewReveal(supabase, userId);
  if (standardAwaitingReveal) {
    const eligible = await isAttemptEligibleForResultsEmailReveal(supabase, attemptId, userId);
    if (!eligible) {
      console.log('[ResultsEmail] reveal not ready — skipping', attemptId);
      return false;
    }
  }
  await sendResultsEmailForAttempt(supabase, attemptId, userId);
  return true;
}

/**
 * Idempotent: at most one results-ready email per attempt (claims `results_email_sent_at` before send).
 * By default, only sends after pass/fail reveal unless `force` is true (admin manual resend).
 */
export async function sendResultsEmailForAttempt(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  options?: { force?: boolean },
): Promise<void> {
  if (!Deno.env.get('RESEND_API_KEY')) {
    console.error('[ResultsEmail] RESEND_API_KEY not set — skipping email');
    return;
  }

  if (!options?.force) {
    const standardAwaitingReveal = await isStandardApplicantAwaitingPostInterviewReveal(supabase, userId);
    if (standardAwaitingReveal) {
      const eligible = await isAttemptEligibleForResultsEmailReveal(supabase, attemptId, userId);
      if (!eligible) {
        console.log('[ResultsEmail] reveal not ready — skipping', attemptId);
        return;
      }
    }
  }

  if (!options?.force) {
    const { data: claimed, error: claimErr } = await supabase
      .from('interview_attempts')
      .update({ results_email_sent_at: new Date().toISOString() })
      .eq('id', attemptId)
      .eq('user_id', userId)
      .is('results_email_sent_at', null)
      .select('id')
      .maybeSingle();

    if (claimErr) {
      console.error('[ResultsEmail] claim failed:', claimErr.message);
      throw new Error(claimErr.message);
    }

    if (!claimed?.id) {
      console.log('[ResultsEmail] already sent for attempt:', attemptId);
      return;
    }
  }

  const { data: userData, error: userErr } = await supabase
    .from('users')
    .select('email, full_name, display_name, name, basic_info')
    .eq('id', userId)
    .maybeSingle();

  if (userErr) {
    if (!options?.force) {
      await supabase
        .from('interview_attempts')
        .update({ results_email_sent_at: null })
        .eq('id', attemptId)
        .eq('user_id', userId);
    }
    throw new Error(userErr.message);
  }

  let toEmail = typeof userData?.email === 'string' ? userData.email.trim() : '';
  if (!toEmail) {
    const { data: profileData, error: profileErr } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .maybeSingle();
    if (profileErr) {
      if (!options?.force) {
        await supabase
          .from('interview_attempts')
          .update({ results_email_sent_at: null })
          .eq('id', attemptId)
          .eq('user_id', userId);
      }
      throw new Error(profileErr.message);
    }
    toEmail = typeof profileData?.email === 'string' ? profileData.email.trim() : '';
  }

  if (!toEmail) {
    if (!options?.force) {
      await supabase
        .from('interview_attempts')
        .update({ results_email_sent_at: null })
        .eq('id', attemptId)
        .eq('user_id', userId);
    }
    console.warn('[ResultsEmail] no email found for user in users/profiles:', userId);
    throw new Error('No recipient email found for results email');
  }

  const { data: profileDataForName } = await supabase
    .from('profiles')
    .select('full_name, display_name')
    .eq('id', userId)
    .maybeSingle();

  const basicInfo =
    userData?.basic_info != null && typeof userData.basic_info === 'object' && !Array.isArray(userData.basic_info)
      ? (userData.basic_info as Record<string, unknown>)
      : null;
  const interviewName =
    pickFirstNameFromRaw(userData?.name) ??
    pickFirstNameFromRaw(basicInfo?.firstName) ??
    pickFirstNameFromRaw(basicInfo?.displayName) ??
    pickFirstNameFromRaw(userData?.display_name) ??
    pickFirstNameFromRaw(userData?.full_name) ??
    pickFirstNameFromRaw(profileDataForName?.display_name) ??
    pickFirstNameFromRaw(profileDataForName?.full_name);

  try {
    await sendResultsEmail({
      toEmail,
      userName: interviewName,
    });
    if (options?.force) {
      const { error: stampErr } = await supabase
        .from('interview_attempts')
        .update({ results_email_sent_at: new Date().toISOString() })
        .eq('id', attemptId)
        .eq('user_id', userId);
      if (stampErr) throw new Error(stampErr.message);
    }
  } catch (emailError) {
    if (!options?.force) {
      await supabase
        .from('interview_attempts')
        .update({ results_email_sent_at: null })
        .eq('id', attemptId)
        .eq('user_id', userId);
    }
    throw emailError;
  }
}
