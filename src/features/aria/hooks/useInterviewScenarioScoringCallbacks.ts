import { useCallback, useEffect } from 'react';

import { runFetchStageScore } from '@features/aria/runFetchStageScore';
import type { FetchStageScoreDeps } from '@features/aria/fetchStageScoreTypes';
import { runSaveScenarioCheckpoint } from '@features/aria/runSaveScenarioCheckpoint';
import type { SaveScenarioCheckpointDeps } from '@features/aria/saveScenarioCheckpointTypes';
import { runScoreScenario } from '@features/aria/runScoreScenario';
import type { ScoreScenarioDeps } from '@features/aria/scoreScenarioTypes';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import {
  runEnsureCompletedScenarioScored,
  runNotifyScenarioStarted,
} from '@features/aria/runScenarioBoundaryScoring';
import type { ScenarioBoundaryScoringDeps } from '@features/aria/scenarioBoundaryScoringTypes';

export function useInterviewScenarioScoringCallbacks(
  deps: {
    fetchStageScoreDepsRef: React.MutableRefObject<FetchStageScoreDeps>;
    saveScenarioCheckpointDepsRef: React.MutableRefObject<SaveScenarioCheckpointDeps>;
    scoreScenarioDepsRef: React.MutableRefObject<ScoreScenarioDeps>;
    scenarioBoundaryScoringDepsRef: React.MutableRefObject<ScenarioBoundaryScoringDeps>;
    scoreScenarioRef: React.MutableRefObject<
      ((scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => Promise<void>) | null
    >;
  },
) {
  const fetchStageScore = useCallback(
    async (finalMessages: { role: string; content: string }[]) =>
      runFetchStageScore(deps.fetchStageScoreDepsRef.current, { finalMessages }),
    [deps.fetchStageScoreDepsRef],
  );

  const saveScenarioCheckpoint = useCallback(
    async (
      scenarioNumber: 1 | 2 | 3,
      result: ScenarioScoreResult,
      allMessages: { role: string; content: string }[],
      uid: string,
    ) => {
      await runSaveScenarioCheckpoint(deps.saveScenarioCheckpointDepsRef.current, {
        scenarioNumber,
        result,
        allMessages,
        uid,
      });
    },
    [deps.saveScenarioCheckpointDepsRef],
  );

  const scoreScenario = useCallback(
    async (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => {
      await runScoreScenario(deps.scoreScenarioDepsRef.current, { scenarioNumber, allMessages });
    },
    [deps.scoreScenarioDepsRef],
  );

  useEffect(() => {
    deps.scoreScenarioRef.current = scoreScenario;
  }, [deps.scoreScenarioRef, scoreScenario]);

  const notifyScenarioStarted = useCallback(
    async (
      scenario: 1 | 2 | 3,
      messagesSnapshot?: ReadonlyArray<{ role: string; content: string; scenarioNumber?: number }>,
      opts?: { allowMessageHistoryShrink?: boolean },
    ) => {
      await runNotifyScenarioStarted(deps.scenarioBoundaryScoringDepsRef.current, {
        scenario,
        messagesSnapshot,
        opts,
      });
    },
    [deps.scenarioBoundaryScoringDepsRef],
  );

  const ensureCompletedScenarioScored = useCallback(
    (
      completedScenario: 1 | 2 | 3,
      messagesForScoring: { role: string; content: string }[],
      trigger: string,
    ) => {
      runEnsureCompletedScenarioScored(deps.scenarioBoundaryScoringDepsRef.current, {
        completedScenario,
        messagesForScoring,
        trigger,
      });
    },
    [deps.scenarioBoundaryScoringDepsRef],
  );

  return {
    fetchStageScore,
    saveScenarioCheckpoint,
    scoreScenario,
    notifyScenarioStarted,
    ensureCompletedScenarioScored,
  };
}
