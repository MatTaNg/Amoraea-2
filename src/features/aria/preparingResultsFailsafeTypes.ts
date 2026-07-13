import type { MutableRefObject } from 'react';

import type { CompletionTranscriptMsg } from '@features/aria/completionScoringKick';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';

export type PreparingResultsFailsafePhase = 'edge_retry' | 'force_standard_recovery';

export type PreparingResultsFailsafeDeps = {
  userId: string;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  userEmail: string | null | undefined;
  navigation: ScoreInterviewDeps['navigation'];
  interviewStatusRef: MutableRefObject<string>;
  scoreInterviewInFlightRef: MutableRefObject<boolean>;
  scoreInterviewAttemptedRef: MutableRefObject<boolean>;
  pendingCompletionTranscriptRef: MutableRefObject<CompletionTranscriptMsg[] | null>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
  interviewSessionIdRef: MutableRefObject<string>;
  setPendingScoringSyncAttemptId: React.Dispatch<React.SetStateAction<string | null>>;
  kickCompletionScoring: (source: string, transcript: CompletionTranscriptMsg[]) => boolean;
};
