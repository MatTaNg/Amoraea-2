import type { SupabaseClient } from '@supabase/supabase-js';

import {
  inferScenarioMessages,
  pickMessagesForScenarioScoring,
} from '@features/aria/interviewScenarioScoringSlice';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { hydrateScenarioScoresFromAttempt } from '@features/aria/hydrateScenarioScoresFromAttempt';
import { awaitInFlightScenarioScoring } from '@features/aria/scenarioScoringInFlight';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { scenarioDbBundleToScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import {
  fetchAttemptScenarioScoreCells,
  persistScenarioScoreBundleToAttempt,
  type ScenarioAttemptScoreBundle,
} from '@utilities/interviewAttemptScenarioPersistence';
import { scenarioScoreBundleIntact } from '@utilities/interviewResumeCursor';
import {
  loadInterviewFromStorage,
  mergeInterviewStoragePayload,
  saveInterviewToStorage,
  type StoredScenarioScores,
} from '@utilities/storage/InterviewStorage';
import { remoteLog } from '@utilities/remoteLog';
import { scenarioScoresMeaningful } from '@utilities/waitForInterviewAttemptScoringReady';
import { withRetry } from '@utilities/withRetry';
import { getSessionLogRuntime } from '@utilities/sessionLogging';

function scenarioCellForNumber(
  rowCells: NonNullable<Awaited<ReturnType<typeof fetchAttemptScenarioScoreCells>>>,
  scenarioNumber: 1 | 2 | 3,
): unknown {
  return scenarioNumber === 1
    ? rowCells.scenario_1_scores
    : scenarioNumber === 2
      ? rowCells.scenario_2_scores
      : rowCells.scenario_3_scores;
}

export function scenarioScoreResultToAttemptBundle(result: ScenarioScoreResult): ScenarioAttemptScoreBundle {
  return {
    pillarScores: result.pillarScores,
    pillarConfidence: result.pillarConfidence,
    keyEvidence: result.keyEvidence,
    scenarioName: result.scenarioName,
    mentalizing_inference_source: result.mentalizing_inference_source,
    mentalizing_overcertainty: result.mentalizing_overcertainty === true,
    contempt_tier_breakdown: result.contempt_tier_breakdown,
  };
}

export function scenarioScoreResultToStoredBundle(
  result: ScenarioScoreResult,
): NonNullable<StoredScenarioScores[number]> {
  return {
    pillarScores: result.pillarScores,
    pillarConfidence: result.pillarConfidence,
    keyEvidence: result.keyEvidence,
    scenarioName: result.scenarioName,
  };
}

export function scenarioHasAssessableScoreInRef(
  deps: ScoreInterviewDeps,
  scenarioNumber: 1 | 2 | 3,
): boolean {
  const result = deps.scenarioScoresRef.current[scenarioNumber];
  if (!result) return false;
  return scenarioScoreBundleIntact(scenarioNumber, {
    [scenarioNumber]: scenarioScoreResultToStoredBundle(result),
  });
}

export function listMissingAssessableScenarioScores(deps: ScoreInterviewDeps): Array<1 | 2 | 3> {
  return ([1, 2, 3] as const).filter((n) => !scenarioHasAssessableScoreInRef(deps, n));
}

/** Fill refs from local interview storage when DB hydrate left gaps. */
export async function hydrateScenarioScoresFromLocalStorage(deps: ScoreInterviewDeps): Promise<void> {
  if (!deps.userId) return;
  const saved = await loadInterviewFromStorage(deps.userId);
  if (!saved?.scenarioScores) return;
  for (const n of [1, 2, 3] as const) {
    if (scenarioHasAssessableScoreInRef(deps, n)) continue;
    const local = saved.scenarioScores[n];
    if (!scenarioScoreBundleIntact(n, { [n]: local ?? undefined })) continue;
    const hydrated = scenarioDbBundleToScenarioScoreResult(n, local);
    deps.scenarioScoresRef.current[n] = hydrated;
    deps.setScenarioScores((prev) => ({ ...prev, [n]: hydrated }));
  }
}

/** Persist intact in-memory bundles to DB (and local storage) without calling Claude. */
export async function flushIntactScenarioScoresRefToAttempt(
  deps: ScoreInterviewDeps,
  supabase: SupabaseClient,
): Promise<void> {
  const attemptId = deps.interviewSessionAttemptIdRef.current;
  const userId = deps.userId;
  if (!attemptId || !userId) return;

  const rowCells = await fetchAttemptScenarioScoreCells(supabase, attemptId);
  const localScoresPatch: StoredScenarioScores = {};
  let localPatchNeeded = false;

  for (const scenarioNumber of [1, 2, 3] as const) {
    const refScore = deps.scenarioScoresRef.current[scenarioNumber];
    if (!refScore || !scenarioHasAssessableScoreInRef(deps, scenarioNumber)) continue;

    const dbCell = rowCells ? scenarioCellForNumber(rowCells, scenarioNumber) : null;
    if (scenarioScoresMeaningful(dbCell)) continue;

    const bundle = scenarioScoreResultToAttemptBundle(refScore);
    try {
      await withRetry(
        async () => {
          const { error } = await persistScenarioScoreBundleToAttempt(supabase, {
            attemptId,
            userId,
            scenarioNumber,
            bundle,
          });
          if (error) throw error;
        },
        {
          retries: 2,
          baseDelay: 2000,
          maxDelay: 10000,
          context: `flush scenario ${scenarioNumber} scores to attempt`,
          sessionLog: {
            userId,
            attemptId: getSessionLogRuntime().attemptId,
            platform: getSessionLogRuntime().platform,
          },
        },
      );
      localScoresPatch[scenarioNumber] = scenarioScoreResultToStoredBundle(refScore);
      localPatchNeeded = true;
      void remoteLog('[STANDARD] flushed in-memory scenario score to DB (no rescore)', {
        scenarioNumber,
        attemptId,
      });
    } catch (err) {
      void remoteLog('[WARN] flush in-memory scenario score to DB failed', {
        scenarioNumber,
        attemptId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (localPatchNeeded) {
    const saved = await loadInterviewFromStorage(userId);
    if (saved) {
      await saveInterviewToStorage(
        userId,
        mergeInterviewStoragePayload(saved, {
          scenarioScores: { ...(saved.scenarioScores ?? {}), ...localScoresPatch },
        }),
      );
    }
  }
}

/**
 * Await parallel scoring, hydrate DB + local refs, flush intact bundles to DB.
 * Returns scenarios that still need Claude rescoring.
 */
export async function prepareScenarioScoresForCompletion(
  deps: ScoreInterviewDeps,
  supabase: SupabaseClient,
): Promise<Array<1 | 2 | 3>> {
  await awaitInFlightScenarioScoring();
  await hydrateScenarioScoresFromAttempt(deps, supabase);
  await hydrateScenarioScoresFromLocalStorage(deps);
  await flushIntactScenarioScoresRefToAttempt(deps, supabase);
  return listMissingAssessableScenarioScores(deps);
}

/** Rescore only scenarios still missing assessable bundles after hydrate/backfill. */
export async function rescoreMissingStandardScenarioScores(
  deps: ScoreInterviewDeps,
  finalMessages: MessageWithScenario[],
): Promise<void> {
  const missing = listMissingAssessableScenarioScores(deps);
  if (missing.length === 0) return;

  await remoteLog('[STANDARD] rescore scenarios still missing after hydrate/backfill (fallback only)', {
    missing,
  });

  await Promise.all(
    missing.map(async (scenarioNum) => {
      const taggedMessages = finalMessages.filter((m) => m.scenarioNumber === scenarioNum);
      const inferredMessages = inferScenarioMessages(finalMessages, scenarioNum);
      const messagesToScore = pickMessagesForScenarioScoring(finalMessages, scenarioNum);
      if (messagesToScore.length >= 2) {
        await deps.scoreScenario(scenarioNum, messagesToScore);
      } else {
        await remoteLog('[STANDARD] deferred persist: cannot rescore scenario (insufficient messages)', {
          scenarioNum,
          tagged: taggedMessages.length,
          inferred: inferredMessages.length,
          picked: messagesToScore.length,
        });
      }
    }),
  );

  const stillMissing = listMissingAssessableScenarioScores(deps);
  if (stillMissing.length > 0) {
    await remoteLog('[STANDARD] rescore attempt finished with missing scenarios', {
      missing: stillMissing,
    });
  }
}
