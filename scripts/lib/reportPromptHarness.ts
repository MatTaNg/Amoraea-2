/**
 * Production-aligned report prompt assembly for verification scripts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildReportPrompt, buildSystemPrompt } from '../../src/features/psychometrics/personalReportPrompt';
import {
  buildPartialReportPrompt,
  buildPartialSystemPrompt,
} from '../../src/features/psychometrics/partialReportPrompt';
import {
  buildPartialReportDataFromRows,
  fetchPartialReportDataForUser,
  type PartialReportFetchResult,
} from '../../src/features/psychometrics/partialReportData';
import { fetchReportDataForAttempt } from '../../src/features/psychometrics/fetchPersonalReportData';
import type { ReportData } from '../../src/features/psychometrics/personalReportData';

export {
  buildPartialReportDataFromRows,
  fetchPartialReportDataForUser,
  type PartialReportFetchResult,
};

export async function loadPersonalReportPromptForAttempt(
  supabase: SupabaseClient,
  attemptId: string,
): Promise<{ data: ReportData; system: string; userPrompt: string }> {
  const data = await fetchReportDataForAttempt(attemptId);
  return {
    data,
    system: buildSystemPrompt(),
    userPrompt: buildReportPrompt(data),
  };
}

export async function loadPartialReportPromptForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ fetch: PartialReportFetchResult; system: string; userPrompt: string }> {
  const fetch = await fetchPartialReportDataForUser(supabase, userId);
  return {
    fetch,
    system: buildPartialSystemPrompt(),
    userPrompt: buildPartialReportPrompt(fetch.data),
  };
}

/** Extract the SELF-ASSESSMENTS block from a full personal report prompt. */
export function extractSelfAssessmentsBlock(userPrompt: string): string | null {
  const start = userPrompt.indexOf('SELF-ASSESSMENTS:');
  if (start < 0) return null;
  const relStart = userPrompt.indexOf('\n', start);
  const end = userPrompt.indexOf('\n\nRELATIONAL INTELLIGENCE', start);
  if (relStart < 0 || end < 0) return null;
  return userPrompt.slice(relStart + 1, end).trim();
}
