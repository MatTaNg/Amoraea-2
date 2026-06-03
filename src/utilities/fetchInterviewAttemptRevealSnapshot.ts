import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@data/supabase/client';
import {
  USER_INTERVIEW_REVEAL_POLL_SELECT,
  USER_INTERVIEW_ROUTING_TABLE,
} from '@data/supabase/userInterviewRoutingSelect';
import { interviewAttemptsFullSelect } from '@data/supabase/interviewAttemptSelects';
import type { InterviewAttemptRevealFields } from './postInterviewProcessingGate';

export type UserInterviewRevealPollRow = {
  interview_passed?: boolean | null;
  interview_passed_computed?: boolean | null;
  interview_passed_admin_override?: boolean | null;
  interview_completed?: boolean | null;
  latest_attempt_id?: string | null;
};

/** Reveal poll via routing view, falling back to `users` when the view is unavailable. */
export async function fetchUserInterviewRevealPollRow(
  userId: string,
): Promise<UserInterviewRevealPollRow | null> {
  const { data: viewRow, error: viewErr } = await supabase
    .from(USER_INTERVIEW_ROUTING_TABLE)
    .select(USER_INTERVIEW_REVEAL_POLL_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (!viewErr && viewRow) return viewRow;
  const { data: userRow, error: userErr } = await supabase
    .from('users')
    .select(USER_INTERVIEW_REVEAL_POLL_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (!userErr && userRow) return userRow;
  return viewRow ?? userRow ?? null;
}

const OVERRIDE_COLUMNS_ABSENT_KEY = '@amoraea:interview_attempts_override_columns_absent';
const GAMING_CORRECTION_COLUMNS_ABSENT_KEY =
  '@amoraea:interview_attempts_gaming_correction_columns_absent';
const DEFENSE_CROSS_REFERENCE_COLUMN_ABSENT_KEY =
  '@amoraea:interview_attempts_defense_cross_reference_column_absent';

/** In-memory cache so we do not re-request dropped columns every poll after the first 42703. */
let overrideColumnsAbsentMemory: boolean | null = null;
let gamingCorrectionColumnsAbsentMemory: boolean | null = null;
let defenseCrossReferenceColumnAbsentMemory: boolean | null = null;

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
export function isInterviewAttemptsMissingGamingCorrectionColumnsError(err: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!err) return false;
  const t = concatErrorFields(err);
  if (String(err.code) === 'PGRST204') {
    if (
      t.includes('corrected_psychometric_modifier') ||
      t.includes('gaming_correction')
    ) {
      return true;
    }
  }
  if (
    String(err.code) === '42703' &&
    (t.includes('corrected_psychometric_modifier') || t.includes('gaming_correction'))
  ) {
    return true;
  }
  return (
    (t.includes('corrected_psychometric_modifier') || t.includes('gaming_correction')) &&
    (t.includes('does not exist') || t.includes('schema cache'))
  );
}

export async function getInterviewAttemptGamingCorrectionColumnsAbsent(): Promise<boolean> {
  if (gamingCorrectionColumnsAbsentMemory !== null) return gamingCorrectionColumnsAbsentMemory;
  try {
    const v = await AsyncStorage.getItem(GAMING_CORRECTION_COLUMNS_ABSENT_KEY);
    if (v === '0') {
      gamingCorrectionColumnsAbsentMemory = false;
      return false;
    }
    if (v === '1') {
      gamingCorrectionColumnsAbsentMemory = true;
      return true;
    }
  } catch {
    // ignore
  }
  gamingCorrectionColumnsAbsentMemory = true;
  return true;
}

export async function rememberInterviewAttemptGamingCorrectionColumnsAbsent(): Promise<void> {
  gamingCorrectionColumnsAbsentMemory = true;
  try {
    await AsyncStorage.setItem(GAMING_CORRECTION_COLUMNS_ABSENT_KEY, '1');
  } catch {
    // ignore
  }
}

export async function markInterviewAttemptGamingCorrectionColumnsPresent(): Promise<void> {
  gamingCorrectionColumnsAbsentMemory = false;
  try {
    await AsyncStorage.setItem(GAMING_CORRECTION_COLUMNS_ABSENT_KEY, '0');
  } catch {
    // ignore
  }
}

/** Probe whether `gaming_correction` / `corrected_psychometric_modifier` exist (clears stale "absent" after migration). */
export async function probeInterviewAttemptGamingCorrectionColumnsAvailable(): Promise<boolean> {
  const { error } = await supabase
    .from('interview_attempts')
    .select('gaming_correction')
    .limit(1)
    .maybeSingle();
  if (!error) {
    await markInterviewAttemptGamingCorrectionColumnsPresent();
    return true;
  }
  if (isInterviewAttemptsMissingGamingCorrectionColumnsError(error)) {
    await rememberInterviewAttemptGamingCorrectionColumnsAbsent();
    return false;
  }
  return !(await getInterviewAttemptGamingCorrectionColumnsAbsent());
}

export function isInterviewAttemptsMissingDefenseCrossReferenceColumnError(err: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!err) return false;
  const t = concatErrorFields(err);
  if (String(err.code) === 'PGRST204' && t.includes('defense_cross_reference')) return true;
  if (String(err.code) === '42703' && t.includes('defense_cross_reference')) return true;
  return (
    t.includes('defense_cross_reference') &&
    (t.includes('does not exist') || t.includes('schema cache'))
  );
}

