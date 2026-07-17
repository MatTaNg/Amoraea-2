import { Platform } from 'react-native';

import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createDeliverRecordingRetryLineSyncExtra,
  createHandleRecordingErrorSyncExtra,
  createApplyRouteProbeAfterResumeSyncExtra,
  createHandleSendTypedSyncExtra,
  createInterviewWebSpeechRecognitionSyncExtra,
  createSaveScenarioCheckpointSyncExtra,
} from '@features/aria/createInterviewTtsAuxSyncExtras';
import {
  createLoadPostInterviewFeedbackSyncExtra,
  createPerformAdminInterviewResetSyncExtra,
  createPerformInterviewRetakeSyncExtra,
  createSubmitPostInterviewFeedbackSyncExtra,
} from '@features/aria/createInterviewAdminActionSyncExtras';
import { createInterviewCompletionScoringSyncExtra } from '@features/aria/createInterviewCompletionScoringSyncExtra';
import { buildDeliverRecordingRetryLineSyncExtra } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
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
import { buildDeliverRecordingRetryLineMergedSyncCtx } from '@features/aria/buildInterviewDocumentTtsMergedSyncCtx';
import { buildInterviewCompletionScoringSyncExtra } from '@features/aria/buildInterviewCompletionScoringSyncExtra';
import { buildPerformAdminInterviewResetSyncExtra } from '@features/aria/buildPerformAdminInterviewResetSyncExtra';
import { buildPerformInterviewRetakeSyncExtra } from '@features/aria/buildPerformInterviewRetakeSyncExtra';
import type { DeliverRecordingRetryLineLocalScope } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
import type {
  ApplyRouteProbeAfterResumeLocalScope,
  HandleRecordingErrorLocalScope,
  HandleSendTypedLocalScope,
  InterviewWebSpeechRecognitionLocalScope,
} from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { SaveScenarioCheckpointLocalScope } from '@features/aria/buildInterviewScenarioScoringAuxSyncExtras';
import type {
  InterviewCompletionScoringLocalScope,
  LoadPostInterviewFeedbackLocalScope,
  SubmitPostInterviewFeedbackLocalScope,
} from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import type { PerformAdminInterviewResetLocalScope } from '@features/aria/buildPerformAdminInterviewResetLocalSyncExtra';
import type { PerformInterviewRetakeLocalScope } from '@features/aria/buildPerformInterviewRetakeLocalSyncExtra';

export type DeliverRecordingRetryLineScreenRefs = DeliverRecordingRetryLineLocalScope;

export type WebTabRestoreSessionScreenRefs = {
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  runtimeCtx: AriaInterviewDepsSyncContext;
  coreCtx: AriaInterviewDepsSyncContext;
};
export type HandleRecordingErrorScreenRefs = Omit<HandleRecordingErrorLocalScope, 'useWebCopy'>;
export type ApplyRouteProbeAfterResumeScreenRefs = ApplyRouteProbeAfterResumeLocalScope;
export type HandleSendTypedScreenRefs = HandleSendTypedLocalScope;
export type InterviewWebSpeechRecognitionScreenRefs = InterviewWebSpeechRecognitionLocalScope;
export type SaveScenarioCheckpointScreenRefs = SaveScenarioCheckpointLocalScope;
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

/** Full sync ctx for tab-restore tap replay (web runtime + core TTS refs). */
export function createWebTabRestoreSessionSyncCtxFromScreen(
  refs: WebTabRestoreSessionScreenRefs,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewSyncCtx(
    mergeAriaInterviewSyncCtx(refs.coreGateServicesBaseCtx, refs.runtimeCtx),
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
