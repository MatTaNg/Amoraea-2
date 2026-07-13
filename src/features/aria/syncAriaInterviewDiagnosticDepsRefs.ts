import type { MutableRefObject } from 'react';

import {
  createResetScenarioCClientGatesSyncExtra,
  createClosingQuestionActionsSyncExtra,
  createInterviewAssistantMetaExemptionSyncExtra,
  createResetInterviewProgressSyncExtra,
} from '@features/aria/createInterviewGateSyncExtras';
import {
  createResolveAssistantScenarioNumberSyncExtra,
  createProcessTurnAudioSyncExtra,
} from '@features/aria/createInterviewTurnHelperSyncExtras';
import {
  createSyncCurrentMessagesRefSyncExtra,
  createElongatingProbeFromMessagesSyncExtra,
  createTranscriptScenarioLogSyncExtra,
  createAdminScoreCardRenderLogSyncExtra,
  createReasoningProgressResetSyncExtra,
  createInterviewNetworkStatusCheckSyncExtra,
} from '@features/aria/createInterviewDiagnosticSyncExtras';
import {
  createNavigateBackToValidationReportSyncExtra,
  createOpenAdminPanelFromRouteSyncExtra,
  createAriaScreenMountedLogSyncExtra,
  createProfileNameSourceDebugSyncExtra,
  createInterviewScrollToEndSyncExtra,
  createShowChatErrorSyncExtra,
  createApplyInterviewSpeechCompleteSyncExtra,
  createPostInterviewFeedbackAlertSyncExtra,
} from '@features/aria/createInterviewMiscSyncExtras';
import type { ClosingQuestionActionsDeps } from '@features/aria/interviewClosingQuestionTypes';
import type {
  NavigateBackToValidationReportDeps,
  AriaScreenBootEffectsDeps,
  PostInterviewFeedbackAlertDeps,
} from '@features/aria/interviewClosingQuestionTypes';
import type {
  SyncCurrentMessagesRefDeps,
  ElongatingProbeFromMessagesDeps,
  TranscriptScenarioLogDeps,
  AdminScoreCardRenderLogDeps,
  InterviewNetworkStatusCheckDeps,
  ReasoningProgressResetDeps,
} from '@features/aria/interviewDiagnosticEffectsTypes';
import type { InterviewAssistantMetaExemptionDeps } from '@features/aria/interviewAssistantMetaExemptionTypes';
import type { ResetInterviewProgressRefsDeps, ResetScenarioCClientGatesDeps } from '@features/aria/interviewProgressResetTypes';
import type { ProcessTurnAudioWithRetryDeps } from '@features/aria/interviewTurnAudioTypes';
import type { OpenAdminPanelFromRouteDeps } from '@features/aria/openAdminPanelFromRouteTypes';
import type {
  ProfileNameSourceDebugDeps,
  InterviewScrollToEndDeps,
  ShowChatErrorDeps,
  ApplyInterviewSpeechCompleteDeps,
} from '@features/aria/referenceCardFromAssistantSpeechTypes';
import type { ResolveAssistantScenarioNumberDeps } from '@features/aria/resolveAssistantScenarioNumberTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncResetScenarioCClientGatesDeps(
  ref: MutableRefObject<ResetScenarioCClientGatesDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createResetScenarioCClientGatesSyncExtra(ctx);
}

export function syncClosingQuestionActionsDeps(
  ref: MutableRefObject<ClosingQuestionActionsDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createClosingQuestionActionsSyncExtra(ctx);
}

export function syncInterviewAssistantMetaExemptionDeps(
  ref: MutableRefObject<InterviewAssistantMetaExemptionDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createInterviewAssistantMetaExemptionSyncExtra(ctx);
}

export function syncResetInterviewProgressDeps(
  ref: MutableRefObject<ResetInterviewProgressRefsDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createResetInterviewProgressSyncExtra(ctx);
}

export function syncResolveAssistantScenarioNumberDeps(
  ref: MutableRefObject<ResolveAssistantScenarioNumberDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createResolveAssistantScenarioNumberSyncExtra(ctx);
}

export function syncProcessTurnAudioDeps(
  ref: MutableRefObject<ProcessTurnAudioWithRetryDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createProcessTurnAudioSyncExtra(ctx);
}

export function syncSyncCurrentMessagesRefDeps(
  ref: MutableRefObject<SyncCurrentMessagesRefDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createSyncCurrentMessagesRefSyncExtra(ctx);
}

export function syncElongatingProbeFromMessagesDeps(
  ref: MutableRefObject<ElongatingProbeFromMessagesDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createElongatingProbeFromMessagesSyncExtra(ctx);
}

export function syncTranscriptScenarioLogDeps(
  ref: MutableRefObject<TranscriptScenarioLogDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createTranscriptScenarioLogSyncExtra(ctx);
}

export function syncAdminScoreCardRenderLogDeps(
  ref: MutableRefObject<AdminScoreCardRenderLogDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createAdminScoreCardRenderLogSyncExtra(ctx);
}

export function syncReasoningProgressResetDeps(
  ref: MutableRefObject<ReasoningProgressResetDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createReasoningProgressResetSyncExtra(ctx);
}

export function syncInterviewNetworkStatusCheckDeps(
  ref: MutableRefObject<InterviewNetworkStatusCheckDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createInterviewNetworkStatusCheckSyncExtra(ctx);
}

export function syncNavigateBackToValidationReportDeps(
  ref: MutableRefObject<NavigateBackToValidationReportDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createNavigateBackToValidationReportSyncExtra(ctx);
}

export function syncOpenAdminPanelFromRouteDeps(
  ref: MutableRefObject<OpenAdminPanelFromRouteDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createOpenAdminPanelFromRouteSyncExtra(ctx);
}

export function syncAriaScreenMountedLogDeps(
  ref: MutableRefObject<Pick<AriaScreenBootEffectsDeps, 'remoteLog'>>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createAriaScreenMountedLogSyncExtra(ctx);
}

export function syncProfileNameSourceDebugDeps(
  ref: MutableRefObject<ProfileNameSourceDebugDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createProfileNameSourceDebugSyncExtra(ctx);
}

export function syncInterviewScrollToEndDeps(
  ref: MutableRefObject<InterviewScrollToEndDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createInterviewScrollToEndSyncExtra(ctx);
}

export function syncShowChatErrorDeps(
  ref: MutableRefObject<ShowChatErrorDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createShowChatErrorSyncExtra(ctx);
}

export function syncApplyInterviewSpeechCompleteDeps(
  ref: MutableRefObject<ApplyInterviewSpeechCompleteDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createApplyInterviewSpeechCompleteSyncExtra(ctx);
}

export function syncPostInterviewFeedbackAlertDeps(
  ref: MutableRefObject<PostInterviewFeedbackAlertDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = createPostInterviewFeedbackAlertSyncExtra(ctx);
}
