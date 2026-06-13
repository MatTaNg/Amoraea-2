import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import { resolveReportParticipantDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import { invokeAnthropicMessages } from '@utilities/invokeAnthropicMessages';
import { getReportLogoSrc } from './reportBranding';
import {
  computePersonalReportSourceHash,
  loadStoredInterviewReports,
  readCachedPersonalReportMarkdown,
  savePersonalReportMarkdown,
} from './persistedInterviewReport';

export interface ReportData {
  user: {
    name: string | null;
    aaq2Score: number | null;
    rsesScore: number | null;
    scsPublicScore: number | null;
    scsPrivateScore: number | null;
    psychometricModifier: number | null;
  };
  attempt: {
    weightedScore: number | null;
    depthSignalModifier: number | null;
    finalScore: number | null;
    passed: boolean | null;
    finalGatePass: boolean | null;
    pillarScores: Record<string, number> | null;
    egoDevLevel: number | null;
    emotionRecognitionScore: number | null;
    disclosureCalibration: string | null;
    moment4Concreteness: string | null;
    moment5Concreteness: string | null;
    vocabDensity: number | null;
    vocabLow: boolean | null;
    defensePatterns: Record<string, boolean> | null;
    mentalizing_overcertainty_count: number | null;
    projection: boolean;
    splitting: boolean;
    rationalization: boolean;
    denial: boolean;
  } | null;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function fetchReportData(userId: string): Promise<ReportData> {
  const { data: user } = await supabase
    .from('users')
    .select(
      `
      name,
      basic_info,
      email,
      psychometrics_aaq2_score,
      psychometrics_rses_score,
      psychometrics_scs_public_score,
      psychometrics_scs_private_score,
      psychometric_modifier
    `,
    )
    .eq('id', userId)
    .maybeSingle();

  const { data: attempt } = await supabase
    .from('interview_attempts')
    .select(
      `
      weighted_score,
      depth_signal_modifier,
      score_modifier,
      modified_weighted_score_with_psychometrics,
      modified_weighted_score,
      passed,
      final_gate_pass,
      pillar_scores,
      ego_development_level,
      emotion_recognition_score,
      disclosure_calibration,
      moment_4_concreteness,
      moment_5_concreteness,
      personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low,
      defense_patterns,
      mentalizing_overcertainty_count,
      transcript
    `,
    )
    .eq('user_id', userId)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const defensePatterns = (attempt?.defense_patterns as Record<string, boolean> | null) ?? null;
  const displayName = resolveReportParticipantDisplayName({
    name: user?.name,
    basic_info: user?.basic_info,
    transcript: attempt?.transcript ?? null,
    email: user?.email,
  });

  return {
    user: {
      name: displayName,
      aaq2Score: user?.psychometrics_aaq2_score ?? null,
      rsesScore: user?.psychometrics_rses_score ?? null,
      scsPublicScore: user?.psychometrics_scs_public_score ?? null,
      scsPrivateScore: user?.psychometrics_scs_private_score ?? null,
      psychometricModifier: user?.psychometric_modifier ?? null,
    },
    attempt: attempt
      ? {
          weightedScore: attempt.weighted_score ?? null,
          depthSignalModifier: attempt.depth_signal_modifier ?? attempt.score_modifier ?? null,
          finalScore:
            attempt.modified_weighted_score_with_psychometrics ??
            attempt.modified_weighted_score ??
            attempt.weighted_score ??
            null,
          passed: attempt.passed ?? null,
          finalGatePass: attempt.final_gate_pass ?? null,
          pillarScores: (attempt.pillar_scores as Record<string, number> | null) ?? null,
          egoDevLevel: attempt.ego_development_level ?? null,
          emotionRecognitionScore: attempt.emotion_recognition_score ?? null,
          disclosureCalibration: attempt.disclosure_calibration ?? null,
          moment4Concreteness: attempt.moment_4_concreteness ?? null,
          moment5Concreteness: attempt.moment_5_concreteness ?? null,
          vocabDensity: attempt.personal_moment_emotional_vocab_density ?? null,
          vocabLow: attempt.personal_moment_emotional_vocab_low ?? null,
          defensePatterns,
          mentalizing_overcertainty_count: attempt.mentalizing_overcertainty_count ?? null,
          projection: defensePatterns?.projection_detected === true,
          splitting: defensePatterns?.splitting_detected === true,
          rationalization: defensePatterns?.rationalization_detected === true,
          denial: defensePatterns?.denial_detected === true,
        }
      : null,
  };
}

function buildSystemPrompt(): string {
  return `You are generating a detailed, comprehensive personal development report for a user of Amoraea, a relationship-readiness platform.

CRITICAL RULES:
- Do NOT mention specific numerical scores, thresholds, or raw numbers from the assessment
- Do NOT reveal pillar names, algorithm details, or scoring methodology
- Do NOT use clinical diagnostic language
- Do NOT mention the names of the psychometric instruments (AAQ-II, RSES, SCS, etc.)
- DO write in warm, direct, plain language a non-psychologist would understand
- DO use second person throughout ("you", "your")
- DO be honest about growth areas — do not sugarcoat but remain constructive
- DO be specific to the profile data provided — avoid generic advice
- DO make the report feel like it was written by a thoughtful relationship expert who knows this person well
- Format all section headings with ## and subsection headings with ###
- Use **bold** for emphasis on key insights
- Write in flowing prose, not bullet lists`;
}

function buildReportPrompt(data: ReportData): string {
  const { user, attempt } = data;
  const pillars = attempt?.pillarScores ?? {};

  const pillarBand = (score: number | undefined | null): string => {
    if (score == null) return 'not assessed';
    if (score >= 8) return 'strong';
    if (score >= 7) return 'good';
    if (score >= 6) return 'developing';
    if (score >= 4) return 'needs attention';
    return 'significant growth area';
  };

  const aaq2Interp = (() => {
    const s = user.aaq2Score;
    if (s === null) return 'not assessed';
    if (s <= 14)
      return 'high psychological flexibility — strong willingness to experience difficult emotions without avoidance';
    if (s <= 24) return 'moderate psychological flexibility — generally open to difficult emotions with some avoidance';
    if (s <= 34) return 'mild experiential avoidance — some tendency to push away difficult internal experiences';
    if (s <= 44)
      return 'significant experiential avoidance — notable pattern of avoiding difficult emotions and memories';
    return 'severe experiential avoidance — strong pervasive tendency to avoid internal experience';
  })();

  const rsesInterp = (() => {
    const s = user.rsesScore;
    if (s === null) return 'not assessed';
    if (s >= 30) return 'high self-esteem — stable and positive sense of self-worth';
    if (s >= 23) return 'moderate-high self-esteem — generally positive self-regard with some variability';
    if (s >= 17) return 'moderate-low self-esteem — below-average self-regard, some instability in self-worth';
    if (s >= 11) return 'low self-esteem — significantly impaired self-regard';
    return 'very low self-esteem — severe deficit in self-worth requiring attention';
  })();

  const scsInterp = (() => {
    const pub = user.scsPublicScore;
    const priv = user.scsPrivateScore;
    if (pub === null || priv === null) return 'not assessed';
    const diff = priv - pub;
    if (diff >= 4)
      return 'strongly internally oriented — much more attuned to inner experience than external perception';
    if (diff >= 1)
      return 'mildly internally oriented — slightly more focused on inner experience than impression management';
    if (diff >= -1) return 'balanced — roughly equal attention to inner states and external perception';
    if (diff >= -4)
      return 'mildly externally oriented — slightly more focused on how others see you than how you feel inside';
    return 'strongly externally oriented — much more focused on external impression than internal attunement';
  })();

  const egoDevInterp = (() => {
    const l = attempt?.egoDevLevel;
    if (l === null || l === undefined) return 'not assessed';
    if (l === 1) return 'concrete and rule-based — tends toward black-and-white thinking in relational situations';
    if (l === 2) return 'developing complexity — aware of multiple perspectives but resolves them simply';
    if (l === 3)
      return 'holds complexity — psychologically aware, uses nuanced understanding of relational dynamics';
    if (l === 4) return 'integrates contradictions — systemic relational thinker who tolerates ambiguity well';
    return 'highly sophisticated — full systemic understanding of relational dynamics';
  })();

  const activeDefenses = [
    attempt?.projection && 'projection (attributing own patterns to others)',
    attempt?.splitting && 'splitting (black-and-white assignment of fault)',
    attempt?.rationalization && 'rationalization (logical justification to avoid accountability)',
    attempt?.denial && 'denial (claiming no conflict or negative experience despite evidence)',
  ]
    .filter(Boolean)
    .join(', ');

  const emotionInterp = (() => {
    const raw = attempt?.emotionRecognitionScore;
    if (raw == null) return 'not assessed';
    const pct = raw <= 10 ? raw * 10 : raw;
    if (pct >= 80) return 'strong — reads emotional cues accurately';
    if (pct >= 60) return 'good — generally accurate with occasional misses';
    if (pct >= 40) return 'developing — some difficulty reading subtle emotional cues';
    return 'limited — notable difficulty identifying emotions in others';
  })();

  const vocabInterp = (() => {
    if (attempt?.vocabLow) return 'limited — significantly below typical range';
    const d = attempt?.vocabDensity;
    if (d == null) return 'not assessed';
    if (d < 0.8) return 'below average';
    if (d < 1.5) return 'adequate';
    return 'rich';
  })();

  const overcertaintyInterp = (() => {
    const c = attempt?.mentalizing_overcertainty_count;
    if (c == null) return 'not assessed';
    if (c === 0) return 'none detected';
    if (c <= 2) return 'mild — occasional overcertainty';
    return "significant — frequent overcertainty about others' inner states";
  })();

  return `Generate a comprehensive personal development report for ${user.name ?? 'this user'} based on the following assessment profile. The report should be detailed, specific, and feel genuinely insightful — not generic. It should be approximately 1200-1800 words.

ASSESSMENT PROFILE:

SELF-ASSESSMENTS:
- Psychological flexibility / relationship with emotions: ${aaq2Interp}
- Self-esteem and self-worth: ${rsesInterp}
- Self-awareness orientation: ${scsInterp}

RELATIONAL INTELLIGENCE FROM AI INTERVIEW:
- Repair capacity (ability to acknowledge ruptures and initiate healing): ${pillarBand(pillars?.repair)}
- Attunement (emotional presence and reading of others): ${pillarBand(pillars?.attunement)}
- Emotional regulation (managing own emotional intensity in conflict): ${pillarBand(pillars?.regulation)}
- Mentalizing (perspective-taking and holding uncertainty about others): ${pillarBand(pillars?.mentalizing)}
- Appreciation (recognizing and celebrating partner's emotional needs): ${pillarBand(pillars?.appreciation)}
- Accountability (owning contribution to relational difficulty): ${pillarBand(pillars?.accountability)}
- Commitment threshold (healthy persistence through difficulty with appropriate limits): ${pillarBand(pillars?.commitment_threshold)}
- Constructive communication (absence of contempt, criticism, and character attacks): ${pillarBand(pillars?.contempt)}

DEEPER BEHAVIORAL SIGNALS:
- Psychological maturity level: ${egoDevInterp}
- Emotion recognition ability: ${emotionInterp}
- Personal disclosure style when asked about own experience: ${attempt?.disclosureCalibration ?? 'not assessed'}
- Engagement with own personal narrative (grudges, conflicts): moment one — ${attempt?.moment4Concreteness ?? 'not assessed'}, moment two — ${attempt?.moment5Concreteness ?? 'not assessed'}
- Emotional vocabulary when discussing personal experience: ${vocabInterp}
- Psychological defense patterns observed: ${activeDefenses || 'none detected'}
- Overcertainty in understanding others: ${overcertaintyInterp}

Write the report with exactly these sections:

## Overview
3-4 sentences that capture the essence of this person's relational profile. This should feel like a portrait — warm, direct, and specific to their data. Mention their most notable strength and their most significant growth area.

## Your Relational Strengths
Write 3-4 strengths. For each strength use a ### heading with a meaningful name (not generic like "Strength 1"). Write 3-4 sentences per strength explaining what this capacity looks like, why it matters in relationships, and how it shows up in this person's specific profile. Be concrete and specific to their data — reference what the assessment revealed.

## Where You Have Room to Grow
Write 2-3 growth areas. For each use a ### heading. Write 3-4 sentences per area being honest about the pattern, what it tends to create in relationships, and what growth looks like without being prescriptive or harsh. Do not catastrophize — frame as developmental rather than deficit.

## Your Relationship Style
2-3 paragraphs describing how this person tends to show up in relationships — how they communicate, how they handle conflict, what they need from a partner, and what patterns they're likely to bring. This should feel like a rich character portrait drawing from the full profile.

## What Tends to Get in the Way
1-2 paragraphs describing the specific patterns — from both the self-assessments and the interview — that are most likely to create friction in close relationships. Be direct and specific. This is the most honest section of the report.

## Practical Steps Forward
4-5 concrete, actionable suggestions that are genuinely specific to this person's profile. These should not be generic self-help advice — they should follow directly from the specific patterns identified. Each suggestion should be 2-3 sentences.

## Closing
2-3 sentences that are warm, honest, and encouraging without being sycophantic. Acknowledge the courage it takes to do this kind of assessment work and speak to what this person has to offer in a relationship.`;
}

export async function generateUserReport(userId: string, prefetchedData?: ReportData): Promise<string> {
  const data = prefetchedData ?? (await fetchReportData(userId));

  const result = await invokeAnthropicMessages({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2500,
    system: buildSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildReportPrompt(data),
      },
    ],
  });

  const reportText = result.content?.[0]?.text;

  if (!reportText?.trim()) {
    throw new Error('No report content returned from Claude');
  }

  return reportText.trim();
}

export type ReportHtmlOptions = {
  userName: string | null;
  logoSrc: string;
  headerTitle?: string;
  headerSubtitle?: string;
  footerDisclaimer?: string;
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
  });
}

export function convertMarkdownToHtml(markdown: string, options: ReportHtmlOptions): string {
  const { userName, logoSrc, headerTitle, headerSubtitle, footerDisclaimer } = options;
  const lines = markdown.split('\n');
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
  const defaultFooter =
    'This report is based on validated scientific instruments and behavioral assessment conducted through the Amoraea platform. It is intended for personal reflection and growth, not clinical diagnosis. Results reflect patterns observed during your assessment and may not capture the full complexity of who you are as a person.';

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
