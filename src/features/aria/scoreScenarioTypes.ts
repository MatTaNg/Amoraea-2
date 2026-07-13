import type { MutableRefObject } from 'react';

import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

export type ScoreScenarioParams = {
  scenarioNumber: 1 | 2 | 3;
  allMessages: { role: string; content: string }[];
};

export type ScoreScenarioDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  scoredScenariosRef?: MutableRefObject<Set<number>>;
  scenarioCRepairOnlyEvidenceRef: MutableRefObject<string | null>;
  scenarioScoresRef: MutableRefObject<Record<number, ScenarioScoreResult>>;
  scenarioFrustrationSkipNullMarkersRef: MutableRefObject<Partial<Record<1 | 2 | 3, boolean>>>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  probeLogRef: MutableRefObject<
    Array<{
      scenario: number;
      construct: string;
      probe_fired: boolean;
      trigger_reason: string | null;
      pre_probe_score: number;
      post_probe_score: number;
      score_delta: number;
    }>
  >;
  setScenarioScores: React.Dispatch<React.SetStateAction<Record<number, ScenarioScoreResult>>>;
  setMessages: React.Dispatch<
    React.SetStateAction<
      Array<{ role: string; content: string; isScoreCard?: boolean; [key: string]: unknown }>
    >
  >;
  saveScenarioCheckpoint: (
    scenarioNumber: 1 | 2 | 3,
    result: ScenarioScoreResult,
    allMessages: { role: string; content: string }[],
    uid: string,
  ) => Promise<void>;
};
