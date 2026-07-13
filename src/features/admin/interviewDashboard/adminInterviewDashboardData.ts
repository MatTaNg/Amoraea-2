import { supabase } from '@data/supabase/client';
import {
  fetchCompatibilityTestSeedUserIds,
  isCompatibilityTestSeedUser,
} from '@features/compatibility/compatibilityTestSeedUser';
import {
  INTERVIEW_ATTEMPTS_SUMMARY_SELECT,
  INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE,
} from '@data/supabase/interviewAttemptSelects';
import {
  adminInterviewAttemptsFullSelect,
  getInterviewAttemptDefenseCrossReferenceColumnAbsent,
  getInterviewAttemptGamingCorrectionColumnsAbsent,
  getInterviewAttemptOverrideColumnsAbsent,
  isInterviewAttemptsMissingOverrideColumnsError,
  markInterviewAttemptDefenseCrossReferenceColumnPresent,
  markInterviewAttemptGamingCorrectionColumnsPresent,
  markInterviewAttemptOverrideColumnsPresent,
  rememberInterviewAttemptOverrideColumnsAbsent,
  rememberInterviewAttemptSelectColumnAbsences,
} from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { isRecoverableUsersSelectError } from '@app/screens/admin/AdminProfileAssessmentTabs';
import {
  ADMIN_USERS_LIST_SELECT,
  ADMIN_USERS_LIST_SELECT_WITHOUT_SD3_RFQ,
} from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import type {
  AttemptRow,
  AttemptSummary,
  FetchAdminUsersListResult,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export async function fetchAdminUsersList(): Promise<FetchAdminUsersListResult> {
  let usersError: { message: string; code?: string } | null = null;
  let allUsers: UserRow[] | null = null;

  for (const select of [ADMIN_USERS_LIST_SELECT_WITHOUT_SD3_RFQ, ADMIN_USERS_LIST_SELECT]) {
    const result = await supabase.from('users').select(select).order('created_at', { ascending: false });
    if (!result.error && result.data) {
      allUsers = result.data as UserRow[];
      usersError = null;
      break;
    }
    usersError = result.error;
    if (result.error && !isRecoverableUsersSelectError(result.error)) {
      break;
    }
  }

  if (usersError || !allUsers) {
    console.error('Admin panel users fetch error:', usersError);
    return { groups: [], errorMessage: usersError?.message ?? 'Failed to load users' };
  }

  const seedUserIds = await fetchCompatibilityTestSeedUserIds(supabase);
  const users = allUsers.filter(
    (user) => !isCompatibilityTestSeedUser({ id: user.id, email: user.email }, seedUserIds),
  );

  const overrideColsAbsent = await getInterviewAttemptOverrideColumnsAbsent();

  const attemptsResp = (await supabase
    .from('interview_attempts')
    .select(
      overrideColsAbsent ? INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE : INTERVIEW_ATTEMPTS_SUMMARY_SELECT,
    )
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('created_at', { ascending: false })) as {
    data: AttemptSummary[] | null;
    error: { message: string; code?: string } | null;
  };
  let { data: allAttempts, error: attemptsError } = attemptsResp;

  if (overrideColsAbsent && allAttempts) {
    allAttempts = allAttempts.map((row) => ({
      ...row,
      override_status: null as boolean | null,
      override_set_at: null as string | null,
    })) as AttemptSummary[];
  }

  if (!overrideColsAbsent && attemptsError && isInterviewAttemptsMissingOverrideColumnsError(attemptsError)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    const legacy = (await supabase
      .from('interview_attempts')
      .select(INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('created_at', { ascending: false })) as {
      data: AttemptSummary[] | null;
      error: { message: string; code?: string } | null;
    };
    attemptsError = legacy.error;
    allAttempts = legacy.data?.map((row) => ({
      ...row,
      override_status: null as boolean | null,
      override_set_at: null as string | null,
    })) as AttemptSummary[];
  }

  if (!overrideColsAbsent && !attemptsError) {
    void markInterviewAttemptOverrideColumnsPresent();
  }

  if (attemptsError) {
    console.error('Admin panel attempts fetch error:', attemptsError);
    return {
      groups: users.map((user) => ({
        user,
        attempts: [] as AttemptSummary[],
        latestAttempt: null,
      })),
      errorMessage: `Could not load interview_attempts: ${attemptsError.message}`,
    };
  }

  const attempts = (allAttempts ?? []) as AttemptSummary[];

  const attemptFinishedMs = (a: AttemptSummary): number => {
    const raw = a.completed_at ?? a.created_at;
    const t = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  };

  const groups = users.map((user) => {
    const userAttempts = attempts
      .filter((a) => a.user_id === user.id)
      .sort((a, b) => attemptFinishedMs(b) - attemptFinishedMs(a));
    const latestAttempt = userAttempts.length > 0 ? userAttempts[0] : null;
    return {
      user,
      attempts: userAttempts,
      latestAttempt,
    };
  });

  groups.sort((a, b) => {
    const ta = a.latestAttempt ? attemptFinishedMs(a.latestAttempt) : Number.NEGATIVE_INFINITY;
    const tb = b.latestAttempt ? attemptFinishedMs(b.latestAttempt) : Number.NEGATIVE_INFINITY;
    return tb - ta;
  });

  return { groups, errorMessage: null };
}

export async function fetchAllFullAttemptsForUser(
  userId: string,
): Promise<{ attempts: AttemptRow[]; errorMessage: string | null }> {
  const patchOptionalNulls = (row: Record<string, unknown>): AttemptRow =>
    ({
      ...row,
      override_status: row.override_status ?? null,
      override_set_at: row.override_set_at ?? null,
      corrected_psychometric_modifier: row.corrected_psychometric_modifier ?? null,
      gaming_correction: row.gaming_correction ?? null,
    }) as AttemptRow;

  for (let attempt = 0; attempt < 4; attempt++) {
    const select = await adminInterviewAttemptsFullSelect();
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error) {
      if (!(await getInterviewAttemptGamingCorrectionColumnsAbsent())) {
        void markInterviewAttemptGamingCorrectionColumnsPresent();
      }
      if (!(await getInterviewAttemptDefenseCrossReferenceColumnAbsent())) {
        void markInterviewAttemptDefenseCrossReferenceColumnPresent();
      }
      if (!(await getInterviewAttemptOverrideColumnsAbsent())) {
        void markInterviewAttemptOverrideColumnsPresent();
      }
      const rows =
        (data as AttemptRow[] | null)?.map((row) => patchOptionalNulls(row as Record<string, unknown>)) ?? [];
      return { attempts: rows, errorMessage: null };
    }
    if (!(await rememberInterviewAttemptSelectColumnAbsences(error))) {
      console.error('Admin panel fetchAllFullAttemptsForUser:', error);
      return { attempts: [], errorMessage: error.message };
    }
  }

  return { attempts: [], errorMessage: 'Failed to load attempts after column fallback retries' };
}
