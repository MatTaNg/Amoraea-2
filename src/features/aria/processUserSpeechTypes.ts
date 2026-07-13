import type { MutableRefObject } from 'react';

import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';
import type { InterviewSessionStatus } from '@features/aria/hooks/useAriaInterviewSession';
import type { ParallelStreamingTtsState } from '@features/aria/interviewParallelTtsBatch';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

export type ProcessUserSpeechParams = {
  spokenText: string;
};

export type ProcessUserSpeechDeps = {
  userId: string | undefined;
  isAdmin: boolean;
  isInterviewAppRoute: boolean;
  status: InterviewSessionStatus;
  messages: Array<{ role: string; content?: string; [key: string]: unknown }>;
  setVoiceState: React.Dispatch<React.SetStateAction<VoiceState>>;
  setIsWaiting: React.Dispatch<React.SetStateAction<boolean>>;
  showChatError: (message: string) => void;
  preClaudeTurnGateDepsRef: MutableRefObject<PreClaudeTurnGateDeps>;
  claudeParallelStreamTtsDepsRef: MutableRefObject<ClaudeParallelStreamTtsCallDeps>;
  postClaudeTurnDepsRef: MutableRefObject<PostClaudeAssistantTurnDeps>;
  whisperRatioReaskAttemptsForCurrentQuestionRef: MutableRefObject<number>;
  resumeRepeatChoicePendingRef: MutableRefObject<boolean>;
  resumeLastAssistantTextRef: MutableRefObject<string | null>;
  lastQuestionTextRef: MutableRefObject<string>;
  parallelStreamingTtsRef: MutableRefObject<ParallelStreamingTtsState>;
  interviewSessionIdRef: MutableRefObject<string>;
  metaClassificationForPendingAssistantRef: MutableRefObject<MetaCommentClassification | null>;
  moment5PostPromptUserTurnCountRef: MutableRefObject<number>;
  moment5PrimaryAnchorDeliveredSessionRef: MutableRefObject<boolean>;
  moment5ResolutionFollowUpIssuedRef: MutableRefObject<boolean>;
  moment5ResolutionDeliveredRef: MutableRefObject<boolean>;
  currentInterviewMomentRef: MutableRefObject<number>;
  scoredScenariosRef: MutableRefObject<Set<number>>;
  scenarioScoresRef: MutableRefObject<Record<number, ScenarioScoreResult>>;
  resumeActiveScenarioRef: MutableRefObject<1 | 2 | 3 | null>;
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>;
  webResumeWelcomeTapPendingRef: MutableRefObject<boolean>;
  resumeOfferWelcomeTtsRef: MutableRefObject<boolean>;
  webResumeWelcomeTapHandledRef: MutableRefObject<boolean>;
  interviewUserTurnEpochRef: MutableRefObject<number>;
  interviewSessionAttemptIdRef: MutableRefObject<string | null>;
};
