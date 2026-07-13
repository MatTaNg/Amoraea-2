import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import { invokeAnthropicReportNarrativeWithStructuralValidation } from '@features/reports/invokeValidatedReportNarrative';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { convertMarkdownToHtml, fetchReportData } from './generateReport';
import { finalizeUserFacingPartialReportMarkdown, REPORT_FOOTER_DISCLAIMER } from '@features/reports/reportTransparency';
import { getReportLogoSrc } from './reportBranding';
import {
  computePartialReportSourceHash,
  computePersonalReportSourceHash,
  loadStoredInterviewReports,
  readCachedReportMarkdownForPartialDownload,
  savePartialReportMarkdown,
} from './persistedInterviewReport';
import {
  buildPartialReportPrompt,
  buildPartialSystemPrompt,
  type PartialReportData,
} from './partialReportPrompt';
import {
  buildPersonalReportEvidenceInventory,
  logLiveNarrativePrompt,
  logNarrativeEvidenceAudit,
} from '@features/reports/narrativeEvidenceAudit';
import {
  fetchPartialReportDataForUser,
  type PartialReportFetchResult,
} from './partialReportData';

export type { PartialReportData } from './partialReportPrompt';
export {
  buildPartialReportDataFromRows,
  fetchPartialReportDataForUser,
  type PartialReportFetchResult,
} from './partialReportData';
export { buildPartialReportPrompt, buildPartialSystemPrompt } from './partialReportPrompt';

const PARTIAL_FOOTER =
  `${REPORT_FOOTER_DISCLAIMER} This is a partial preview based on your AI interview conversation only — complete the self assessments in the app to unlock your full personal development report.`;

export async function fetchPartialReportData(userId: string): Promise<PartialReportData> {
  const { data } = await fetchPartialReportDataForUser(supabase, userId);
  return data;
}

export async function generatePartialUserReport(
  userId: string,
  prefetchedData?: PartialReportData,
): Promise<string> {
  const data = prefetchedData ?? (await fetchPartialReportData(userId));

  logNarrativeEvidenceAudit(
    buildPersonalReportEvidenceInventory('personal_partial_report', data.attempt),
  );

  const system = buildPartialSystemPrompt();
  const userPrompt = buildPartialReportPrompt(data);
  logLiveNarrativePrompt('personal_partial_report', system, userPrompt);

  return finalizeUserFacingPartialReportMarkdown(
    await invokeAnthropicReportNarrativeWithStructuralValidation(
      'personal_partial_report',
      {
        model: CLAUDE_SONNET_MODEL,
        system,
      },
      userPrompt,
      {
        scenarioScoreGrounding: data.attempt?.scenarioScoreGrounding ?? null,
        requirePsychometricIntegration: false,
      },
    ),
  );
}

export async function buildPartialReportHtml(userId: string): Promise<string> {
  const [reportData, fullReportData, stored, logoSrc] = await Promise.all([
    fetchPartialReportData(userId),
    fetchReportData(userId),
    loadStoredInterviewReports(userId),
    getReportLogoSrc(),
  ]);

  const partialHash = computePartialReportSourceHash(reportData);
  const personalHash = computePersonalReportSourceHash(fullReportData);
  const safeName = reportData.user.name;

  if (stored) {
    const cached = readCachedReportMarkdownForPartialDownload(stored, partialHash, personalHash);
    if (cached) {
      if (cached.isFullReport) {
        return convertMarkdownToHtml(cached.markdown, {
          userName: safeName,
          logoSrc,
          headerTitle: safeName ? `${safeName}'s Personal Report` : 'Your Personal Report',
          headerSubtitle: 'Personal Development Report',
          reportDataForTransparency: fullReportData,
        });
      }
      return convertMarkdownToHtml(cached.markdown, {
        userName: safeName,
        logoSrc,
        headerTitle: safeName ? `${safeName}'s Partial Report` : 'Your Partial Personal Report',
        headerSubtitle: 'Partial Personal Report',
        footerDisclaimer: PARTIAL_FOOTER,
        applyPartialTransparency: true,
      });
    }
  }

  const reportMarkdown = await generatePartialUserReport(userId, reportData);
  const attemptId =
    stored?.attemptId ?? (await fetchMostRecentCompletedInterviewAttemptId(userId));
  if (attemptId) {
    await savePartialReportMarkdown(attemptId, userId, reportMarkdown, partialHash);
  }

  return convertMarkdownToHtml(reportMarkdown, {
    userName: safeName,
    logoSrc,
    headerTitle: safeName ? `${safeName}'s Partial Report` : 'Your Partial Personal Report',
    headerSubtitle: 'Partial Personal Report',
    footerDisclaimer: PARTIAL_FOOTER,
    applyPartialTransparency: true,
  });
}
