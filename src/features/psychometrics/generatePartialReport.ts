import { supabase } from '@data/supabase/client';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import { invokeAnthropicMessages } from '@utilities/invokeAnthropicMessages';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { resolveReportParticipantDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import type { GamingCorrectionResult } from './computeGamingCorrection';
import { composeNarrativeCalibration } from '@features/reports/narrativeCalibration';
import { convertMarkdownToHtml, fetchReportData } from './generateReport';
import { getReportLogoSrc } from './reportBranding';
import {
  computePartialReportSourceHash,
  computePersonalReportSourceHash,
  loadStoredInterviewReports,
  readCachedReportMarkdownForPartialDownload,
  savePartialReportMarkdown,
} from './persistedInterviewReport';

export type PartialReportData = {
  user: { name: string | null };
  attempt: {
    pillarScores: Record<string, number> | null;
    egoDevLevel: number | null;
    emotionRecognitionScore: number | null;
    disclosureCalibration: string | null;
    moment4Concreteness: string | null;
    moment5Concreteness: string | null;
    vocabDensity: number | null;
    vocabLow: boolean | null;
    projection: boolean;
    splitting: boolean;
    rationalization: boolean;
    denial: boolean;
    mentalizing_overcertainty_count: number | null;
    aiSummary: string | null;
    aiStrengths: string[];
    finalGatePass: boolean | null;
    gateFailReasons: string[];
    gamingCorrection: GamingCorrectionResult | null;
    finalScore: number | null;
  } | null;
};

const PARTIAL_FOOTER =
  'This is a partial preview based on your AI interview conversation with Amoraea. Complete the self assessments in the app to unlock your full personal development report, including deeper psychological insights and compatibility analysis. This document is intended for personal reflection and growth, not clinical diagnosis.';

export async function fetchPartialReportData(userId: string): Promise<PartialReportData> {
  const { data: user } = await supabase
    .from('users')
    .select('name, basic_info, email')
    .eq('id', userId)
    .maybeSingle();

  const { data: attempt } = await supabase
    .from('interview_attempts')
    .select(
      `
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
      transcript,
      ai_reasoning,
      reasoning_pending,
      final_gate_pass,
      gate_fail_reasons,
      gaming_correction,
      modified_weighted_score_with_psychometrics,
      modified_weighted_score,
      weighted_score
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

  const aiReasoning =
    attempt?.ai_reasoning != null &&
    typeof attempt.ai_reasoning === 'object' &&
    !Array.isArray(attempt.ai_reasoning)
      ? (attempt.ai_reasoning as Record<string, unknown>)
      : null;

  const aiSummary =
    typeof aiReasoning?.overall_summary === 'string' ? aiReasoning.overall_summary.trim() : null;
  const aiStrengths = Array.isArray(aiReasoning?.overall_strengths)
    ? aiReasoning.overall_strengths.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];

  const gateFailReasons = Array.isArray(attempt?.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const gamingCorrection =
    attempt?.gaming_correction != null &&
    typeof attempt.gaming_correction === 'object' &&
    !Array.isArray(attempt.gaming_correction)
      ? (attempt.gaming_correction as GamingCorrectionResult)
      : null;

  return {
    user: { name: displayName },
    attempt: attempt
      ? {
          pillarScores: (attempt.pillar_scores as Record<string, number> | null) ?? null,
          egoDevLevel: attempt.ego_development_level ?? null,
          emotionRecognitionScore: attempt.emotion_recognition_score ?? null,
          disclosureCalibration: attempt.disclosure_calibration ?? null,
          moment4Concreteness: attempt.moment_4_concreteness ?? null,
          moment5Concreteness: attempt.moment_5_concreteness ?? null,
          vocabDensity: attempt.personal_moment_emotional_vocab_density ?? null,
          vocabLow: attempt.personal_moment_emotional_vocab_low ?? null,
          projection: defensePatterns?.projection_detected === true,
          splitting: defensePatterns?.splitting_detected === true,
          rationalization: defensePatterns?.rationalization_detected === true,
          denial: defensePatterns?.denial_detected === true,
          mentalizing_overcertainty_count: attempt.mentalizing_overcertainty_count ?? null,
          aiSummary,
          aiStrengths,
          finalGatePass: attempt.final_gate_pass ?? null,
          gateFailReasons,
          gamingCorrection,
          finalScore:
            attempt.modified_weighted_score_with_psychometrics ??
            attempt.modified_weighted_score ??
            attempt.weighted_score ??
            null,
        }
      : null,
  };
}

function buildPartialSystemPrompt(): string {
  return `You are generating a partial personal development preview for a user of Amoraea, a relationship-readiness platform. They have completed an AI-guided conversation but have NOT yet completed the self-assessment battery.

CRITICAL RULES — PARTIAL PREVIEW:
- Do NOT describe what the AI interview is designed to test or measure
- Do NOT use clinical diagnostic language
- Do NOT reference psychometric instruments or self-assessments they have not yet taken
- DO write in warm, direct, plain language a non-psychologist would understand
- DO use second person throughout ("you", "your")
- DO be honest about growth areas — constructive, not harsh
- DO be specific to the profile data — avoid generic advice
- DO frame insights as patterns observed in how they spoke about relationships and conflict
- DO tease that completing self assessments will unlock a fuller, richer report — without being salesy
- Format section headings with ## and subsection headings with ###
- Use **bold** for emphasis on key insights
- Write in flowing prose, not bullet lists
- Keep the report shorter than a full report — approximately 700-1000 words`;
}

function buildPartialReportPrompt(data: PartialReportData): string {
  const { user, attempt } = data;
  const pillars = attempt?.pillarScores ?? {};

  const band = (score: number | undefined | null): string => {
    if (score == null) return 'not assessed';
    if (score >= 8) return 'strong';
    if (score >= 7) return 'good';
    if (score >= 6) return 'developing';
    if (score >= 4) return 'needs attention';
    return 'significant growth area';
  };

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
    attempt?.projection && 'attributing own patterns to others',
    attempt?.splitting && 'black-and-white assignment of fault',
    attempt?.rationalization && 'logical justification to avoid accountability',
    attempt?.denial && 'claiming no conflict despite evidence',
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

  const narrativeHint =
    attempt?.aiSummary || attempt?.aiStrengths.length
      ? `
NARRATIVE HINTS FROM PRIOR ANALYSIS (use as inspiration only — rephrase in plain language, do not quote verbatim):
- Summary hint: ${attempt.aiSummary ?? 'none'}
- Strength hints: ${attempt.aiStrengths.length > 0 ? attempt.aiStrengths.join('; ') : 'none'}`
      : '';

  const narrativeCalibration = composeNarrativeCalibration({
    finalGatePass: attempt?.finalGatePass,
    gateFailReasons: attempt?.gateFailReasons ?? [],
    gamingCorrection: attempt?.gamingCorrection ?? null,
    pillarScores: attempt?.pillarScores ?? null,
    modifiedWeightedScore: attempt?.finalScore,
  });

  return `Generate a partial personal development preview for ${user.name ?? 'this user'}. This is based ONLY on their AI interview conversation — self-assessments are not yet complete. The report should feel genuinely insightful but must NOT reveal how Amoraea scores or structures the interview.

INTERVIEW-DERIVED SIGNALS (internal bands — translate into plain relational language in the report, never use these labels):
- Conflict recovery and repair: ${band(pillars?.repair)}
- Emotional presence and reading others: ${band(pillars?.attunement)}
- Managing emotional intensity in conflict: ${band(pillars?.regulation)}
- Perspective-taking and uncertainty about others: ${band(pillars?.mentalizing)}
- Recognizing partner's emotional needs: ${band(pillars?.appreciation)}
- Owning contribution to difficulty: ${band(pillars?.accountability)}
- Healthy persistence through difficulty: ${band(pillars?.commitment_threshold)}
- Constructive communication under stress: ${band(pillars?.contempt)}

DEEPER BEHAVIORAL SIGNALS:
- Psychological maturity level: ${egoDevInterp}
- Emotion recognition ability: ${emotionInterp}
- Personal disclosure style: ${attempt?.disclosureCalibration ?? 'not assessed'}
- Engagement with personal narrative: ${attempt?.moment4Concreteness ?? 'not assessed'} / ${attempt?.moment5Concreteness ?? 'not assessed'}
- Emotional vocabulary when discussing personal experience: ${vocabInterp}
- Defense patterns observed: ${activeDefenses || 'none detected'}
- Overcertainty about others' inner states: ${overcertaintyInterp}
${narrativeHint}

NARRATIVE CALIBRATION (follow exactly):
${narrativeCalibration}

Write the report with exactly these sections:

## Overview
2-3 sentences capturing how this person tends to show up in close relationships based on the conversation. Warm, direct, specific. Do not mention scores or assessment structure.

## What's Working Well For You
Write 2-3 strengths. For each use a ### heading with a meaningful name. Write 2-3 sentences per strength in plain language about relational patterns that came through positively.

## Where You Can Grow
Write 2 growth areas. For each use a ### heading. Write 2-3 sentences per area — honest about the pattern and what it tends to create in relationships, framed as developmental rather than deficit. Do not reveal what the interview measured.

## Practical Next Steps
3-4 concrete, actionable suggestions specific to this person's profile. Each 2 sentences. Follow directly from patterns identified above.

## What's Still to Come
1 short paragraph explaining that completing the self assessments (~10 minutes) will unlock a fuller personal report with deeper psychological insights, compatibility analysis, and a more complete picture. Encourage them without being salesy.

## Closing
2 sentences — warm, honest, encouraging. Acknowledge the courage of reflective conversation work.`;
}

export async function generatePartialUserReport(
  userId: string,
  prefetchedData?: PartialReportData,
): Promise<string> {
  const data = prefetchedData ?? (await fetchPartialReportData(userId));

  const result = await invokeAnthropicMessages({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1800,
    system: buildPartialSystemPrompt(),
    messages: [
      {
        role: 'user',
        content: buildPartialReportPrompt(data),
      },
    ],
  });

  const reportText = result.content?.[0]?.text;

  if (!reportText?.trim()) {
    throw new Error('No partial report content returned from Claude');
  }

  return reportText.trim();
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
        });
      }
      return convertMarkdownToHtml(cached.markdown, {
        userName: safeName,
        logoSrc,
        headerTitle: safeName ? `${safeName}'s Partial Report` : 'Your Partial Personal Report',
        headerSubtitle: 'Partial Personal Report',
        footerDisclaimer: PARTIAL_FOOTER,
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
  });
}
