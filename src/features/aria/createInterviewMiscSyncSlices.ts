import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export function createNavigateBackToValidationReportSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    navigation: params.navigation,
  };
}

export function createOpenAdminPanelFromRouteSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setShowAdminPanel: params.setShowAdminPanel,
    navigation: params.navigation,
  };
}

export function createAriaScreenMountedLogSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    remoteLog: params.remoteLog,
  };
}

export function createInterviewScrollToEndSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    scrollViewRef: params.scrollViewRef,
  };
}

export function createShowChatErrorSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    setMessages: params.setMessages,
    setConversationErrorNotice: params.setConversationErrorNotice,
  };
}

export function createApplyInterviewSpeechCompleteSyncSlice(params: SyncExtraParams): SyncExtraParams {
  const hasScenarioRefSync =
    params.currentScenarioRef != null &&
    params.currentInterviewMomentRef != null &&
    params.interviewMomentsCompleteRef != null &&
    params.resumeActiveScenarioRef != null;
  return {
    applyReferenceCardFromAssistantSpeech: params.applyReferenceCardFromAssistantSpeech,
    ...(hasScenarioRefSync
      ? {
          scenarioRefSync: {
            currentScenarioRef: params.currentScenarioRef,
            currentInterviewMomentRef: params.currentInterviewMomentRef,
            interviewMomentsCompleteRef: params.interviewMomentsCompleteRef,
            resumeActiveScenarioRef: params.resumeActiveScenarioRef,
            interviewSessionIdRef: params.interviewSessionIdRef,
          },
        }
      : {}),
  };
}

export function createPostInterviewFeedbackAlertSyncSlice(params: SyncExtraParams): SyncExtraParams {
  return {
    showSimpleAlert: params.showSimpleAlert,
  };
}
