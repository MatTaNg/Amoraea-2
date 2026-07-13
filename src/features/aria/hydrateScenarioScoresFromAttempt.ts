import type { SupabaseClient } from '@supabase/supabase-js';

import { scenarioDbBundleToScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { fetchAttemptScenarioScoreCells } from '@utilities/interviewAttemptScenarioPersistence';
import { scenarioScoresMeaningful } from '@utilities/waitForInterviewAttemptScoringReady';

/** Fill in-memory scenario score refs from `interview_attempts` cells when refs are empty. */
export async function hydrateScenarioScoresFromAttempt(
  deps: ScoreInterviewDeps,
  supabase: SupabaseClient,
): Promise<void> {
  const aid = deps.interviewSessionAttemptIdRef.current;
  if (!aid || !deps.userId) return;
  const rowCells = await fetchAttemptScenarioScoreCells(supabase, aid);
  if (!rowCells) return;
  for (const n of [1, 2, 3] as const) {
    const cell =
      n === 1 ? rowCells.scenario_1_scores : n === 2 ? rowCells.scenario_2_scores : rowCells.scenario_3_scores;
    if (!deps.scenarioScoresRef.current[n] && scenarioScoresMeaningful(cell)) {
      const h = scenarioDbBundleToScenarioScoreResult(n, cell);
      deps.scenarioScoresRef.current[n] = h;
      deps.setScenarioScores((prev) => ({ ...prev, [n]: h }));
    }
  }
}