export async function getInterviewAttemptDefenseCrossReferenceColumnAbsent(): Promise<boolean> {
  if (defenseCrossReferenceColumnAbsentMemory !== null) {
    return defenseCrossReferenceColumnAbsentMemory;
  }
  try {
    const v = await AsyncStorage.getItem(DEFENSE_CROSS_REFERENCE_COLUMN_ABSENT_KEY);
    if (v === '0') {
      defenseCrossReferenceColumnAbsentMemory = false;
      return false;
    }
    if (v === '1') {
      defenseCrossReferenceColumnAbsentMemory = true;
      return true;
    }
  } catch {
    // ignore
  }
  // Safe default: omit column until probe confirms it exists (avoids 42703 on unmigrated DBs).
  defenseCrossReferenceColumnAbsentMemory = true;
  return true;
}

export async function rememberInterviewAttemptDefenseCrossReferenceColumnAbsent(): Promise<void> {
  defenseCrossReferenceColumnAbsentMemory = true;
  try {
    await AsyncStorage.setItem(DEFENSE_CROSS_REFERENCE_COLUMN_ABSENT_KEY, '1');
  } catch {
    // ignore
  }
}

export async function markInterviewAttemptDefenseCrossReferenceColumnPresent(): Promise<void> {
  defenseCrossReferenceColumnAbsentMemory = false;
  try {
    await AsyncStorage.setItem(DEFENSE_CROSS_REFERENCE_COLUMN_ABSENT_KEY, '0');
  } catch {
    // ignore
  }
}

/** Probe whether `defense_cross_reference` exists (clears stale "absent" after migration). */
export async function probeInterviewAttemptDefenseCrossReferenceColumnAvailable(): Promise<boolean> {
  const { error } = await supabase
    .from('interview_attempts')
    .select('defense_cross_reference')
    .limit(1)
    .maybeSingle();
  if (!error) {
    await markInterviewAttemptDefenseCrossReferenceColumnPresent();
    return true;
  }
  if (isInterviewAttemptsMissingDefenseCrossReferenceColumnError(error)) {
    await rememberInterviewAttemptDefenseCrossReferenceColumnAbsent();
    return false;
  }
  return !(await getInterviewAttemptDefenseCrossReferenceColumnAbsent());
}

