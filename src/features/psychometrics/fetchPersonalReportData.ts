import { supabase } from '@data/supabase/client';
import { buildReportDataFromRows, type ReportData } from './personalReportData';

export type { ReportData };

export async function fetchReportData(userId: string): Promise<ReportData> {
  const { data: attempt } = await supabase
    .from('interview_attempts')
    .select('id')
    .eq('user_id', userId)
    .or('is_phantom.eq.false,is_phantom.is.null')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!attempt?.id) {
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
        psychometric_straight_line_flags
      `,
      )
      .eq('id', userId)
      .maybeSingle();
    return buildReportDataFromRows(user, null);
  }
  return fetchReportDataForAttempt(attempt.id);
}

export async function fetchReportDataForAttempt(attemptId: string): Promise<ReportData> {
  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select(
      `
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
    `,
    )
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
      psychometric_straight_line_flags
    `,
    )
    .eq('id', attempt.user_id)
    .maybeSingle();

  return buildReportDataFromRows(user, attempt);
}
