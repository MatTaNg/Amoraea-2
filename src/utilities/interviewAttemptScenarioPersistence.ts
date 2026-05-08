import type { SupabaseClient } from '@supabase/supabase-js';
import type { ContemptTierBreakdown } from '@features/aria/contemptExpressionScoringRubric';
import type { MentalizingInferenceSource } from '@features/aria/scenarioInferenceSourceCalibration';

/** Stored JSON shape for `interview_attempts.scenario_N_scores` columns. */
export type ScenarioAttemptScoreBundle = {
  pillarScores: Record<string, number | null>;
  pillarConfidence: Record<string, string>;
  keyEvidence: Record<string, string>;
  scenarioName?: string;
  mentalizing_inference_source?: MentalizingInferenceSource;
  contempt_tier_breakdown?: ContemptTierBreakdown | null;
};

export async function persistScenarioScoreBundleToAttempt(
  client: SupabaseClient,
  params: { attemptId: string; userId: string; scenarioNumber: 1 | 2 | 3; bundle: ScenarioAttemptScoreBundle },
): Promise<{ error: Error | null }> {
  const col =
    params.scenarioNumber === 1
      ? 'scenario_1_scores'
      : params.scenarioNumber === 2
        ? 'scenario_2_scores'
        : 'scenario_3_scores';
  const { error } = await client
    .from('interview_attempts')
    .update({ [col]: params.bundle })
    .eq('id', params.attemptId)
    .eq('user_id', params.userId);
  return { error: error ? new Error(error.message) : null };
}

export async function fetchAttemptScenarioScoreCells(
  client: SupabaseClient,
  attemptId: string,
): Promise<{
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
} | null> {
  const { data, error } = await client
    .from('interview_attempts')
    .select('scenario_1_scores, scenario_2_scores, scenario_3_scores')
    .eq('id', attemptId)
    .maybeSingle();
  if (error || !data) return null;
  return data as {
    scenario_1_scores: unknown;
    scenario_2_scores: unknown;
    scenario_3_scores: unknown;
  };
}
