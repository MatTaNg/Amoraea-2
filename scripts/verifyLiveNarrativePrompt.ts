/**
 * Build fully interpolated report prompts (no API call) and verify verbatim instructions.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/verifyLiveNarrativePrompt.ts personal_full <attemptId>
 */
import { createClient } from '@supabase/supabase-js';
import {
  buildReportPrompt,
  buildSystemPrompt,
} from '../src/features/psychometrics/personalReportPrompt';
import { buildReportDataFromRows } from '../src/features/psychometrics/personalReportData';
import {
  PSYCHOMETRIC_INTEGRATION_INSTRUCTION,
  SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION,
} from '../src/features/reports/narrativeCalibration';
import { verifyLiveNarrativePromptStrings } from '../src/features/reports/narrativeEvidenceAudit';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const ATTEMPT_SELECT = `
  user_id,
  weighted_score,
  depth_signal_modifier,
  score_modifier,
  modified_weighted_score_with_psychometrics,
  modified_weighted_score,
  passed,
  final_gate_pass,
  gate_fail_reasons,
  gaming_correction,
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
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  transcript
`;

async function fetchReportDataForAttemptScript(attemptId: string) {
  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .eq('id', attemptId)
    .maybeSingle();
  if (error || !attempt?.user_id) {
    throw new Error(error?.message ?? `Attempt not found: ${attemptId}`);
  }
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
      psychometric_modifier,
      psychometrics_brs_score,
      psychometrics_scs_sf_score,
      psychometrics_scs_sf_self_kindness_score,
      psychometrics_scs_sf_common_humanity_score,
      psychometrics_scs_sf_mindfulness_score,
      psychometrics_mspss_score,
      psychometrics_mspss_family_score,
      psychometrics_mspss_friends_score,
      psychometrics_rfq_score,
      psychometrics_gasp_score,
      psychometrics_dweck_score,
      psychometric_straight_line_flags
    `,
    )
    .eq('id', attempt.user_id)
    .maybeSingle();
  return buildReportDataFromRows(user, attempt);
}

async function main(): Promise<void> {
  const attemptId = process.argv[2] ?? '37b1ec35-7ad2-46b9-af75-315f762be109';
  const reportData = await fetchReportDataForAttemptScript(attemptId);
  const system = buildSystemPrompt();
  const userPrompt = buildReportPrompt(reportData);
  const pipeline = 'personal_full_report';

  const verification = verifyLiveNarrativePromptStrings(system, userPrompt);
  console.log('\n=== Live prompt verification ===');
  console.log('pipeline:', pipeline);
  console.log('attemptId:', attemptId);
  console.log('charCount:', system.length + userPrompt.length);
  console.log('hasScenarioPersonalCrossrefInstruction:', verification.hasScenarioPersonalCrossrefInstruction);
  console.log('hasPsychometricIntegrationInstruction:', verification.hasPsychometricIntegrationInstruction);
  console.log('hasSectionDistinctnessInstruction:', verification.hasSectionDistinctnessInstruction);

  const calIdx = userPrompt.indexOf('MANDATORY NARRATIVE CONNECTIONS');
  if (calIdx >= 0) {
    console.log('\n--- MANDATORY NARRATIVE CONNECTIONS excerpt ---');
    console.log(userPrompt.slice(calIdx, calIdx + 1600));
  }

  const distinctIdx = userPrompt.indexOf('SECTION DISTINCTNESS');
  if (distinctIdx >= 0) {
    console.log('\n--- SECTION DISTINCTNESS excerpt ---');
    console.log(userPrompt.slice(distinctIdx, distinctIdx + 1200));
  }

  const ok =
    verification.hasScenarioPersonalCrossrefInstruction &&
    verification.hasPsychometricIntegrationInstruction &&
    verification.hasSectionDistinctnessInstruction &&
    userPrompt.includes(SCENARIO_PERSONAL_PATTERN_CROSSREF_INSTRUCTION) &&
    userPrompt.includes(PSYCHOMETRIC_INTEGRATION_INSTRUCTION) &&
    userPrompt.includes('STRUCTURAL NARRATIVE ENFORCEMENT') &&
    userPrompt.includes('CONSTRUCT TENSION RECONCILIATION') &&
    userPrompt.includes('GROWTH HEADER CONSOLIDATION');

  if (!ok) {
    console.error('\nFAIL: one or more required instructions missing from live interpolated prompt.');
    process.exit(1);
  }
  console.log('\nOK: required instructions present in live interpolated prompt.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
