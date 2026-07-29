import type { SupabaseClient } from '@supabase/supabase-js';

import { personalMomentBundleWasScored } from '@features/aria/interviewCompletionGate';
import { fetchAttemptScenarioScoreCells } from '@utilities/interviewAttemptScenarioPersistence';
import { scenarioScoreBundleIntact } from '@utilities/interviewResumeCursor';
import type { StoredScenarioScores } from '@utilities/storage/InterviewStorage';

/** Merge assessable DB scenario score cells over local storage (local wins when already intact). */
export function mergeLocalAndDbScenarioScores(params: {
  local: StoredScenarioScores | undefined;
  dbCells: {
    scenario_1_scores: unknown;
    scenario_2_scores: unknown;
    scenario_3_scores: unknown;
  } | null;
}): StoredScenarioScores {
  const out: StoredScenarioScores = { ...(params.local ?? {}) };
  if (!params.dbCells) return out;
  const map: Array<[1 | 2 | 3, unknown]> = [
    [1, params.dbCells.scenario_1_scores],
    [2, params.dbCells.scenario_2_scores],
    [3, params.dbCells.scenario_3_scores],
  ];
  for (const [n, raw] of map) {
    if (scenarioScoreBundleIntact(n, out)) continue;
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const bundle = raw as NonNullable<StoredScenarioScores[1]>;
    const probe: StoredScenarioScores = { [n]: bundle };
    if (scenarioScoreBundleIntact(n, probe)) {
      out[n] = bundle;
    }
  }
  return out;
}

export async function fetchResumeScoringIntegritySnapshot(
  supabase: SupabaseClient,
  attemptId: string | null | undefined,
  userId: string | null | undefined,
): Promise<{
  dbScenarioScores: StoredScenarioScores;
  moment4ScoresIntact: boolean | null;
  dbSkipCount: number | null;
}> {
  if (!attemptId || !userId) {
    return { dbScenarioScores: {}, moment4ScoresIntact: null, dbSkipCount: null };
  }
  const [cells, attemptRow] = await Promise.all([
    fetchAttemptScenarioScoreCells(supabase, attemptId),
    supabase
      .from('interview_attempts')
      .select('scenario_specific_patterns, skip_count')
      .eq('id', attemptId)
      .eq('user_id', userId)
      .maybeSingle(),
  ]);
  const dbScenarioScores = mergeLocalAndDbScenarioScores({ local: {}, dbCells: cells });
  const patterns = attemptRow.data?.scenario_specific_patterns;
  let moment4ScoresIntact: boolean | null = null;
  if (patterns != null && typeof patterns === 'object' && !Array.isArray(patterns)) {
    const m4 = (patterns as Record<string, unknown>).moment_4_scores;
    moment4ScoresIntact = personalMomentBundleWasScored(m4);
  } else if (attemptRow.data) {
    moment4ScoresIntact = false;
  }
  const rawSkip = attemptRow.data?.skip_count;
  const dbSkipCount =
    typeof rawSkip === 'number' && Number.isFinite(rawSkip)
      ? rawSkip
      : typeof rawSkip === 'string' && rawSkip.trim() !== ''
        ? Number.parseInt(rawSkip, 10)
        : null;
  return {
    dbScenarioScores,
    moment4ScoresIntact,
    dbSkipCount: dbSkipCount != null && Number.isFinite(dbSkipCount) ? dbSkipCount : null,
  };
}
