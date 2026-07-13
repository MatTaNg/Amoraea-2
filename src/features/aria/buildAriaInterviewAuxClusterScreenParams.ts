import { Platform } from 'react-native';

import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import { TAB_RESTORE_HTML_PLAY_START_TIMEOUT_MS } from '@features/aria/interviewTtsSpeakOptions';
import {
  createDeliverRecordingRetryLineSyncExtra,
  createHandleRecordingErrorSyncExtra,
  createApplyRouteProbeAfterResumeSyncExtra,
  createHandleSendTypedSyncExtra,
  createInterviewWebSpeechRecognitionSyncExtra,
  createSaveScenarioCheckpointSyncExtra,
} from '@features/aria/createInterviewTtsAuxSyncExtras';
import {
  createInterruptDocumentHiddenTtsSyncExtra,
  createInterviewDocumentVisibilityTtsSyncExtra,
} from '@features/aria/createInterviewDocumentTtsSyncExtras';
import {
  createLoadPostInterviewFeedbackSyncExtra,
  createPerformAdminInterviewResetSyncExtra,
  createPerformInterviewRetakeSyncExtra,
  createSubmitPostInterviewFeedbackSyncExtra,
  createWebResumeWelcomeTapSyncExtra,
} from '@features/aria/createInterviewAdminActionSyncExtras';
import { createInterviewCompletionScoringSyncExtra } from '@features/aria/createInterviewCompletionScoringSyncExtra';
import { buildDeliverRecordingRetryLineSyncExtra } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
import { buildInterruptDocumentHiddenTtsSyncExtra } from '@features/aria/buildInterruptDocumentHiddenTtsSyncExtra';
import { buildInterviewDocumentVisibilityTtsSyncExtra } from '@features/aria/buildInterviewDocumentVisibilityTtsSyncExtra';
import {
  buildApplyRouteProbeAfterResumeSyncExtra,
  buildHandleRecordingErrorSyncExtra,
  buildHandleSendTypedSyncExtra,
  buildInterviewWebSpeechRecognitionSyncExtra,
} from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import { buildSaveScenarioCheckpointSyncExtra } from '@features/aria/buildInterviewScenarioScoringAuxSyncExtras';
import {
  buildLoadPostInterviewFeedbackMergedSyncCtx,
  buildPerformAdminInterviewResetMergedSyncCtx,
  buildPerformInterviewRetakeMergedSyncCtx,
  buildSubmitPostInterviewFeedbackMergedSyncCtx,
} from '@features/aria/buildInterviewAdminActionMergedSyncCtx';
import {
  buildApplyRouteProbeAfterResumeMergedSyncCtx,
  buildHandleRecordingErrorMergedSyncCtx,
  buildHandleSendTypedMergedSyncCtx,
  buildInterviewCompletionScoringMergedSyncCtx,
  buildInterviewWebSpeechRecognitionMergedSyncCtx,
  buildSaveScenarioCheckpointMergedSyncCtx,
} from '@features/aria/buildInterviewClusterMergedSyncCtx';
import {
  buildDeliverRecordingRetryLineMergedSyncCtx,
  buildInterruptDocumentHiddenTtsMergedSyncCtx,
  buildInterviewDocumentVisibilityTtsMergedSyncCtx,
} from '@features/aria/buildInterviewDocumentTtsMergedSyncCtx';
import { buildInterviewCompletionScoringSyncExtra } from '@features/aria/buildInterviewCompletionScoringSyncExtra';
import { buildPerformAdminInterviewResetSyncExtra } from '@features/aria/buildPerformAdminInterviewResetSyncExtra';
import { buildPerformInterviewRetakeSyncExtra } from '@features/aria/buildPerformInterviewRetakeSyncExtra';
import type { DeliverRecordingRetryLineLocalScope } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
import type { InterruptDocumentHiddenTtsLocalScope } from '@features/aria/buildInterruptDocumentHiddenTtsSyncExtra';
import type { InterviewDocumentVisibilityTtsLocalScope } from '@features/aria/buildInterviewDocumentVisibilityTtsSyncExtra';
import type { TabRestoreWatchdogLocalScope } from '@features/aria/buildInterviewTabRestoreLocalSyncExtras';
import { buildTabRestoreWatchdogLocalSyncExtra } from '@features/aria/buildInterviewTabRestoreLocalSyncExtras';
import type {
  ApplyRouteProbeAfterResumeLocalScope,
  HandleRecordingErrorLocalScope,
  HandleSendTypedLocalScope,
  InterviewWebSpeechRecognitionLocalScope,
} from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { SaveScenarioCheckpointLocalScope } from '@features/aria/buildInterviewScenarioScoringAuxSyncExtras';
import type { WebResumeWelcomeTapLocalScope } from '@features/aria/buildWebResumeWelcomeTapSyncExtra';
import { buildWebResumeWelcomeTapMergedSyncCtx, buildWebResumeWelcomeTapSyncExtra } from '@features/aria/buildWebResumeWelcomeTapSyncExtra';
import type {
  InterviewCompletionScoringLocalScope,
  LoadPostInterviewFeedbackLocalScope,
  SubmitPostInterviewFeedbackLocalScope,
} from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import type { PerformAdminInterviewResetLocalScope } from '@features/aria/buildPerformAdminInterviewResetLocalSyncExtra';
import type { PerformInterviewRetakeLocalScope } from '@features/aria/buildPerformInterviewRetakeLocalSyncExtra';

