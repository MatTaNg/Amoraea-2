import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveAttemptPillarScoresForReport } from '@features/onboarding/loadInterviewReportAttempt';
import { buildScenarioScoreGroundingFromAttemptRows } from '@features/reports/scenarioScoreGrounding';
import { resolveReportParticipantDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import type { GamingCorrectionResult } from './computeGamingCorrection';
import {
  parseMoment4ProfileFromStoredPatterns,
  type PartialReportData,
} from './partialReportPrompt';
import {
  averageNonNull,
  parseKeyEvidenceFromStoredSlice,
  parseMentalizingFromStoredSlice,
  parseMoment5ProfileFromStoredPatterns,
  type PersonalReportMentalizingProfile,
  type PersonalReportScenarioKeyEvidence,
} from './personalReportNarrativeGuidance';

export type { PartialReportData };

export type PartialReportFetchResult = {
  data: PartialReportData;
  attemptId: string | null;
};

export const PARTIAL_REPORT_ATTEMPT_SELECT = `
  id,
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
`;

export type PartialReportUserRow = {
  name?: string | null;
  basic_info?: unknown;
  email?: string | null;
};

export type PartialReportAttemptRow = {
  id?: string;
  pillar_scores?: unknown;
  scenario_1_scores?: unknown;
  scenario_2_scores?: unknown;
  scenario_3_scores?: unknown;
  scenario_specific_patterns?: unknown;
  skip_count?: number | string | null;
  ego_development_level?: number | null;
  language_markers?: unknown;
  emotion_recognition_score?: number | null;
  disclosure_calibration?: string | null;
  moment_4_concreteness?: string | null;
  moment_5_concreteness?: string | null;
  personal_moment_emotional_vocab_density?: number | null;
  personal_moment_emotional_vocab_low?: boolean | null;
  defense_patterns?: unknown;
  mentalizing_overcertainty_count?: number | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  passed?: boolean | null;
  transcript?: unknown;
  ai_reasoning?: unknown;
  reasoning_pending?: boolean | null;
  final_gate_pass?: boolean | null;
  gate_fail_reasons?: unknown;
  gaming_correction?: unknown;
  modified_weighted_score_with_psychometrics?: number | null;
  modified_weighted_score?: number | null;
  weighted_score?: number | null;
};

/** Pure assembly — shared by app client and admin scripts. */
export function buildPartialReportDataFromRows(
  user: PartialReportUserRow | null,
  attempt: PartialReportAttemptRow | null,
): PartialReportData {
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

export async function fetchPartialReportDataForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<PartialReportFetchResult> {
  const { data: user } = await supabase
    .from('users')
    .select('name, basic_info, email')
    .eq('id', userId)
    .maybeSingle();

  const { data: attempt } = await supabase
    .from('interview_attempts')
    .select(PARTIAL_REPORT_ATTEMPT_SELECT)
    .eq('user_id', userId)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    data: buildPartialReportDataFromRows(user, attempt),
    attemptId: typeof attempt?.id === 'string' ? attempt.id : null,
  };
}
