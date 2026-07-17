import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createEnsureValidSessionSyncExtra,
  createInterviewAttemptBootstrapSyncExtra,
  createInterviewAuthSignedOutSaveSyncExtra,
  createInterviewUnhandledRejectionSaveSyncExtra,
} from '@features/aria/createInterviewBootSyncExtras';
import {
  buildEnsureValidSessionSyncExtra,
  buildInterviewAttemptBootstrapSyncExtra,
  buildInterviewAuthSignedOutSaveSyncExtra,
  buildInterviewUnhandledRejectionSaveSyncExtra,
  type AriaInterviewServicesExtendedLocalScope,
} from '@features/aria/buildInterviewBootSyncExtras';
import {
  createApplyReferenceCardFromAssistantSpeechSyncExtra,
  createDebouncedLiveTranscriptSyncExtra,
  createInterviewScenarioTransitionUiSyncExtra,
  createSaveActiveInterviewProgressSyncExtra,
} from '@features/aria/createInterviewPersistenceSyncExtras';
import {
  buildApplyReferenceCardFromAssistantSpeechSyncExtra,
  buildDebouncedLiveTranscriptSyncExtra,
  buildInterviewScenarioTransitionUiSyncExtra,
  buildSaveActiveInterviewProgressSyncExtra,
} from '@features/aria/buildInterviewPersistenceSyncExtras';
import {
  createAlphaModeCongratulationsFailsafeSyncExtra,
  createCheckInterviewStatusSyncExtra,
  createInterviewLoadingStatusFailsafeSyncExtra,
  createLoadStandardResultsReferralCodeSyncExtra,
  createPendingScoringSyncPollSyncExtra,
  createRecoverPendingDatabaseSaveSyncExtra,
  createRestorePreparingResultsInterviewStatusSyncExtra,
} from '@features/aria/createInterviewPostScoringSyncExtras';
import {
  buildAlphaModeCongratulationsFailsafeSyncExtra,
  buildCheckInterviewStatusSyncExtra,
  buildInterviewLoadingStatusFailsafeSyncExtra,
  buildLoadStandardResultsReferralCodeSyncExtra,
  buildPendingScoringSyncPollSyncExtra,
  buildRecoverPendingDatabaseSaveSyncExtra,
  buildRestorePreparingResultsInterviewStatusSyncExtra,
} from '@features/aria/buildInterviewPostScoringSyncExtras';
import { createFetchStageScoreSyncExtra } from '@features/aria/createInterviewTtsAuxSyncExtras';
import {
  buildFetchStageScoreLocalSyncExtra,
  buildFetchStageScoreSyncExtra,
  type FetchStageScoreLocalScope,
} from '@features/aria/buildInterviewScenarioScoringAuxSyncExtras';
import {
  buildAriaInterviewDiagnosticSyncExtra,
  type AriaInterviewDiagnosticLocalScope,
} from '@features/aria/buildAriaInterviewDiagnosticSyncExtra';
import {
  buildAriaInterviewDiagnosticMergedSyncCtx,
  buildAriaInterviewServicesExtendedMergedSyncCtx,
  buildProfileNameSourceDebugMergedSyncCtx,
} from '@features/aria/buildAriaInterviewBootMergedSyncCtx';
import type { ProfileNameSourceDebugLocalScope } from '@features/aria/buildProfileNameSourceDebugSyncExtra';
import {
  createClosingQuestionActionsSyncExtra,
  createInterviewAssistantMetaExemptionSyncExtra,
  createResetInterviewProgressSyncExtra,
} from '@features/aria/createInterviewGateSyncExtras';
import {
  buildClosingQuestionActionsSyncExtra,
  buildInterviewAssistantMetaExemptionSyncExtra,
  buildResetInterviewProgressSyncExtra,
} from '@features/aria/buildInterviewGateSyncExtras';
import {
  createApplyInterviewSpeechCompleteSyncExtra,
  createAriaScreenMountedLogSyncExtra,
  createInterviewScrollToEndSyncExtra,
  createNavigateBackToValidationReportSyncExtra,
  createOpenAdminPanelFromRouteSyncExtra,
  createPostInterviewFeedbackAlertSyncExtra,
  createShowChatErrorSyncExtra,
} from '@features/aria/createInterviewMiscSyncExtras';
import {
  buildApplyInterviewSpeechCompleteSyncExtra,
  buildAriaScreenMountedLogSyncExtra,
  buildInterviewScrollToEndSyncExtra,
  buildNavigateBackToValidationReportSyncExtra,
  buildOpenAdminPanelFromRouteSyncExtra,
  buildPostInterviewFeedbackAlertSyncExtra,
  buildShowChatErrorSyncExtra,
} from '@features/aria/buildInterviewMiscSyncExtras';
import {
  buildApplyInterviewSpeechCompleteLocalSyncExtra,
  buildInterviewScrollToEndLocalSyncExtra,
  buildNavigateBackToValidationReportLocalSyncExtra,
  buildOpenAdminPanelFromRouteLocalSyncExtra,
  buildPostInterviewFeedbackAlertLocalSyncExtra,
  buildShowChatErrorLocalSyncExtra,
  type ApplyInterviewSpeechCompleteLocalScope,
  type InterviewScrollToEndLocalScope,
  type NavigateBackToValidationReportLocalScope,
  type OpenAdminPanelFromRouteLocalScope,
  type PostInterviewFeedbackAlertLocalScope,
  type ShowChatErrorLocalScope,
} from '@features/aria/buildInterviewMiscLocalSyncExtras';
import {
  createProcessTurnAudioSyncExtra,
  createResolveAssistantScenarioNumberSyncExtra,
} from '@features/aria/createInterviewTurnHelperSyncExtras';
import {
  buildProcessTurnAudioSyncExtra,
  buildResolveAssistantScenarioNumberSyncExtra,
} from '@features/aria/buildInterviewTurnHelperSyncExtras';
import {
  buildProcessTurnAudioLocalSyncExtra,
  buildResolveAssistantScenarioNumberLocalSyncExtra,
  buildResetScenarioCClientGatesLocalSyncExtra,
  type ProcessTurnAudioLocalScope,
  type ResolveAssistantScenarioNumberLocalScope,
  type ResetScenarioCClientGatesLocalScope,
} from '@features/aria/buildInterviewTurnHelperLocalSyncExtras';

