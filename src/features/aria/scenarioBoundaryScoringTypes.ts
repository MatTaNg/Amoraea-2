import type { MutableRefObject } from 'react';

import type { StoredInterviewData } from '@utilities/storage/InterviewStorage';
import type { InterviewMomentIndex } from '@features/aria/interviewProgressSync';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

export type NotifyScenarioStartedParams = {
  scenario: 1 | 2 | 3;
  messagesSnapshot?: ReadonlyArray<{ role: string; content: string; scenarioNumber?: number }>;
  opts?: { allowMessageHistoryShrink?: boolean };
};

export type EnsureCompletedScenarioScoredParams = {
  completedScenario: 1 | 2 | 3;
  messagesForScoring: { role: string; content: string }[];
  trigger: string;
};

export type ScenarioBoundaryScoringDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  currentScenarioRef: MutableRefObject<1 | 2 | 3>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  currentMessagesRef: MutableRefObject<
    Array<{ role: string; content: string; scenarioNumber?: number; isScoreCard?: boolean; isWelcomeBack?: boolean }>
  >;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  scenarioScoresRef: MutableRefObject<Record<number, ScenarioScoreResult>>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  scoreScenarioRef: MutableRefObject<
    ((scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => Promise<void>) | null
  >;
  interviewMomentsCompleteRef: MutableRefObject<Record<InterviewMomentIndex, boolean>>;
  currentInterviewMomentRef: MutableRefObject<InterviewMomentIndex>;
  tryRunEmotionModalFromScenarioTransitionRef: MutableRefObject<
    (params: {
      completedScenario: 1 | 2 | 3;
      transitionText: string;
      priorScenario: 1 | 2 | 3 | null;
      source: string;
    }) => Promise<void>
  >;
  resetScenarioCClientGatesOnly: () => void;
  scoreScenario: (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => Promise<void>;
  loadInterviewFromStorage: (userId: string) => Promise<StoredInterviewData | null>;
  saveInterviewToStorage: (
    userId: string,
    data: Omit<StoredInterviewData, 'version' | 'userId' | 'lastSavedAt'>,
  ) => Promise<void>;
};
