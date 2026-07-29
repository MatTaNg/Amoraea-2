import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  flushIntactScenarioScoresRefToAttempt,
  hydrateScenarioScoresFromLocalStorage,
  listMissingAssessableScenarioScores,
  prepareScenarioScoresForCompletion,
  scenarioHasAssessableScoreInRef,
} from '@features/aria/prepareScenarioScoresForCompletion';
import { resetScenarioScoringInFlightForTests } from '@features/aria/scenarioScoringInFlight';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

jest.mock('@utilities/interviewAttemptScenarioPersistence', () => ({
  fetchAttemptScenarioScoreCells: jest.fn(),
  persistScenarioScoreBundleToAttempt: jest.fn(),
}));

jest.mock('@utilities/storage/InterviewStorage', () => ({
  loadInterviewFromStorage: jest.fn(),
  mergeInterviewStoragePayload: jest.fn((prior: unknown, patch: unknown) => ({ ...(prior as object), ...(patch as object) })),
  saveInterviewToStorage: jest.fn(),
}));

jest.mock('@features/aria/hydrateScenarioScoresFromAttempt', () => ({
  hydrateScenarioScoresFromAttempt: jest.fn(),
}));

import { fetchAttemptScenarioScoreCells, persistScenarioScoreBundleToAttempt } from '@utilities/interviewAttemptScenarioPersistence';
import { loadInterviewFromStorage, saveInterviewToStorage } from '@utilities/storage/InterviewStorage';
import { hydrateScenarioScoresFromAttempt } from '@features/aria/hydrateScenarioScoresFromAttempt';

const mockFetchCells = fetchAttemptScenarioScoreCells as jest.MockedFunction<typeof fetchAttemptScenarioScoreCells>;
const mockPersistBundle = persistScenarioScoreBundleToAttempt as jest.MockedFunction<typeof persistScenarioScoreBundleToAttempt>;
const mockLoadLocal = loadInterviewFromStorage as jest.MockedFunction<typeof loadInterviewFromStorage>;
const mockSaveLocal = saveInterviewToStorage as jest.MockedFunction<typeof saveInterviewToStorage>;
const mockHydrateDb = hydrateScenarioScoresFromAttempt as jest.MockedFunction<typeof hydrateScenarioScoresFromAttempt>;

function makeScore(n: 1 | 2 | 3): ScenarioScoreResult {
  return {
    scenarioNumber: n,
    scenarioName: `Scenario ${n}`,
    pillarScores: { repair: 6 + n },
    pillarConfidence: {},
    keyEvidence: {},
    specificity: 'high',
    repairCoherenceIssue: null,
    contempt_tier_breakdown: null,
  };
}

function makeDeps(overrides?: Partial<ScoreInterviewDeps>): ScoreInterviewDeps {
  const scenarioScoresRef = { current: {} as Record<number, ScenarioScoreResult> };
  return {
    userId: 'user-1',
    interviewSessionAttemptIdRef: { current: 'attempt-1' },
    scenarioScoresRef,
    setScenarioScores: jest.fn((updater) => {
      if (typeof updater === 'function') {
        scenarioScoresRef.current = updater(scenarioScoresRef.current);
      } else {
        scenarioScoresRef.current = updater;
      }
    }),
    scoreScenario: jest.fn(),
    ...overrides,
  } as unknown as ScoreInterviewDeps;
}

describe('prepareScenarioScoresForCompletion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetScenarioScoringInFlightForTests();
    mockHydrateDb.mockResolvedValue(undefined);
    mockFetchCells.mockResolvedValue({
      scenario_1_scores: { pillarScores: { repair: 7 } },
      scenario_2_scores: null,
      scenario_3_scores: { pillarScores: { repair: 9 } },
    });
    mockPersistBundle.mockResolvedValue({ error: null });
    mockLoadLocal.mockResolvedValue(null);
    mockSaveLocal.mockResolvedValue(undefined);
  });

  it('scenarioHasAssessableScoreInRef requires numeric pillar scores', () => {
    const deps = makeDeps();
    expect(scenarioHasAssessableScoreInRef(deps, 2)).toBe(false);
    deps.scenarioScoresRef.current[2] = makeScore(2);
    expect(scenarioHasAssessableScoreInRef(deps, 2)).toBe(true);
  });

  it('hydrateScenarioScoresFromLocalStorage fills missing refs from disk', async () => {
    const deps = makeDeps();
    mockLoadLocal.mockResolvedValue({
      version: 1,
      userId: 'user-1',
      lastSavedAt: 'now',
      messages: [],
      scenariosCompleted: [1, 2],
      scenarioScores: {
        2: { pillarScores: { repair: 8 }, pillarConfidence: {}, keyEvidence: {} },
      },
      currentScenario: 3,
    });
    await hydrateScenarioScoresFromLocalStorage(deps);
    expect(deps.scenarioScoresRef.current[2]?.pillarScores.repair).toBe(8);
    expect(deps.setScenarioScores).toHaveBeenCalled();
  });

  it('flushIntactScenarioScoresRefToAttempt persists in-memory S2 without Claude rescore', async () => {
    const deps = makeDeps();
    deps.scenarioScoresRef.current[2] = makeScore(2);
    await flushIntactScenarioScoresRefToAttempt(deps, {} as never);
    expect(mockPersistBundle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scenarioNumber: 2, attemptId: 'attempt-1', userId: 'user-1' }),
    );
    expect(deps.scoreScenario).not.toHaveBeenCalled();
  });

  it('prepareScenarioScoresForCompletion skips rescore when local S2 exists but DB is empty', async () => {
    const deps = makeDeps();
    mockLoadLocal.mockResolvedValue({
      version: 1,
      userId: 'user-1',
      lastSavedAt: 'now',
      messages: [],
      scenariosCompleted: [1, 2, 3],
      scenarioScores: {
        1: { pillarScores: { repair: 7 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: 8 }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 9 }, pillarConfidence: {}, keyEvidence: {} },
      },
      currentScenario: null,
    });
    const missing = await prepareScenarioScoresForCompletion(deps, {} as never);
    expect(missing).toEqual([]);
    expect(listMissingAssessableScenarioScores(deps)).toEqual([]);
    expect(mockPersistBundle).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ scenarioNumber: 2 }),
    );
    expect(deps.scoreScenario).not.toHaveBeenCalled();
  });
});
