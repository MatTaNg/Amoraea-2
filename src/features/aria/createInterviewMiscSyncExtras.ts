import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';



type SyncExtraParams = AriaInterviewDepsSyncContext;



export function createNavigateBackToValidationReportSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createOpenAdminPanelFromRouteSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createAriaScreenMountedLogSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createInterviewScrollToEndSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createShowChatErrorSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createApplyInterviewSpeechCompleteSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createPostInterviewFeedbackAlertSyncExtra(params: SyncExtraParams): SyncExtraParams {

  return params;

}



export function createProfileNameSourceDebugSyncExtra(params: SyncExtraParams) {

  return {

    getInterviewUserFirstNameForPrompt: params.getInterviewUserFirstNameForPrompt,

    writeSessionLog: params.writeSessionLog,

    getSessionLogRuntime: params.getSessionLogRuntime,

  };

}



export function createInterviewWebRuntimeSyncExtra(params: SyncExtraParams): AriaInterviewDepsSyncContext {

  return params;

}

