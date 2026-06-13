import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import type { StoredInterviewReports } from './persistedInterviewReportLogic';

export type { StoredInterviewReports } from './persistedInterviewReportLogic';
export {
  computePartialReportSourceHash,
  computePersonalReportSourceHash,
  readCachedPartialReportMarkdown,
  readCachedPersonalReportMarkdown,
  readCachedReportMarkdownForPartialDownload,
} from './persistedInterviewReportLogic';

export async function loadStoredInterviewReports(
  userId: string,
  attemptId?: string | null,
): Promise<StoredInterviewReports | null> {
  const resolvedAttemptId =
    attemptId ?? (await fetchMostRecentCompletedInterviewAttemptId(userId));
  if (!resolvedAttemptId) return null;

  const { data, error } = await supabase
    .from('interview_attempts')
    .select(
      'id, partial_report_markdown, partial_report_source_hash, personal_report_markdown, personal_report_source_hash',
    )
    .eq('id', resolvedAttemptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.warn('[persistedInterviewReport] load failed:', error.message);
    }
    return null;
  }

  return {
    attemptId: data.id,
    partialReportMarkdown:
      typeof data.partial_report_markdown === 'string' ? data.partial_report_markdown : null,
    partialReportSourceHash:
      typeof data.partial_report_source_hash === 'string' ? data.partial_report_source_hash : null,
    personalReportMarkdown:
      typeof data.personal_report_markdown === 'string' ? data.personal_report_markdown : null,
    personalReportSourceHash:
      typeof data.personal_report_source_hash === 'string' ? data.personal_report_source_hash : null,
  };
}

export async function savePartialReportMarkdown(
  attemptId: string,
  userId: string,
  markdown: string,
  sourceHash: string,
): Promise<void> {
  const { error } = await supabase
    .from('interview_attempts')
    .update({
      partial_report_markdown: markdown,
      partial_report_source_hash: sourceHash,
      partial_report_generated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('user_id', userId);

  if (error) {
    console.warn('[persistedInterviewReport] save partial failed:', error.message);
  }
}

export async function savePersonalReportMarkdown(
  attemptId: string,
  userId: string,
  markdown: string,
  sourceHash: string,
): Promise<void> {
  const { error } = await supabase
    .from('interview_attempts')
    .update({
      personal_report_markdown: markdown,
      personal_report_source_hash: sourceHash,
      personal_report_generated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('user_id', userId);

  if (error) {
    console.warn('[persistedInterviewReport] save personal failed:', error.message);
  }
}