export type DeliverRecordingRetryLineScreenRefs = DeliverRecordingRetryLineLocalScope;
export type InterruptDocumentHiddenTtsScreenRefs = InterruptDocumentHiddenTtsLocalScope;
export type InterviewDocumentVisibilityTtsScreenRefs = InterviewDocumentVisibilityTtsLocalScope;
export type TabRestoreWatchdogLocalScreenRefs = Omit<
  TabRestoreWatchdogLocalScope,
  'tabRestoreHtmlPlayStartTimeoutMs'
>;

export type TabRestoreWatchdogScreenRefs = {
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  webRuntimeCtx: AriaInterviewDepsSyncContext;
  tabRestoreWatchdog: TabRestoreWatchdogLocalScreenRefs;
};

export type WebTabRestoreSessionScreenRefs = {
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  webRuntimeCtx: AriaInterviewDepsSyncContext;
  coreCtx: AriaInterviewDepsSyncContext;
};
export type HandleRecordingErrorScreenRefs = Omit<HandleRecordingErrorLocalScope, 'useWebCopy'>;
export type ApplyRouteProbeAfterResumeScreenRefs = ApplyRouteProbeAfterResumeLocalScope;
export type HandleSendTypedScreenRefs = HandleSendTypedLocalScope;
export type InterviewWebSpeechRecognitionScreenRefs = InterviewWebSpeechRecognitionLocalScope;
export type SaveScenarioCheckpointScreenRefs = SaveScenarioCheckpointLocalScope;
export type WebResumeWelcomeTapScreenRefs = WebResumeWelcomeTapLocalScope;
export type InterviewCompletionScoringScreenRefs = InterviewCompletionScoringLocalScope;
export type PerformInterviewRetakeScreenRefs = PerformInterviewRetakeLocalScope;
export type PerformAdminInterviewResetScreenRefs = PerformAdminInterviewResetLocalScope;
export type SubmitPostInterviewFeedbackScreenRefs = SubmitPostInterviewFeedbackLocalScope;
export type LoadPostInterviewFeedbackScreenRefs = LoadPostInterviewFeedbackLocalScope;

export function createDeliverRecordingRetryLineSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: DeliverRecordingRetryLineScreenRefs,
): AriaInterviewDepsSyncContext {
  return createDeliverRecordingRetryLineSyncExtra(
    buildDeliverRecordingRetryLineSyncExtra(buildDeliverRecordingRetryLineMergedSyncCtx(coreCtx, local)),
  );
}

export function createInterruptDocumentHiddenTtsSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: InterruptDocumentHiddenTtsScreenRefs,
): AriaInterviewDepsSyncContext {
  return createInterruptDocumentHiddenTtsSyncExtra(
    buildInterruptDocumentHiddenTtsSyncExtra(buildInterruptDocumentHiddenTtsMergedSyncCtx(coreCtx, local)),
  );
}

export function createInterviewDocumentVisibilityTtsSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: InterviewDocumentVisibilityTtsScreenRefs,
): AriaInterviewDepsSyncContext {
  return createInterviewDocumentVisibilityTtsSyncExtra(
    buildInterviewDocumentVisibilityTtsSyncExtra(
      buildInterviewDocumentVisibilityTtsMergedSyncCtx(coreCtx, local),
    ),
  );
}

export function createTabRestoreWatchdogSyncCtxFromScreen(
  refs: TabRestoreWatchdogScreenRefs,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewSyncCtx(refs.coreGateServicesBaseCtx, refs.webRuntimeCtx),
    buildTabRestoreWatchdogLocalSyncExtra({
      ...refs.tabRestoreWatchdog,
      tabRestoreHtmlPlayStartTimeoutMs: TAB_RESTORE_HTML_PLAY_START_TIMEOUT_MS,
    }),
  );
}