/** Admin full-row select respecting cached missing-column flags. */
export async function adminInterviewAttemptsFullSelect(): Promise<string> {
  let includeGamingCorrection = !(await getInterviewAttemptGamingCorrectionColumnsAbsent());
  if (!includeGamingCorrection) {
    includeGamingCorrection = await probeInterviewAttemptGamingCorrectionColumnsAvailable();
  }
  let includeDefenseCrossReference = !(await getInterviewAttemptDefenseCrossReferenceColumnAbsent());
  if (!includeDefenseCrossReference) {
    includeDefenseCrossReference =
      await probeInterviewAttemptDefenseCrossReferenceColumnAvailable();
  }
  let includeOverride = !(await getInterviewAttemptOverrideColumnsAbsent());
  if (!includeOverride) {
    includeOverride = await probeInterviewAttemptOverrideColumnsAvailable();
  }
  return interviewAttemptsFullSelect({
    includeGamingCorrection,
    includeDefenseCrossReference,
    includeOverride,
  });
}

/** After a 42703/PGRST204 on interview_attempts select — returns true if a retry may help. */
export async function rememberInterviewAttemptSelectColumnAbsences(error: {
  code?: string | number;
  message?: string;
  details?: string;
  hint?: string;
} | null): Promise<boolean> {
  let remembered = false;
  if (isInterviewAttemptsMissingGamingCorrectionColumnsError(error)) {
    await rememberInterviewAttemptGamingCorrectionColumnsAbsent();
    remembered = true;
  }
  if (isInterviewAttemptsMissingOverrideColumnsError(error)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    remembered = true;
  }
  if (isInterviewAttemptsMissingDefenseCrossReferenceColumnError(error)) {
    await rememberInterviewAttemptDefenseCrossReferenceColumnAbsent();
    remembered = true;
  }
  return remembered;
}

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

/**
 * Re-check whether override columns exist (clears a stale AsyncStorage skip from an old deploy).
 * Admin Pass/Fail must always try this before skipping the attempt-row update.
 */
export async function probeInterviewAttemptOverrideColumnsAvailable(): Promise<boolean> {
  const { error } = await supabase
    .from('interview_attempts')
    .select('override_status')
    .limit(1)
    .maybeSingle();
  if (!error) {
    await markInterviewAttemptOverrideColumnsPresent();
    return true;
  }
  if (isInterviewAttemptsMissingOverrideColumnsError(error)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    return false;
  }
  return !(await getInterviewAttemptOverrideColumnsAbsent());
}

async function setInterviewAttemptOverrideColumnsAbsent(absent: boolean): Promise<void> {
  overrideColumnsAbsentMemory = absent;
  try {
    if (absent) await AsyncStorage.setItem(OVERRIDE_COLUMNS_ABSENT_KEY, '1');
    else await AsyncStorage.setItem(OVERRIDE_COLUMNS_ABSENT_KEY, '0');
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

export type InterviewAttemptRevealOverrideResult =
  | { ok: true; columnsMissing: false }
  | { ok: false; columnsMissing: true }
  | { ok: false; columnsMissing: false; errorMessage: string };

/** Admin Pass/Fail: write attempt-level reveal override (probes DB; ignores stale AsyncStorage skip). */
export async function updateInterviewAttemptRevealOverride(
  attemptId: string,
  pass: boolean,
): Promise<InterviewAttemptRevealOverrideResult> {
  const columnsAvailable = await probeInterviewAttemptOverrideColumnsAvailable();
  if (!columnsAvailable) {
    return { ok: false, columnsMissing: true };
  }
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('interview_attempts')
    .update({ override_status: pass, override_set_at: nowIso })
    .eq('id', attemptId);
  if (error && isInterviewAttemptsMissingOverrideColumnsError(error)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    return { ok: false, columnsMissing: true };
  }
  if (error) {
    return { ok: false, columnsMissing: false, errorMessage: error.message };
  }
  return { ok: true, columnsMissing: false };
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
    .from(USER_INTERVIEW_ROUTING_TABLE)
    .select('latest_attempt_id, interview_passed_admin_override')
    .eq('id', userId)
    .maybeSingle();
  let routingRow = urow;
  if (uerr || !urow?.latest_attempt_id) {
    const fallback = await fetchUserInterviewRevealPollRow(userId);
    if (!fallback?.latest_attempt_id) return null;
    routingRow = fallback;
  }
  const aid = routingRow.latest_attempt_id as string;
  const adminOverride = routingRow.interview_passed_admin_override;

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
