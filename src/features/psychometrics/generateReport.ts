import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import { invokeAnthropicReportNarrativeWithStructuralValidation } from '@features/reports/invokeValidatedReportNarrative';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { getReportLogoSrc } from './reportBranding';
import { stripStructuralNarrativeBlock } from '@features/reports/reportNarrativeStructuralEnforcement';
import {
  computePersonalReportSourceHash,
  loadStoredInterviewReports,
  readCachedPersonalReportMarkdown,
  savePersonalReportMarkdown,
} from './persistedInterviewReport';
import {
  fetchReportData,
  type ReportData,
} from './fetchPersonalReportData';
import {
  buildReportPrompt,
  buildSystemPrompt,
  buildPersonalReportStructuralValidationContext,
} from './personalReportPrompt';
import {
  buildPersonalReportEvidenceInventory,
  logLiveNarrativePrompt,
  logNarrativeEvidenceAudit,
} from '@features/reports/narrativeEvidenceAudit';
import {
  finalizeUserFacingReportMarkdown,
  finalizeUserFacingPartialReportMarkdown,
  REPORT_FOOTER_DISCLAIMER,
} from '@features/reports/reportTransparency';

export type { PersonalReportMentalizingProfile, ReportData } from './personalReportData';
export { buildReportPrompt, buildSystemPrompt } from './personalReportPrompt';
export { fetchReportData, fetchReportDataForAttempt } from './fetchPersonalReportData';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function generateUserReport(userId: string, prefetchedData?: ReportData): Promise<string> {
  const data = prefetchedData ?? (await fetchReportData(userId));

  const psychometricSignals: string[] = [];
  const p = data.user.psychometrics;
  if (p.rsesScore != null) psychometricSignals.push('rses');
  if (p.gaspScore != null) psychometricSignals.push('gasp');
  if (p.dweckScore != null) psychometricSignals.push('dweck');
  if (p.brsScore != null) psychometricSignals.push('brs');
  if (p.scsSfScore != null || p.scsSfSelfKindnessScore != null) psychometricSignals.push('scs_sf');
  if (p.mspssScore != null) psychometricSignals.push('mspss');
  if (p.rfqScore != null) psychometricSignals.push('rfq');

  logNarrativeEvidenceAudit(
    buildPersonalReportEvidenceInventory('personal_full_report', data.attempt, psychometricSignals),
  );

  const system = buildSystemPrompt();
  const userPrompt = buildReportPrompt(data);
  logLiveNarrativePrompt('personal_full_report', system, userPrompt);

  return finalizeUserFacingReportMarkdown(
    await invokeAnthropicReportNarrativeWithStructuralValidation(
      'personal_full_report',
      {
        model: CLAUDE_SONNET_MODEL,
        system,
      },
      userPrompt,
      buildPersonalReportStructuralValidationContext(data),
    ),
    data,
  );
}

export type ReportHtmlOptions = {
  userName: string | null;
  logoSrc: string;
  headerTitle?: string;
  headerSubtitle?: string;
  footerDisclaimer?: string;
  /** When set, applies templated transparency sections before HTML render (e.g. cached reports). */
  reportDataForTransparency?: ReportData;
  /** Partial preview — confidence section only. */
  applyPartialTransparency?: boolean;
};

/** Full branded HTML document for PDF export / print. */
export async function buildPersonalReportHtml(userId: string): Promise<string> {
  const [reportData, stored, logoSrc] = await Promise.all([
    fetchReportData(userId),
    loadStoredInterviewReports(userId),
    getReportLogoSrc(),
  ]);
  const safeName = reportData.user.name;
  const personalHash = computePersonalReportSourceHash(reportData);

  if (stored) {
    const cached = readCachedPersonalReportMarkdown(stored, personalHash);
    if (cached) {
      return convertMarkdownToHtml(cached, {
        userName: safeName,
        logoSrc,
        headerTitle: safeName ? `${safeName}'s Personal Report` : 'Your Personal Report',
        headerSubtitle: 'Personal Development Report',
        reportDataForTransparency: reportData,
      });
    }
  }

  const reportMarkdown = await generateUserReport(userId, reportData);
  const attemptId =
    stored?.attemptId ?? (await fetchMostRecentCompletedInterviewAttemptId(userId));
  if (attemptId) {
    await savePersonalReportMarkdown(attemptId, userId, reportMarkdown, personalHash);
  }

  return convertMarkdownToHtml(reportMarkdown, {
    userName: safeName,
    logoSrc,
    headerTitle: safeName ? `${safeName}'s Personal Report` : 'Your Personal Report',
    headerSubtitle: 'Personal Development Report',
    reportDataForTransparency: reportData,
  });
}

