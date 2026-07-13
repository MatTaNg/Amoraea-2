import type { MutableRefObject } from 'react';

import type { GateResult } from '@features/aria/computeGateResult';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

export type ScoreInterviewParams = {
  finalMessages: { role: string; content: string }[];
};

export type ScoreInterviewDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  typologyContext: string | null;
  routeName: string;
  userEmail: string | null | undefined;
  profile: { id?: string; first_name?: string | null } | null | undefined;
  fromValidationTrack: boolean;
  navigation: {
    replace: (name: string, params?: Record<string, unknown>) => void;
  };
  queryClient: {
    invalidateQueries: (opts: { queryKey: unknown[] }) => void;
  };
  saveInterviewResults: (
    results: InterviewResults,
    gateResult: GateResult,
    uid: string,
  ) => Promise<void>;
  ensureValidSession: () => Promise<void>;
  scoreScenario: (scenarioNumber: 1 | 2 | 3, allMessages: { role: string; content: string }[]) => void;
  setScenarioScores: React.Dispatch<React.SetStateAction<Record<number, ScenarioScoreResult>>>;
  setResults: React.Dispatch<React.SetStateAction<InterviewResults | null>>;
  setStageResults: React.Dispatch<
    React.SetStateAction<Array<{ stage: number; results: InterviewResults }>>
  >;
  setInterviewStatus: React.Dispatch<
    React.SetStateAction<
      'loading' | 'not_started' | 'in_progress' | 'preparing_results' | 'under_review' | 'congratulations' | 'analysis'
    >
  >;
  setStatus: React.Dispatch<React.SetStateAction<InterviewSessionStatus>>;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setInterviewLastCommittedAttemptId: (attemptId: string | null) => void;
  loadEmotionResponsesForCompletion: () => Promise<string[]>;
  applyEmotionResponsesToSession: (hydrated: string[]) => void;
  markCompletionScoringInFlight: (inFlight: boolean) => void;
  replaceWithStandardApplicantPostInterviewHandoffForUser: (
    navigation: ScoreInterviewDeps['navigation'],
    userId: string,
    meta?: Record<string, unknown>,
  ) => void;
  scoreInterviewInFlightRef: MutableRefObject<boolean>;
  scoreInterviewAttemptedRef: MutableRefObject<boolean>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  interviewStatusRef: MutableRefObject<string>;
  emotionItemResponsesRef: MutableRefObject<string[]>;
  scenarioScoresRef: MutableRefObject<Record<number, ScenarioScoreResult>>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  moment4SpecificityScoringRef: MutableRefObject<unknown>;
  moment5ClientScoringMetaRef: MutableRefObject<unknown>;
  moment5AccountabilityProbeFiredRef: MutableRefObject<boolean>;
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
  responseTimingsRef: MutableRefObject<unknown[]>;
  scenarioSkipConfirmedCountRef: MutableRefObject<number>;
  deferredMoment4NarrativeRef: MutableRefObject<string | null>;
  setReasoningProgress: (
    progress: 'generating' | 'slow' | 'very_slow' | 'done' | 'pending' | 'failed' | null,
  ) => void;
  setAnalysisAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
};
