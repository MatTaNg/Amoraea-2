import type { MutableRefObject } from 'react';

import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';

export type PostInterviewRatingKey = 'conversation_quality' | 'clarity_flow' | 'trust_accuracy';

export type PerformInterviewRetakeDeps = {
  userId: string | undefined;
  interviewStatusRef: MutableRefObject<string>;
  currentInterviewMomentRef: MutableRefObject<number>;
  lastQuestionTextRef: MutableRefObject<string | null>;
  isInterviewCompleteRef: MutableRefObject<boolean>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  closingQuestionAskedRef: MutableRefObject<Record<1 | 2 | 3, boolean>>;
  closingQuestionAnsweredRef: MutableRefObject<Record<1 | 2 | 3, boolean>>;
  lastClosingQuestionScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  waitingForClosingAdditionRef: MutableRefObject<boolean | null>;
  lastAnsweredClosingScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  onboardingAutoStartRef: MutableRefObject<boolean>;
  hasResumedRef: MutableRefObject<boolean>;
  startInterviewInFlightRef: MutableRefObject<boolean>;
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  setInterviewStartInFlight: React.Dispatch<React.SetStateAction<boolean>>;
  setResumeLoadingVisible: React.Dispatch<React.SetStateAction<boolean>>;
  responseTimingsRef: MutableRefObject<unknown[]>;
  probeLogRef: MutableRefObject<unknown[]>;
  setMessages: React.Dispatch<React.SetStateAction<Array<{ role: string; content: string }>>>;
  setScenarioScores: React.Dispatch<React.SetStateAction<Record<number, unknown>>>;
  setClosingQuestionState: React.Dispatch<
    React.SetStateAction<Record<1 | 2 | 3, 'needed' | 'asked' | 'answered'>>
  >;
  setClosingQuestionPending: React.Dispatch<React.SetStateAction<boolean>>;
  setClosingQuestionScenario: React.Dispatch<React.SetStateAction<1 | 2 | 3 | null>>;
  setMicError: React.Dispatch<React.SetStateAction<string | null>>;
  setPreInterviewConsentAge: React.Dispatch<React.SetStateAction<boolean>>;
  setPreInterviewConsentData: React.Dispatch<React.SetStateAction<boolean>>;
  setStatus: React.Dispatch<React.SetStateAction<InterviewSessionStatus>>;
  setResults: React.Dispatch<React.SetStateAction<unknown>>;
  setAnalysisAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setInterviewLastCommittedAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  setShowPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  setPostInterviewRatings: React.Dispatch<
    React.SetStateAction<Record<PostInterviewRatingKey, number | null>>
  >;
  setPostInterviewComments: React.Dispatch<
    React.SetStateAction<Record<PostInterviewRatingKey, string>>
  >;
  setPostInterviewGeneralFeedback: React.Dispatch<React.SetStateAction<string>>;
  setHasSubmittedPostInterviewFeedback: React.Dispatch<React.SetStateAction<boolean>>;
  setInterviewStatus: React.Dispatch<
    React.SetStateAction<
      | 'loading'
      | 'not_started'
      | 'in_progress'
      | 'preparing_results'
      | 'under_review'
      | 'congratulations'
      | 'analysis'
    >
  >;
};
