import { supabase } from '@data/supabase/client';
import {
  isInterviewPreambleBriefingMoment,
  isNamePromptInterviewMoment,
  isSimpleYesNoInterviewMoment,
  looksLikeReadinessAffirmation,
  shouldRecordInterviewResponseTiming,
  userIsAnsweringInterviewReadinessPrompt,
} from '@features/aria/interviewLanguageGate';
import { countInterviewWords } from '@features/aria/moment4SpecificityFollowUp';

export const MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS = 10;

export type InterviewAttemptRowLike = {
  completed_at?: string | null;
  transcript?: unknown;
  is_phantom?: boolean | null;
};

export function transcriptHasSubstantiveUserTurn(transcript: unknown): boolean {
  if (!Array.isArray(transcript)) return false;
  for (const turn of transcript) {
    if (!turn || typeof turn !== 'object') continue;
    const row = turn as { role?: string; content?: string };
    if (row.role !== 'user') continue;
    const content = (row.content ?? '').trim();
    if (countInterviewWords(content) >= MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS) return true;
  }
  return false;
}

/** Non-phantom attempts that count toward attempt_number, cooldown, and admin display. */
export function isSubstantiveInterviewAttempt(row: InterviewAttemptRowLike | null | undefined): boolean {
  if (!row) return false;
  if (row.is_phantom === true) return false;
  if (row.completed_at != null && String(row.completed_at).length > 0) return true;
  return transcriptHasSubstantiveUserTurn(row.transcript);
}

export function shouldCreateAttemptOnFirstSubstantiveResponse(params: {
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  status: string;
  existingAttemptId: string | null;
  currentInterviewMoment: number;
  currentScenario: number;
  userText: string;
  lastAssistantQuestionText: string;
}): boolean {
  if (params.isAdmin || !params.isInterviewAppRoute || params.status !== 'active') return false;
  if (params.existingAttemptId) return false;
  if (params.currentInterviewMoment !== 1 || params.currentScenario !== 1) return false;
  if (countInterviewWords(params.userText) < MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS) return false;
  if (looksLikeReadinessAffirmation(params.userText)) return false;
  if (isNamePromptInterviewMoment(params.lastAssistantQuestionText)) return false;
  if (isInterviewPreambleBriefingMoment(params.lastAssistantQuestionText)) return false;
  if (isSimpleYesNoInterviewMoment(params.lastAssistantQuestionText)) return false;
  if (userIsAnsweringInterviewReadinessPrompt([params.lastAssistantQuestionText])) return false;
  if (!shouldRecordInterviewResponseTiming(params.lastAssistantQuestionText)) return false;
  return true;
}

export async function countSubstantiveInterviewAttemptsForUser(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select('id, completed_at, transcript, is_phantom')
    .eq('user_id', userId);
  if (error) {
    console.warn('[interviewAttemptLifecycle] count substantive attempts failed:', error.message);
    return 0;
  }
  return (data ?? []).filter((row) => isSubstantiveInterviewAttempt(row)).length;
}

export async function fetchLatestNonPhantomInProgressAttemptId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select('id, completed_at, transcript, is_phantom, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) {
    console.warn('[interviewAttemptLifecycle] fetch in-progress attempt failed:', error.message);
    return null;
  }
  for (const row of data ?? []) {
    if (!isSubstantiveInterviewAttempt(row)) continue;
    if (row.completed_at != null && String(row.completed_at).length > 0) continue;
    return typeof row.id === 'string' ? row.id : null;
  }
  return null;
}

/** Attempt number for completion save — uses existing row when present, else substantive count + 1. */
export async function resolveAttemptNumberForCompletion(
  userId: string,
  existingAttemptId: string | null | undefined,
): Promise<number> {
  if (existingAttemptId) {
    const { data } = await supabase
      .from('interview_attempts')
      .select('attempt_number, is_phantom')
      .eq('id', existingAttemptId)
      .eq('user_id', userId)
      .maybeSingle();
    if (data && data.is_phantom !== true && typeof data.attempt_number === 'number') {
      return data.attempt_number;
    }
  }
  const substantiveCount = await countSubstantiveInterviewAttemptsForUser(userId);
  return substantiveCount + 1;
}
