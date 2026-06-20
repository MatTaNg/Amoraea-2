import { resolveReportParticipantDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import type { GamingCorrectionResult } from './computeGamingCorrection';
import {
  averageNonNull,
  parseKeyEvidenceFromStoredSlice,
  parseMentalizingFromStoredSlice,
  parseMoment5ProfileFromStoredPatterns,
  type PersonalReportMentalizingProfile,
  type PersonalReportMoment5Profile,
  type PersonalReportScenarioKeyEvidence,
} from './personalReportNarrativeGuidance';
import {
  buildScenarioScoreGroundingFromAttemptRows,
  type ScenarioScoreGrounding,
} from '@features/reports/scenarioScoreGrounding';
import {
  parsePsychometricStraightLineFlags,
  type PersonalReportPsychometricScores,
} from './personalReportPsychometricSections';

export type {
  PersonalReportMentalizingProfile,
  PersonalReportMoment5Profile,
  PersonalReportScenarioKeyEvidence,
  PersonalReportPsychometricScores,
};

export interface ReportData {
  user: {
    name: string | null;
    aaq2Score: number | null;
    rsesScore: number | null;
    scsPublicScore: number | null;
    scsPrivateScore: number | null;
    psychometricModifier: number | null;
    psychometrics: PersonalReportPsychometricScores;
    psychometricStraightLineFlags: string[];
  };
  attempt: {
    weightedScore: number | null;
    depthSignalModifier: number | null;
    finalScore: number | null;
    passed: boolean | null;
    finalGatePass: boolean | null;
    gateFailReasons: string[];
    gamingCorrection: GamingCorrectionResult | null;
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
    mentalizingProfile: PersonalReportMentalizingProfile | null;
    moment5Profile: PersonalReportMoment5Profile | null;
    scenarioKeyEvidence: PersonalReportScenarioKeyEvidence | null;
    scenarioScoreGrounding: ScenarioScoreGrounding | null;
  } | null;
}

export function buildReportDataFromRows(
  user: {
    name?: string | null;
    basic_info?: unknown;
    email?: string | null;
    psychometrics_aaq2_score?: number | null;
    psychometrics_rses_score?: number | null;
    psychometrics_scs_public_score?: number | null;
    psychometrics_scs_private_score?: number | null;
    psychometric_modifier?: number | null;
    psychometrics_brs_score?: number | null;
    psychometrics_scs_sf_score?: number | null;
    psychometrics_scs_sf_self_kindness_score?: number | null;
    psychometrics_scs_sf_common_humanity_score?: number | null;
    psychometrics_scs_sf_mindfulness_score?: number | null;
    psychometrics_mspss_score?: number | null;
    psychometrics_mspss_family_score?: number | null;
    psychometrics_mspss_friends_score?: number | null;
    psychometrics_rfq_score?: number | null;
    psychometrics_gasp_score?: number | null;
    psychometrics_dweck_score?: number | null;
    psychometric_straight_line_flags?: unknown;
  } | null,
  attempt: {
    weighted_score?: number | null;
    depth_signal_modifier?: number | null;
    score_modifier?: number | null;
    modified_weighted_score_with_psychometrics?: number | null;
    modified_weighted_score?: number | null;
    passed?: boolean | null;
    final_gate_pass?: boolean | null;
    gate_fail_reasons?: unknown;
    gaming_correction?: GamingCorrectionResult | null;
    pillar_scores?: unknown;
    ego_development_level?: number | null;
    emotion_recognition_score?: number | null;
    disclosure_calibration?: string | null;
    moment_4_concreteness?: string | null;
    moment_5_concreteness?: string | null;
    personal_moment_emotional_vocab_density?: number | null;
    personal_moment_emotional_vocab_low?: boolean | null;
    defense_patterns?: unknown;
    mentalizing_overcertainty_count?: number | null;
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
    scenario_specific_patterns?: unknown;
    transcript?: unknown;
  } | null,
): ReportData {
  const defensePatterns = (attempt?.defense_patterns as Record<string, boolean> | null) ?? null;
  const displayName = resolveReportParticipantDisplayName({
    name: user?.name,
    basic_info: user?.basic_info,
    transcript: attempt?.transcript ?? null,
    email: user?.email,
  });

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
    typeof (attempt?.pillar_scores as Record<string, number> | null)?.mentalizing === 'number'
      ? (attempt!.pillar_scores as Record<string, number>).mentalizing
      : null;
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

  const gateFailReasons = Array.isArray(attempt?.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const gamingCorrection =
    attempt?.gaming_correction != null &&
    typeof attempt.gaming_correction === 'object' &&
    !Array.isArray(attempt.gaming_correction)
      ? (attempt.gaming_correction as GamingCorrectionResult)
      : null;

  const rollupTrusted =
    attempt != null &&
    typeof attempt.weighted_score === 'number' &&
    Number.isFinite(attempt.weighted_score);

  return {
    user: {
      name: displayName,
      aaq2Score: user?.psychometrics_aaq2_score ?? null,
      rsesScore: user?.psychometrics_rses_score ?? null,
      scsPublicScore: user?.psychometrics_scs_public_score ?? null,
      scsPrivateScore: user?.psychometrics_scs_private_score ?? null,
      psychometricModifier: user?.psychometric_modifier ?? null,
      psychometrics: {
        brsScore:
          typeof user?.psychometrics_brs_score === 'number' ? user.psychometrics_brs_score : null,
        scsSfScore:
          typeof user?.psychometrics_scs_sf_score === 'number'
            ? user.psychometrics_scs_sf_score
            : null,
        scsSfSelfKindnessScore:
          typeof user?.psychometrics_scs_sf_self_kindness_score === 'number'
            ? user.psychometrics_scs_sf_self_kindness_score
            : null,
        scsSfCommonHumanityScore:
          typeof user?.psychometrics_scs_sf_common_humanity_score === 'number'
            ? user.psychometrics_scs_sf_common_humanity_score
            : null,
        scsSfMindfulnessScore:
          typeof user?.psychometrics_scs_sf_mindfulness_score === 'number'
            ? user.psychometrics_scs_sf_mindfulness_score
            : null,
        mspssScore:
          typeof user?.psychometrics_mspss_score === 'number' ? user.psychometrics_mspss_score : null,
        mspssFamilyScore:
          typeof user?.psychometrics_mspss_family_score === 'number'
            ? user.psychometrics_mspss_family_score
            : null,
        mspssFriendsScore:
          typeof user?.psychometrics_mspss_friends_score === 'number'
            ? user.psychometrics_mspss_friends_score
            : null,
        rfqScore:
          typeof user?.psychometrics_rfq_score === 'number' ? user.psychometrics_rfq_score : null,
        gaspScore:
          typeof user?.psychometrics_gasp_score === 'number' ? user.psychometrics_gasp_score : null,
        dweckScore:
          typeof user?.psychometrics_dweck_score === 'number' ? user.psychometrics_dweck_score : null,
        rsesScore: user?.psychometrics_rses_score ?? null,
      },
      psychometricStraightLineFlags: parsePsychometricStraightLineFlags(
        user?.psychometric_straight_line_flags,
      ),
    },
    attempt: attempt
      ? {
          weightedScore: attempt.weighted_score ?? null,
          depthSignalModifier: attempt.depth_signal_modifier ?? attempt.score_modifier ?? null,
          finalScore: rollupTrusted
            ? (attempt.modified_weighted_score_with_psychometrics ??
              attempt.modified_weighted_score ??
              attempt.weighted_score ??
              null)
            : null,
          passed: rollupTrusted ? (attempt.passed ?? null) : null,
          finalGatePass: rollupTrusted ? (attempt.final_gate_pass ?? null) : null,
          gateFailReasons: rollupTrusted ? gateFailReasons : [],
          gamingCorrection,
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
          mentalizingProfile,
          moment5Profile,
          scenarioKeyEvidence: hasScenarioKeyEvidence ? scenarioKeyEvidence : null,
          scenarioScoreGrounding: buildScenarioScoreGroundingFromAttemptRows(attempt),
        }
      : null,
  };
}