export type AriaInterviewDiagnosticScreenRefs = AriaInterviewDiagnosticLocalScope;
export type AriaInterviewServicesExtendedScreenRefs = AriaInterviewServicesExtendedLocalScope;
export type ProfileNameSourceDebugScreenRefs = ProfileNameSourceDebugLocalScope;
export type ResolveAssistantScenarioNumberScreenRefs = ResolveAssistantScenarioNumberLocalScope;
export type ProcessTurnAudioScreenRefs = ProcessTurnAudioLocalScope;
export type FetchStageScoreScreenRefs = FetchStageScoreLocalScope;
export type NavigateBackToValidationReportScreenRefs = NavigateBackToValidationReportLocalScope;
export type OpenAdminPanelFromRouteScreenRefs = OpenAdminPanelFromRouteLocalScope;
export type InterviewScrollToEndScreenRefs = InterviewScrollToEndLocalScope;
export type ShowChatErrorScreenRefs = ShowChatErrorLocalScope;
export type ApplyInterviewSpeechCompleteScreenRefs = ApplyInterviewSpeechCompleteLocalScope;
export type PostInterviewFeedbackAlertScreenRefs = PostInterviewFeedbackAlertLocalScope;
export type ResetScenarioCClientGatesScreenRefs = ResetScenarioCClientGatesLocalScope;

export function createResetScenarioCClientGatesSyncCtxFromScreen(
  local: ResetScenarioCClientGatesScreenRefs,
): AriaInterviewDepsSyncContext {
  return buildResetScenarioCClientGatesLocalSyncExtra(local);
}

