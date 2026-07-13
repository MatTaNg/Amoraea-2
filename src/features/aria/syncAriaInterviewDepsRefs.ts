export type {
  AriaInterviewDepsRefs,
  AriaInterviewDepsSyncContext,
} from '@features/aria/syncAriaInterviewDepsTypes';
export { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsTypes';
export {
  syncAriaInterviewEarlyDeps,
  syncAriaInterviewTtsPipelineDeps,
} from '@features/aria/syncAriaInterviewEarlyAndTtsDepsRefs';

export {
  syncAriaInterviewTurnHandlerDeps,
  syncAriaInterviewTurnHandlerCluster,
  syncProcessUserSpeechDeps,
  syncWebTabRestoreSessionDeps,
} from '@features/aria/syncAriaInterviewTurnHandlerDepsRefs';

export { syncAriaInterviewMicPipelineDeps } from '@features/aria/syncAriaInterviewMicPipelineDepsRefs';

export {
  syncSessionLifecycleDeps,
  syncScoreInterviewDeps,
  syncAriaInterviewLifecycleDeps,
} from '@features/aria/syncAriaInterviewLifecycleDepsRefs';

export {
  syncDeliverRecordingRetryLineDeps,
  syncInterruptDocumentHiddenTtsDeps,
  syncInterviewDocumentVisibilityTtsDeps,
  syncTabRestoreWatchdogDeps,
} from '@features/aria/syncAriaInterviewDocumentTtsDepsRefs';

export {
  syncPerformInterviewRetakeDeps,
  syncHandleRecordingErrorDeps,
  syncApplyRouteProbeAfterResumeDeps,
  syncPerformAdminInterviewResetDeps,
  syncInterviewWebSpeechRecognitionDeps,
  syncHandleSendTypedDeps,
  syncFetchStageScoreDeps,
  syncSubmitPostInterviewFeedbackDeps,
  syncLoadPostInterviewFeedbackDeps,
} from '@features/aria/syncAriaInterviewInputAndRetakeDepsRefs';

export {
  syncSaveScenarioCheckpointDeps,
  syncSaveActiveInterviewProgressDeps,
  syncDebouncedLiveTranscriptSyncDeps,
  syncInterviewScenarioTransitionUiDeps,
  syncApplyReferenceCardFromAssistantSpeechDeps,
  syncScenarioBoundaryScoringDeps,
} from '@features/aria/syncAriaInterviewPersistenceDepsRefs';

export {
  syncInterviewAttemptBootstrapDeps,
  syncInterviewWebGreetingPrefetchDeps,
  syncEnsureValidSessionDeps,
  syncInterviewUnhandledRejectionSaveDeps,
  syncInterviewAuthSignedOutSaveDeps,
  syncRestorePreparingResultsInterviewStatusDeps,
  syncCheckInterviewStatusDeps,
} from '@features/aria/syncAriaInterviewBootstrapDepsRefs';

export {
  syncPendingScoringSyncPollDeps,
  syncInterviewLoadingStatusFailsafeDeps,
  syncAlphaModeCongratulationsFailsafeDeps,
  syncLoadStandardResultsReferralCodeDeps,
  syncRecoverPendingDatabaseSaveDeps,
} from '@features/aria/syncAriaInterviewPostScoringDepsRefs';

export {
  syncWebMicPressLifecycleDeps,
  syncPreparingResultsFailsafeDeps,
  syncWebResumeWelcomeTapDeps,
  syncAriaInterviewMicCluster,
} from '@features/aria/syncAriaInterviewWebMicDepsRefs';

export {
  syncResetScenarioCClientGatesDeps,
  syncClosingQuestionActionsDeps,
  syncInterviewAssistantMetaExemptionDeps,
  syncResetInterviewProgressDeps,
  syncResolveAssistantScenarioNumberDeps,
  syncProcessTurnAudioDeps,
  syncSyncCurrentMessagesRefDeps,
  syncElongatingProbeFromMessagesDeps,
  syncTranscriptScenarioLogDeps,
  syncAdminScoreCardRenderLogDeps,
  syncReasoningProgressResetDeps,
  syncInterviewNetworkStatusCheckDeps,
  syncNavigateBackToValidationReportDeps,
  syncOpenAdminPanelFromRouteDeps,
  syncAriaScreenMountedLogDeps,
  syncProfileNameSourceDebugDeps,
  syncInterviewScrollToEndDeps,
  syncShowChatErrorDeps,
  syncApplyInterviewSpeechCompleteDeps,
  syncPostInterviewFeedbackAlertDeps,
} from '@features/aria/syncAriaInterviewDiagnosticDepsRefs';