/** Full sync ctx for tab-restore tap replay (web runtime + core TTS refs). */
export function createWebTabRestoreSessionSyncCtxFromScreen(
  refs: WebTabRestoreSessionScreenRefs,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewSyncCtx(refs.coreGateServicesBaseCtx, refs.webRuntimeCtx),
    refs.coreCtx,
  );
}

export function createHandleRecordingErrorSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: HandleRecordingErrorScreenRefs = {},
): AriaInterviewDepsSyncContext {
  return createHandleRecordingErrorSyncExtra(
    buildHandleRecordingErrorSyncExtra(
      buildHandleRecordingErrorMergedSyncCtx(coreCtx, {
        ...local,
        useWebCopy: Platform.OS === 'web',
      }),
    ),
  );
}

export function createApplyRouteProbeAfterResumeSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: ApplyRouteProbeAfterResumeScreenRefs,
): AriaInterviewDepsSyncContext {
  return createApplyRouteProbeAfterResumeSyncExtra(
    buildApplyRouteProbeAfterResumeSyncExtra(buildApplyRouteProbeAfterResumeMergedSyncCtx(coreCtx, local)),
  );
}

export function createHandleSendTypedSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: HandleSendTypedScreenRefs,
): AriaInterviewDepsSyncContext {
  return createHandleSendTypedSyncExtra(
    buildHandleSendTypedSyncExtra(buildHandleSendTypedMergedSyncCtx(coreCtx, local)),
  );
}

export function createInterviewWebSpeechRecognitionSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: InterviewWebSpeechRecognitionScreenRefs,
): AriaInterviewDepsSyncContext {
  return createInterviewWebSpeechRecognitionSyncExtra(
    buildInterviewWebSpeechRecognitionSyncExtra(
      buildInterviewWebSpeechRecognitionMergedSyncCtx(coreCtx, local),
    ),
  );
}

export function createSaveScenarioCheckpointSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  local: SaveScenarioCheckpointScreenRefs,
): AriaInterviewDepsSyncContext {
  return createSaveScenarioCheckpointSyncExtra(
    buildSaveScenarioCheckpointSyncExtra(
      buildSaveScenarioCheckpointMergedSyncCtx(servicesBaseCtx, local),
    ),
  );
}

export function createWebResumeWelcomeTapSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: WebResumeWelcomeTapScreenRefs,
): AriaInterviewDepsSyncContext {
  return createWebResumeWelcomeTapSyncExtra(
    buildWebResumeWelcomeTapSyncExtra(buildWebResumeWelcomeTapMergedSyncCtx(coreCtx, local)),
  );
}

export function createInterviewCompletionScoringSyncCtxFromScreen(
  fullCtx: AriaInterviewDepsSyncContext,
  local: InterviewCompletionScoringScreenRefs,
): AriaInterviewDepsSyncContext {
  return createInterviewCompletionScoringSyncExtra(
    buildInterviewCompletionScoringSyncExtra(
      buildInterviewCompletionScoringMergedSyncCtx(fullCtx, local),
    ),
  );
}

export function createPerformInterviewRetakeSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: PerformInterviewRetakeScreenRefs,
): AriaInterviewDepsSyncContext {
  return createPerformInterviewRetakeSyncExtra(
    buildPerformInterviewRetakeSyncExtra(buildPerformInterviewRetakeMergedSyncCtx(coreCtx, local)),
  );
}

export function createPerformAdminInterviewResetSyncCtxFromScreen(
  coreCtx: AriaInterviewDepsSyncContext,
  local: PerformAdminInterviewResetScreenRefs,
): AriaInterviewDepsSyncContext {
  return createPerformAdminInterviewResetSyncExtra(
    buildPerformAdminInterviewResetSyncExtra(buildPerformAdminInterviewResetMergedSyncCtx(coreCtx, local)),
  );
}

export function createSubmitPostInterviewFeedbackSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  local: SubmitPostInterviewFeedbackScreenRefs,
): AriaInterviewDepsSyncContext {
  return createSubmitPostInterviewFeedbackSyncExtra(
    buildSubmitPostInterviewFeedbackMergedSyncCtx(servicesBaseCtx, local),
  );
}

export function createLoadPostInterviewFeedbackSyncCtxFromScreen(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  local: LoadPostInterviewFeedbackScreenRefs,
): AriaInterviewDepsSyncContext {
  return createLoadPostInterviewFeedbackSyncExtra(
    buildLoadPostInterviewFeedbackMergedSyncCtx(servicesBaseCtx, local),
  );
}
