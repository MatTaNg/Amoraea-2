import { useEffect } from 'react';

import {
  runCheckInterviewNetworkStatus,
  runLogAdminScoreCardRender,
  runLogTranscriptScenarioAssignments,
  runResetReasoningProgressOnNonScoringStatus,
  runSyncCurrentMessagesRef,
  runSyncElongatingProbeFromMessages,
} from '@features/aria/runInterviewDiagnosticEffects';
import type {
  AdminScoreCardRenderLogDeps,
  ElongatingProbeFromMessagesDeps,
  InterviewNetworkStatusCheckDeps,
  ReasoningProgressResetDeps,
  SyncCurrentMessagesRefDeps,
  TranscriptScenarioLogDeps,
} from '@features/aria/interviewDiagnosticEffectsTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';

export function useSyncCurrentMessagesRef(
  depsRef: React.MutableRefObject<SyncCurrentMessagesRefDeps>,
  messages: Array<{ role: string; content?: string }>,
): void {
  useEffect(() => {
    runSyncCurrentMessagesRef(depsRef.current, messages);
  }, [depsRef, messages]);
}

export function useInterviewElongatingProbeFromMessages(
  depsRef: React.MutableRefObject<ElongatingProbeFromMessagesDeps>,
  messages: Array<{ role: string; content?: string }>,
): void {
  useEffect(() => {
    runSyncElongatingProbeFromMessages(depsRef.current, messages);
  }, [depsRef, messages]);
}

export function useInterviewTranscriptScenarioLog(
  depsRef: React.MutableRefObject<TranscriptScenarioLogDeps>,
  trigger: { userId: string | undefined; messages: MessageWithScenario[] },
): void {
  useEffect(() => {
    runLogTranscriptScenarioAssignments(depsRef.current, trigger);
  }, [depsRef, trigger.userId, trigger.messages]);
}

export function useInterviewAdminScoreCardRenderLog(
  depsRef: React.MutableRefObject<AdminScoreCardRenderLogDeps>,
  trigger: {
    isAdmin: boolean;
    messages: Array<{ role: string; content?: string }>;
    status: string;
    interviewStatus: string;
    userId: string | undefined;
  },
): void {
  useEffect(() => {
    runLogAdminScoreCardRender(depsRef.current, trigger);
  }, [depsRef, trigger.isAdmin, trigger.messages, trigger.status, trigger.interviewStatus, trigger.userId]);
}

export function useInterviewReasoningProgressReset(
  depsRef: React.MutableRefObject<ReasoningProgressResetDeps>,
  status: string,
): void {
  useEffect(() => {
    runResetReasoningProgressOnNonScoringStatus(depsRef.current, status);
  }, [depsRef, status]);
}

export function useInterviewNetworkStatusCheck(
  depsRef: React.MutableRefObject<InterviewNetworkStatusCheckDeps>,
): void {
  useEffect(() => {
    void runCheckInterviewNetworkStatus(depsRef.current);
  }, [depsRef]);
}
