import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@data/supabase/client';
import type { InterviewAttemptRevealFields } from './postInterviewProcessingGate';

const OVERRIDE_COLUMNS_ABSENT_KEY = '@amoraea:interview_attempts_override_columns_absent';

/** In-memory cache so we do not re-request dropped columns every poll after the first 42703. */
let overrideColumnsAbsentMemory: boolean | null = null;

function concatErrorFields(err: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): string {
  if (!err) return '';
  return [err.message, err.details, err.hint, String(err.code ?? '')].filter(Boolean).join(' ');
}

/**
 * True when `interview_attempts.override_status` / `override_set_at` are not in the database (or PostgREST cache).
 * Postgres: 42703; PostgREST schema cache: PGRST204 ("Could not find the 'override_set_at' column…").
 */
export function isInterviewAttemptsMissingOverrideColumnsError(err: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!err) return false;
  const t = concatErrorFields(err);
  if (String(err.code) === 'PGRST204') {
    if (t.includes('override_set_at') || t.includes('override_status')) return true;
  }
  if (String(err.code) === '42703' && (t.includes('override_status') || t.includes('override_set_at'))) return true;
  return (
    (t.includes('override_status') || t.includes('override_set_at')) &&
    (t.includes('does not exist') || t.includes('schema cache'))
  );
}

export async function getInterviewAttemptOverrideColumnsAbsent(): Promise<boolean> {
  if (overrideColumnsAbsentMemory !== null) return overrideColumnsAbsentMemory;
  try {
    const v = await AsyncStorage.getItem(OVERRIDE_COLUMNS_ABSENT_KEY);
    overrideColumnsAbsentMemory = v === '1';
    return overrideColumnsAbsentMemory;
  } catch {
    overrideColumnsAbsentMemory = false;
    return false;
  }
}

async function setInterviewAttemptOverrideColumnsAbsent(absent: boolean): Promise<void> {
  overrideColumnsAbsentMemory = absent;
  try {
    if (absent) await AsyncStorage.setItem(OVERRIDE_COLUMNS_ABSENT_KEY, '1');
    else await AsyncStorage.removeItem(OVERRIDE_COLUMNS_ABSENT_KEY);
  } catch {
    // ignore
  }
}

/** Call after a successful select that included `override_status` (migrations applied; clears stale skip). */
export async function markInterviewAttemptOverrideColumnsPresent(): Promise<void> {
  await setInterviewAttemptOverrideColumnsAbsent(false);
}

/** Persist “skip `override_status` in selects” after PostgREST reports the column is missing. */
export async function rememberInterviewAttemptOverrideColumnsAbsent(): Promise<void> {
  await setInterviewAttemptOverrideColumnsAbsent(true);
}

/**
 * When `interview_attempts.override_status` is still null (e.g. columns not migrated), admin early reveal
 * writes the same boolean to `users.interview_passed_admin_override`. Treat that as the routing override
 * so `evaluateStandardPostInterviewReveal` step 1 applies — only when the attempt row has no override yet.
 * Does not use `interview_passed` alone (natural gate fail would otherwise look like an admin override).
 */
/** Prefer `completed_at`; fall back to row creation time so the 48h window can elapse when completion TS was never written. */
function revealFieldsFromAttemptRow(row: {
  completed_at: string | null;
  passed: boolean | null;
  created_at?: string | null;
  override_status?: boolean | null;
}): InterviewAttemptRevealFields {
  const completedAt = row.completed_at ?? row.created_at ?? null;
  return {
    completed_at: completedAt,
    passed: row.passed,
    override_status: row.override_status ?? null,
  };
}

function withAdminProfileOverrideMerged(
  row: InterviewAttemptRevealFields,
  interviewPassedAdminOverride: boolean | null | undefined,
): InterviewAttemptRevealFields {
  if (row.override_status === true || row.override_status === false) {
    return row;
  }
  if (interviewPassedAdminOverride === true || interviewPassedAdminOverride === false) {
    return { ...row, override_status: interviewPassedAdminOverride };
  }
  return row;
}

/**
 * Latest attempt fields for standard post-interview routing (48h hold + optional admin override).
 * If `override_status` is not deployed, uses `completed_at` + `passed` only and remembers that so later
 * polls do not repeat failing REST calls.
 */
export async function fetchInterviewAttemptRevealSnapshot(
  userId: string,
): Promise<InterviewAttemptRevealFields | null> {
  const skipOverrideCols = await getInterviewAttemptOverrideColumnsAbsent();

  const { data: urow, error: uerr } = await supabase
    .from('users')
    .select('latest_attempt_id, interview_passed_admin_override')
    .eq('id', userId)
    .maybeSingle();
  if (uerr || !urow?.latest_attempt_id) return null;
  const aid = urow.latest_attempt_id as string;
  const adminOverride = (urow as { interview_passed_admin_override?: boolean | null })
    .interview_passed_admin_override;

  const selectLegacyOnly = async (): Promise<{
    data: InterviewAttemptRevealFields | null;
    error: { message: string } | null;
  }> => {
    const retry = await supabase
      .from('interview_attempts')
      .select('completed_at, passed, created_at')
      .eq('id', aid)
      .eq('user_id', userId)
      .maybeSingle();
    if (retry.error || !retry.data) return { data: null, error: retry.error };
    return {
      data: revealFieldsFromAttemptRow({ ...retry.data, override_status: null }),
      error: null,
    };
  };

  if (skipOverrideCols) {
    const { data, error } = await selectLegacyOnly();
    if (error || !data) return null;
    return withAdminProfileOverrideMerged(data, adminOverride);
  }

  const attemptRes = await supabase
    .from('interview_attempts')
    .select('completed_at, override_status, passed, created_at')
    .eq('id', aid)
    .eq('user_id', userId)
    .maybeSingle();

  let att = attemptRes.data;
  let aerr = attemptRes.error;
  let usedFullSelectPath = !aerr && !!att;

  if (aerr && isInterviewAttemptsMissingOverrideColumnsError(aerr)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    const legacy = await selectLegacyOnly();
    aerr = legacy.error;
    att = legacy.data;
    usedFullSelectPath = false;
  }

  if (!aerr && att && usedFullSelectPath) {
    void markInterviewAttemptOverrideColumnsPresent();
  }

  if (aerr || !att) return null;
  const base = revealFieldsFromAttemptRow({
    completed_at: att.completed_at,
    passed: att.passed,
    created_at: (att as { created_at?: string | null }).created_at ?? null,
    override_status: (att as { override_status?: boolean | null }).override_status ?? null,
  });
  return withAdminProfileOverrideMerged(base, adminOverride);
}
