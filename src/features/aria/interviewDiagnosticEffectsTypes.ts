import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewMomentIndex } from '@features/aria/interviewScenarioScoringSlice';

export type SyncCurrentMessagesRefDeps = {
  currentMessagesRef: MutableRefObject<Array<{ role: string; content?: string }>>;
};

export type ElongatingProbeFromMessagesDeps = {
  elongatingProbeFiredRef: MutableRefObject<boolean>;
  isApprovedElongatingProbeOnly: (content: string) => boolean;
};

export type TranscriptScenarioLogDeps = {
  transcriptScenarioLogCursorRef: MutableRefObject<number>;
  currentInterviewMomentRef: MutableRefObject<InterviewMomentIndex>;
  remoteLog: (event: string, data: Record<string, unknown>) => void | Promise<void>;
  isMoment5AssistantAnchor: (content: string) => boolean;
  looksLikeMoment5AccountabilityProbeAssistantPrompt: (content: string) => boolean;
  looksLikeMoment4ThresholdQuestion: (content: string) => boolean;
  looksLikeMoment4SpecificityFollowUpPrompt: (content: string) => boolean;
  looksLikeMoment4GrudgePrompt: (content: string) => boolean;
};

export type AdminScoreCardRenderLogDeps = {
  lastAdminScoreCardCountRef: MutableRefObject<number>;
  messageLooksLikeScoreCard: (message: { role: string; content?: string }) => boolean;
  remoteLog: (event: string, data: Record<string, unknown>) => void | Promise<void>;
};

export type InterviewNetworkStatusCheckDeps = {
  getResolvedSupabaseUrl: () => string | null | undefined;
  getResolvedSupabaseAnonKey: () => string | null | undefined;
  setNetworkStatus: Dispatch<SetStateAction<'checking' | 'good' | 'poor'>>;
};

export type ReasoningProgressResetDeps = {
  setReasoningProgress: Dispatch<
    SetStateAction<'generating' | 'slow' | 'very_slow' | 'done' | 'pending' | 'failed' | null>
  >;
};