export function createResetInterviewProgressSyncCtxFromGate(
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createResetInterviewProgressSyncExtra(buildResetInterviewProgressSyncExtra(gateCtx));
}

export function createInterviewAssistantMetaExemptionSyncCtxFromGate(
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewAssistantMetaExemptionSyncExtra(
    buildInterviewAssistantMetaExemptionSyncExtra(gateCtx),
  );
}

export function createClosingQuestionActionsSyncCtxFromGate(
  gateCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createClosingQuestionActionsSyncExtra(buildClosingQuestionActionsSyncExtra(gateCtx));
}

export function createResolveAssistantScenarioNumberSyncCtxFromScreen(
  local: ResolveAssistantScenarioNumberScreenRefs,
): AriaInterviewDepsSyncContext {
  return createResolveAssistantScenarioNumberSyncExtra(
    buildResolveAssistantScenarioNumberSyncExtra(buildResolveAssistantScenarioNumberLocalSyncExtra(local)),
  );
}

export function createProcessTurnAudioSyncCtxFromScreen(
  local: ProcessTurnAudioScreenRefs,
): AriaInterviewDepsSyncContext {
  return createProcessTurnAudioSyncExtra(
    buildProcessTurnAudioSyncExtra(buildProcessTurnAudioLocalSyncExtra(local)),
  );
}

export function createNavigateBackToValidationReportSyncCtxFromScreen(
  local: NavigateBackToValidationReportScreenRefs,
): AriaInterviewDepsSyncContext {
  return createNavigateBackToValidationReportSyncExtra(
    buildNavigateBackToValidationReportSyncExtra(buildNavigateBackToValidationReportLocalSyncExtra(local)),
  );
}

export function createOpenAdminPanelFromRouteSyncCtxFromScreen(
  local: OpenAdminPanelFromRouteScreenRefs,
): AriaInterviewDepsSyncContext {
  return createOpenAdminPanelFromRouteSyncExtra(
    buildOpenAdminPanelFromRouteSyncExtra(buildOpenAdminPanelFromRouteLocalSyncExtra(local)),
  );
}

export function createAriaScreenMountedLogSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createAriaScreenMountedLogSyncExtra(buildAriaScreenMountedLogSyncExtra(servicesBaseCtx));
}

export function createInterviewAttemptBootstrapSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewAttemptBootstrapSyncExtra(
    buildInterviewAttemptBootstrapSyncExtra(servicesBaseCtx),
  );
}

export function createAriaInterviewDiagnosticSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  local: AriaInterviewDiagnosticScreenRefs,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewDiagnosticSyncExtra(
    buildAriaInterviewDiagnosticMergedSyncCtx(servicesBaseCtx, local),
  );
}

export function createInterviewUnhandledRejectionSaveSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewUnhandledRejectionSaveSyncExtra(
    buildInterviewUnhandledRejectionSaveSyncExtra(servicesBaseCtx),
  );
}

export function createEnsureValidSessionSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createEnsureValidSessionSyncExtra(buildEnsureValidSessionSyncExtra(servicesBaseCtx));
}

export function createAriaInterviewServicesExtendedSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  local: AriaInterviewServicesExtendedScreenRefs,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewServicesExtendedMergedSyncCtx(servicesBaseCtx, local);
}

export function createInterviewAuthSignedOutSaveSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewAuthSignedOutSaveSyncExtra(
    buildInterviewAuthSignedOutSaveSyncExtra(servicesBaseCtx),
  );
}

export function createRestorePreparingResultsInterviewStatusSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createRestorePreparingResultsInterviewStatusSyncExtra(
    buildRestorePreparingResultsInterviewStatusSyncExtra(servicesBaseCtx),
  );
}

export function createCheckInterviewStatusSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createCheckInterviewStatusSyncExtra(buildCheckInterviewStatusSyncExtra(servicesBaseCtx));
}

export function createPendingScoringSyncPollSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createPendingScoringSyncPollSyncExtra(buildPendingScoringSyncPollSyncExtra(servicesBaseCtx));
}

export function createInterviewLoadingStatusFailsafeSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewLoadingStatusFailsafeSyncExtra(
    buildInterviewLoadingStatusFailsafeSyncExtra(servicesBaseCtx),
  );
}

export function createAlphaModeCongratulationsFailsafeSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createAlphaModeCongratulationsFailsafeSyncExtra(
    buildAlphaModeCongratulationsFailsafeSyncExtra(servicesBaseCtx),
  );
}

export function createLoadStandardResultsReferralCodeSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createLoadStandardResultsReferralCodeSyncExtra(
    buildLoadStandardResultsReferralCodeSyncExtra(servicesBaseCtx),
  );
}

export function createRecoverPendingDatabaseSaveSyncCtxFromScreen(
  servicesFullCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createRecoverPendingDatabaseSaveSyncExtra(
    buildRecoverPendingDatabaseSaveSyncExtra(servicesFullCtx),
  );
}

export function createSaveActiveInterviewProgressSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createSaveActiveInterviewProgressSyncExtra(
    buildSaveActiveInterviewProgressSyncExtra(servicesBaseCtx),
  );
}

export function createDebouncedLiveTranscriptSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createDebouncedLiveTranscriptSyncExtra(
    buildDebouncedLiveTranscriptSyncExtra(servicesBaseCtx),
  );
}

export function createInterviewScenarioTransitionUiSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createInterviewScenarioTransitionUiSyncExtra(
    buildInterviewScenarioTransitionUiSyncExtra(servicesBaseCtx),
  );
}

export function createProfileNameSourceDebugSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  local: ProfileNameSourceDebugScreenRefs,
): AriaInterviewDepsSyncContext {
  return buildProfileNameSourceDebugMergedSyncCtx(servicesBaseCtx, local);
}

export function createInterviewScrollToEndSyncCtxFromScreen(
  local: InterviewScrollToEndScreenRefs,
): AriaInterviewDepsSyncContext {
  return createInterviewScrollToEndSyncExtra(
    buildInterviewScrollToEndSyncExtra(buildInterviewScrollToEndLocalSyncExtra(local)),
  );
}

export function createShowChatErrorSyncCtxFromScreen(local: ShowChatErrorScreenRefs): AriaInterviewDepsSyncContext {
  return createShowChatErrorSyncExtra(buildShowChatErrorSyncExtra(buildShowChatErrorLocalSyncExtra(local)));
}

export function createApplyReferenceCardFromAssistantSpeechSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return createApplyReferenceCardFromAssistantSpeechSyncExtra(
    buildApplyReferenceCardFromAssistantSpeechSyncExtra(servicesBaseCtx),
  );
}

export function createApplyInterviewSpeechCompleteSyncCtxFromScreen(
  local: ApplyInterviewSpeechCompleteScreenRefs,
): AriaInterviewDepsSyncContext {
  return createApplyInterviewSpeechCompleteSyncExtra(
    buildApplyInterviewSpeechCompleteSyncExtra(buildApplyInterviewSpeechCompleteLocalSyncExtra(local)),
  );
}

export function createFetchStageScoreSyncCtxFromScreen(
  local: FetchStageScoreScreenRefs,
): AriaInterviewDepsSyncContext {
  return createFetchStageScoreSyncExtra(
    buildFetchStageScoreSyncExtra(buildFetchStageScoreLocalSyncExtra(local)),
  );
}

export function createPostInterviewFeedbackAlertSyncCtxFromScreen(
  local: PostInterviewFeedbackAlertScreenRefs,
): AriaInterviewDepsSyncContext {
  return createPostInterviewFeedbackAlertSyncExtra(
    buildPostInterviewFeedbackAlertSyncExtra(buildPostInterviewFeedbackAlertLocalSyncExtra(local)),
  );
}
