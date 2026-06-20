/**
 * Regenerate and persist partial report for a user (latest completed attempt).
 * Usage: npx tsx --env-file=.env scripts/regenerate-partial-report.ts <userId>
 */
import { createClient } from '@supabase/supabase-js';
import { resolvePillarScoresForNarrativeFromAttempt } from '../src/features/aria/resolvePillarScoresForNarrative';
import {
  buildPartialReportPrompt,
  buildPartialSystemPrompt,
  type PartialReportData,
} from '../src/features/psychometrics/partialReportPrompt';
import { computePartialReportSourceHash } from '../src/features/psychometrics/persistedInterviewReportLogic';
import { REPORT_NARRATIVE_TOKEN_BUDGETS } from '../src/utilities/reportNarrativeGeneration';
import {
  averageNonNull,
  parseKeyEvidenceFromStoredSlice,
  parseMentalizingFromStoredSlice,
  parseMoment5ProfileFromStoredPatterns,
  parsePillarScoresFromStoredSlice,
  type PersonalReportMentalizingProfile,
  type PersonalReportMoment5Profile,
  type PersonalReportScenarioKeyEvidence,
} from '../src/features/psychometrics/personalReportNarrativeGuidance';
import type { GamingCorrectionResult } from '../src/features/psychometrics/computeGamingCorrection';
import { resolveReportParticipantDisplayName } from '../src/utilities/adminInterviewIntroDisplayName';
import {
  getAnthropicEndpointForScript,
  getAnthropicHeadersForScript,
} from './lib/anthropicScriptClient';

const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx --env-file=.env scripts/regenerate-partial-report.ts <userId>');
  process.exit(1);
}

const supabase = createClient(url, key);

function parseMoment4ProfileFromStoredPatterns(
  patterns: Record<string, unknown> | null | undefined,
): PersonalReportMoment5Profile | null {
  const m4Raw = patterns?.moment_4_scores;
  if (m4Raw == null) return null;
  const pillarScores = parsePillarScoresFromStoredSlice(m4Raw);
  const keyEvidence = parseKeyEvidenceFromStoredSlice(m4Raw);
  if (!pillarScores && !keyEvidence) return null;
  return { pillarScores, keyEvidence };
}