export function convertMarkdownToHtml(markdown: string, options: ReportHtmlOptions): string {
  const {
    userName,
    logoSrc,
    headerTitle,
    headerSubtitle,
    footerDisclaimer,
    reportDataForTransparency,
    applyPartialTransparency,
  } = options;
  const withTransparency =
    reportDataForTransparency != null
      ? finalizeUserFacingReportMarkdown(markdown, reportDataForTransparency)
      : applyPartialTransparency
        ? finalizeUserFacingPartialReportMarkdown(markdown)
        : markdown;
  const cleanedMarkdown = stripStructuralNarrativeBlock(withTransparency);
  const lines = cleanedMarkdown.split('\n');
  const htmlLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      htmlLines.push('<div style="height:8px"></div>');
      continue;
    }
    if (trimmed.startsWith('## ')) {
      htmlLines.push(`<h2>${escapeHtml(trimmed.replace('## ', ''))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      htmlLines.push(`<h3>${escapeHtml(trimmed.replace('### ', ''))}</h3>`);
    } else {
      const escaped = escapeHtml(trimmed);
      const withBold = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
      htmlLines.push(`<p>${withBold}</p>`);
    }
  }

  const safeName = userName ? escapeHtml(userName) : null;
  const title = escapeHtml(
    headerTitle ?? (safeName ? `${safeName}'s Personal Report` : 'Your Personal Report'),
  );
  const subtitleSuffix = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const subtitleLabel = headerSubtitle ?? 'Personal Development Report';
  const safeLogoSrc = escapeHtml(logoSrc);
  const defaultFooter = REPORT_FOOTER_DISCLAIMER;

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} — Amoraea</title>
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }

      body {
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 14px;
        line-height: 1.75;
        color: #1e2936;
        background: #f4f7fb;
      }

      .report-shell {
        max-width: 720px;
        margin: 0 auto;
        background: #ffffff;
        box-shadow: 0 8px 40px rgba(5, 6, 13, 0.08);
      }

      .report-header {
        background: linear-gradient(165deg, #05060d 0%, #0d1a2e 55%, #122640 100%);
        padding: 36px 48px 32px;
        text-align: center;
        border-bottom: 3px solid #5ba8e8;
      }

      .report-logo {
        width: 88px;
        height: 88px;
        object-fit: contain;
        margin: 0 auto 14px;
        display: block;
      }

      .app-name {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 4px;
        text-transform: uppercase;
        color: #5ba8e8;
        margin-bottom: 12px;
      }

      .report-title {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 26px;
        font-weight: 700;
        color: #f4f8fc;
        margin-bottom: 6px;
        line-height: 1.25;
      }

      .report-subtitle {
        font-size: 13px;
        color: rgba(244, 248, 252, 0.65);
        font-family: 'Helvetica Neue', Arial, sans-serif;
      }

      .report-body {
        padding: 40px 48px 32px;
      }

      h2 {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 16px;
        font-weight: 700;
        color: #0d1a2e;
        margin-top: 32px;
        margin-bottom: 12px;
        padding-bottom: 8px;
        border-bottom: 2px solid #e2eaf4;
        text-transform: uppercase;
        letter-spacing: 0.6px;
      }

      h3 {
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 15px;
        font-weight: 600;
        color: #1e3a5f;
        margin-top: 20px;
        margin-bottom: 6px;
      }

      p {
        margin-bottom: 14px;
        color: #2a3544;
      }

      strong {
        font-weight: 600;
        color: #0d1a2e;
      }

      .report-footer {
        margin: 0;
        padding: 24px 48px 36px;
        border-top: 1px solid #e2eaf4;
        background: #f8fafc;
        font-family: 'Helvetica Neue', Arial, sans-serif;
        font-size: 11px;
        color: #7a8a9e;
        line-height: 1.65;
        text-align: center;
      }

      .report-footer-brand {
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #5ba8e8;
        margin-bottom: 8px;
        font-size: 10px;
      }

      @media print {
        body { background: #fff; }
        .report-shell { box-shadow: none; max-width: none; }
        .report-header { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  </head>
  <body>
    <div class="report-shell">
      <div class="report-header">
        <img class="report-logo" src="${safeLogoSrc}" alt="Amoraea" />
        <div class="app-name">Amoraea</div>
        <div class="report-title">${title}</div>
        <div class="report-subtitle">${escapeHtml(subtitleLabel)} · ${subtitleSuffix}</div>
      </div>

      <div class="report-body">
        ${htmlLines.join('\n')}
      </div>

      <div class="report-footer">
        <div class="report-footer-brand">Amoraea</div>
        ${escapeHtml(footerDisclaimer ?? defaultFooter)}
      </div>
    </div>
  </body>
</html>`;
}
