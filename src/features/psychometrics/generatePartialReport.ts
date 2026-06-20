import { supabase } from '@data/supabase/client';
import { resolveAttemptPillarScoresForReport } from '@features/onboarding/loadInterviewReportAttempt';
import { fetchMostRecentCompletedInterviewAttemptId } from '@features/psychometrics/interviewCompletionStatus';
import {
  averageNonNull,
  parseKeyEvidenceFromStoredSlice,
  parseMentalizingFromStoredSlice,
  parseMoment5ProfileFromStoredPatterns,
  type PersonalReportMentalizingProfile,
  type PersonalReportScenarioKeyEvidence,
} from './personalReportNarrativeGuidance';
import { invokeAnthropicReportNarrativeWithStructuralValidation } from '@features/reports/invokeValidatedReportNarrative';
import { buildScenarioScoreGroundingFromAttemptRows } from '@features/reports/scenarioScoreGrounding';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { resolveReportParticipantDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import type { GamingCorrectionResult } from './computeGamingCorrection';
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
  parseMoment4ProfileFromStoredPatterns,
  type PartialReportData,
} from './partialReportPrompt';
import {
  buildPersonalReportEvidenceInventory,
  logLiveNarrativePrompt,
  logNarrativeEvidenceAudit,
} from '@features/reports/narrativeEvidenceAudit';

export type { PartialReportData } from './partialReportPrompt';
export { buildPartialReportPrompt, buildPartialSystemPrompt } from './partialReportPrompt';

const PARTIAL_FOOTER =
  `${REPORT_FOOTER_DISCLAIMER} This is a partial preview based on your AI interview conversation only — complete the self assessments in the app to unlock your full personal development report.`;

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
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      scenario_specific_patterns,
      skip_count,
      ego_development_level,
      language_markers,
      emotion_recognition_score,
      disclosure_calibration,
      moment_4_concreteness,
      moment_5_concreteness,
      personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low,
      defense_patterns,
      mentalizing_overcertainty_count,
      skip_penalty_total,
      auto_failed,
      passed,
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

  const resolvedPillars = attempt ? resolveAttemptPillarScoresForReport(attempt) : null;
  const patterns = (attempt?.scenario_specific_patterns as Record<string, unknown> | null) ?? null;
  const m4Raw = patterns?.moment_4_scores ?? null;
  const s1M = parseMentalizingFromStoredSlice(attempt?.scenario_1_scores);
  const s2M = parseMentalizingFromStoredSlice(attempt?.scenario_2_scores);
  const s3M = parseMentalizingFromStoredSlice(attempt?.scenario_3_scores);
  const m4M = parseMentalizingFromStoredSlice(m4Raw);
  const scenarioAverage = averageNonNull([s1M.mentalizing, s2M.mentalizing, s3M.mentalizing]);
  const moment4GapFromScenarioAverage =
    scenarioAverage != null && m4M.mentalizing != null
      ? scenarioAverage - m4M.mentalizing
      : null;
  const holisticMentalizing =
    typeof resolvedPillars?.mentalizing === 'number' ? resolvedPillars.mentalizing : null;
  const moment4Profile = parseMoment4ProfileFromStoredPatterns(patterns);
  const moment5Profile = parseMoment5ProfileFromStoredPatterns(patterns);
  const scenarioKeyEvidence: PersonalReportScenarioKeyEvidence | null = attempt
    ? {
        scenario1: parseKeyEvidenceFromStoredSlice(attempt.scenario_1_scores),
        scenario2: parseKeyEvidenceFromStoredSlice(attempt.scenario_2_scores),
        scenario3: parseKeyEvidenceFromStoredSlice(attempt.scenario_3_scores),
      }
    : null;
  const hasScenarioKeyEvidence =
    scenarioKeyEvidence != null &&
    (scenarioKeyEvidence.scenario1 != null ||
      scenarioKeyEvidence.scenario2 != null ||
      scenarioKeyEvidence.scenario3 != null);
  const mentalizingProfile: PersonalReportMentalizingProfile | null = attempt
    ? {
        scenario1: s1M.mentalizing,
        scenario2: s2M.mentalizing,
        scenario3: s3M.mentalizing,
        moment4: m4M.mentalizing,
        holisticPillar: holisticMentalizing,
        scenarioAverage,
        moment4GapFromScenarioAverage,
        keyEvidence: {
          scenario1: s1M.keyEvidenceMentalizing,
          scenario2: s2M.keyEvidenceMentalizing,
          scenario3: s3M.keyEvidenceMentalizing,
          moment4: m4M.keyEvidenceMentalizing,
        },
      }
    : null;

  const rollupTrusted =
    attempt != null &&
    typeof attempt.weighted_score === 'number' &&
    Number.isFinite(attempt.weighted_score);

  return {
    user: { name: displayName },
    attempt: attempt
      ? {
          pillarScores: resolvedPillars,
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
          finalGatePass: rollupTrusted ? (attempt.final_gate_pass ?? null) : null,
          gateFailReasons: rollupTrusted ? gateFailReasons : [],
          gamingCorrection,
          finalScore: rollupTrusted
            ? (attempt.modified_weighted_score_with_psychometrics ??
              attempt.modified_weighted_score ??
              attempt.weighted_score ??
              null)
            : null,
          mentalizingProfile,
          moment4Profile,
          moment5Profile,
          scenarioKeyEvidence: hasScenarioKeyEvidence ? scenarioKeyEvidence : null,
          scenarioScoreGrounding: buildScenarioScoreGroundingFromAttemptRows(attempt),
        }
      : null,
  };
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