async function fetchPartialReportDataForUser(uid: string): Promise<{
  data: PartialReportData;
  attemptId: string;
}> {
  const { data: user } = await supabase.from('users').select('name, basic_info, email').eq('id', uid).maybeSingle();
  const { data: attempt } = await supabase
    .from('interview_attempts')
    .select(
      `
      id,
      pillar_scores,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      scenario_specific_patterns,
      ego_development_level,
      emotion_recognition_score,
      disclosure_calibration,
      moment_4_concreteness,
      moment_5_concreteness,
      personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low,
      defense_patterns,
      mentalizing_overcertainty_count,
      passed,
      transcript,
      ai_reasoning,
      final_gate_pass,
      gate_fail_reasons,
      gaming_correction,
      modified_weighted_score_with_psychometrics,
      modified_weighted_score,
      weighted_score
    `,
    )
    .eq('user_id', uid)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt?.id) throw new Error('No completed attempt for user');

  const defensePatterns = (attempt.defense_patterns as Record<string, boolean> | null) ?? null;
  const displayName = resolveReportParticipantDisplayName({
    name: user?.name,
    basic_info: user?.basic_info,
    transcript: attempt.transcript ?? null,
    email: user?.email,
  });
  const aiReasoning =
    attempt.ai_reasoning != null && typeof attempt.ai_reasoning === 'object' && !Array.isArray(attempt.ai_reasoning)
      ? (attempt.ai_reasoning as Record<string, unknown>)
      : null;
  const aiSummary = typeof aiReasoning?.overall_summary === 'string' ? aiReasoning.overall_summary.trim() : null;
  const aiStrengths = Array.isArray(aiReasoning?.overall_strengths)
    ? aiReasoning.overall_strengths.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const gateFailReasons = Array.isArray(attempt.gate_fail_reasons)
    ? (attempt.gate_fail_reasons as unknown[]).filter((x): x is string => typeof x === 'string')
    : [];
  const gamingCorrection =
    attempt.gaming_correction != null &&
    typeof attempt.gaming_correction === 'object' &&
    !Array.isArray(attempt.gaming_correction)
      ? (attempt.gaming_correction as GamingCorrectionResult)
      : null;
  const resolvedPillars = resolvePillarScoresForNarrativeFromAttempt(attempt).pillar_scores;
  const patterns = (attempt.scenario_specific_patterns as Record<string, unknown> | null) ?? null;
  const m4Raw = patterns?.moment_4_scores ?? null;
  const s1M = parseMentalizingFromStoredSlice(attempt.scenario_1_scores);
  const s2M = parseMentalizingFromStoredSlice(attempt.scenario_2_scores);
  const s3M = parseMentalizingFromStoredSlice(attempt.scenario_3_scores);
  const m4M = parseMentalizingFromStoredSlice(m4Raw);
  const scenarioAverage = averageNonNull([s1M.mentalizing, s2M.mentalizing, s3M.mentalizing]);
  const moment4GapFromScenarioAverage =
    scenarioAverage != null && m4M.mentalizing != null ? scenarioAverage - m4M.mentalizing : null;
  const holisticMentalizing = typeof resolvedPillars?.mentalizing === 'number' ? resolvedPillars.mentalizing : null;
  const moment4Profile = parseMoment4ProfileFromStoredPatterns(patterns);
  const moment5Profile = parseMoment5ProfileFromStoredPatterns(patterns);
  const scenarioKeyEvidence: PersonalReportScenarioKeyEvidence = {
    scenario1: parseKeyEvidenceFromStoredSlice(attempt.scenario_1_scores),
    scenario2: parseKeyEvidenceFromStoredSlice(attempt.scenario_2_scores),
    scenario3: parseKeyEvidenceFromStoredSlice(attempt.scenario_3_scores),
  };
  const hasScenarioKeyEvidence =
    scenarioKeyEvidence.scenario1 != null ||
    scenarioKeyEvidence.scenario2 != null ||
    scenarioKeyEvidence.scenario3 != null;
  const mentalizingProfile: PersonalReportMentalizingProfile = {
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
  };
  const rollupTrusted =
    typeof attempt.weighted_score === 'number' && Number.isFinite(attempt.weighted_score);

  return {
    attemptId: attempt.id,
    data: {
      user: { name: displayName },
      attempt: {
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
      },
    },
  };
}

async function callAnthropic(system: string, userPrompt: string): Promise<string> {
  const res = await fetch(getAnthropicEndpointForScript(), {
    method: 'POST',
    headers: getAnthropicHeadersForScript(),
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: REPORT_NARRATIVE_TOKEN_BUDGETS.personal_partial_report.initial,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

async function main(): Promise<void> {
  const { data, attemptId } = await fetchPartialReportDataForUser(userId);
  const markdown = await callAnthropic(buildPartialSystemPrompt(), buildPartialReportPrompt(data));
  const hash = computePartialReportSourceHash(data);
  const { error } = await supabase
    .from('interview_attempts')
    .update({
      partial_report_markdown: markdown,
      partial_report_source_hash: hash,
      partial_report_generated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) throw error;
  console.log('attempt_id:', attemptId);
  console.log('---PARTIAL_REPORT_START---');
  console.log(markdown);
  console.log('---PARTIAL_REPORT_END---');
  const liveBehaviorHits = [
    /when it shows up in a real relationship/i,
    /in a real relationship/i,
    /under live conflict/i,
    /in the heat of the moment/i,
  ].filter((re) => re.test(markdown));
  console.log('live-behavior phrase hits:', liveBehaviorHits.length ? liveBehaviorHits.map(String) : 'none');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
