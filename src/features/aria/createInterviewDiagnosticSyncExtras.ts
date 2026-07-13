import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type {
  SyncCurrentMessagesRefDeps,
  ElongatingProbeFromMessagesDeps,
  TranscriptScenarioLogDeps,
  AdminScoreCardRenderLogDeps,
  InterviewNetworkStatusCheckDeps,
  ReasoningProgressResetDeps,
} from '@features/aria/interviewDiagnosticEffectsTypes';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createSyncCurrentMessagesRefSyncExtra(
  params: SyncExtraParams,
): SyncCurrentMessagesRefDeps {
  return { currentMessagesRef: params.currentMessagesRef } as SyncCurrentMessagesRefDeps;
}

export function createElongatingProbeFromMessagesSyncExtra(
  params: SyncExtraParams,
): ElongatingProbeFromMessagesDeps {
  return {
    elongatingProbeFiredRef: params.elongatingProbeFiredRef,
    isApprovedElongatingProbeOnly: params.isApprovedElongatingProbeOnly,
  } as ElongatingProbeFromMessagesDeps;
}

export function createTranscriptScenarioLogSyncExtra(
  params: SyncExtraParams,
): TranscriptScenarioLogDeps {
  return {
    transcriptScenarioLogCursorRef: params.transcriptScenarioLogCursorRef,
    currentInterviewMomentRef: params.currentInterviewMomentRef,
    remoteLog: params.remoteLog,
    isMoment5AssistantAnchor: params.isMoment5AssistantAnchor,
    looksLikeMoment5AccountabilityProbeAssistantPrompt: params.looksLikeMoment5AccountabilityProbeAssistantPrompt,
    looksLikeMoment4ThresholdQuestion: params.looksLikeMoment4ThresholdQuestion,
    looksLikeMoment4SpecificityFollowUpPrompt: params.looksLikeMoment4SpecificityFollowUpPrompt,
    looksLikeMoment4GrudgePrompt: params.looksLikeMoment4GrudgePrompt,
  } as TranscriptScenarioLogDeps;
}

export function createAdminScoreCardRenderLogSyncExtra(
  params: SyncExtraParams,
): AdminScoreCardRenderLogDeps {
  return {
    lastAdminScoreCardCountRef: params.lastAdminScoreCardCountRef,
    messageLooksLikeScoreCard: params.messageLooksLikeScoreCard,
    remoteLog: params.remoteLog,
  } as AdminScoreCardRenderLogDeps;
}

export function createReasoningProgressResetSyncExtra(
  params: SyncExtraParams,
): ReasoningProgressResetDeps {
  return { setReasoningProgress: params.setReasoningProgress } as ReasoningProgressResetDeps;
}

export function createInterviewNetworkStatusCheckSyncExtra(
  params: SyncExtraParams,
): InterviewNetworkStatusCheckDeps {
  return {
    getResolvedSupabaseUrl: params.getResolvedSupabaseUrl,
    getResolvedSupabaseAnonKey: params.getResolvedSupabaseAnonKey,
    setNetworkStatus: params.setNetworkStatus,
  } as InterviewNetworkStatusCheckDeps;
}
