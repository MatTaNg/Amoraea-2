import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { InterviewWebSpeechRecognitionLocalScope } from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import {
  buildApplyRouteProbeAfterResumeLocalSyncExtra,
  buildHandleRecordingErrorLocalSyncExtra,
  buildHandleSendTypedLocalSyncExtra,
  buildInterviewWebSpeechRecognitionLocalSyncExtra,
} from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { SaveScenarioCheckpointLocalScope } from '@features/aria/buildInterviewScenarioScoringAuxSyncExtras';
import { buildSaveScenarioCheckpointLocalSyncExtra } from '@features/aria/buildInterviewScenarioScoringAuxSyncExtras';
import type { InterviewTurnHandlerLocalScope } from '@features/aria/buildInterviewTurnHandlerLocalSyncExtra';
import { buildInterviewTurnHandlerLocalSyncExtra } from '@features/aria/buildInterviewTurnHandlerLocalSyncExtra';
import type { InterviewSessionLifecycleLocalScope } from '@features/aria/buildInterviewSessionLifecycleLocalSyncExtra';
import { buildInterviewSessionLifecycleLocalSyncExtra } from '@features/aria/buildInterviewSessionLifecycleLocalSyncExtra';
import type { InterviewCompletionScoringLocalScope } from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import { buildInterviewCompletionScoringLocalSyncExtra } from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import type { HandleRecordingErrorLocalScope } from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { ApplyRouteProbeAfterResumeLocalScope } from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { HandleSendTypedLocalScope } from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import {
  mergeAriaInterviewCoreGateServicesBaseWithLocalSyncCtx,
  mergeAriaInterviewCoreGateServicesFullWithLocalSyncCtx,
  mergeAriaInterviewCoreWithLocalSyncCtx,
  mergeAriaInterviewServicesBaseWithLocalSyncCtx,
} from '@features/aria/mergeAriaInterviewSyncContextHelpers';

export function buildInterviewWebSpeechRecognitionMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewWebSpeechRecognitionLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildInterviewWebSpeechRecognitionLocalSyncExtra(localScope),
  );
}

export function buildHandleRecordingErrorMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: HandleRecordingErrorLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(coreCtx, buildHandleRecordingErrorLocalSyncExtra(localScope));
}

export function buildApplyRouteProbeAfterResumeMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: ApplyRouteProbeAfterResumeLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildApplyRouteProbeAfterResumeLocalSyncExtra(localScope),
  );
}

export function buildHandleSendTypedMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: HandleSendTypedLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(coreCtx, buildHandleSendTypedLocalSyncExtra(localScope));
}

export function buildSaveScenarioCheckpointMergedSyncCtx(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  localScope: SaveScenarioCheckpointLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewServicesBaseWithLocalSyncCtx(
    servicesBaseCtx,
    buildSaveScenarioCheckpointLocalSyncExtra(localScope),
  );
}

export function buildInterviewTurnHandlerMergedSyncCtx(
  baseCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewTurnHandlerLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreGateServicesBaseWithLocalSyncCtx(
    baseCtx,
    buildInterviewTurnHandlerLocalSyncExtra(localScope),
  );
}

export function buildInterviewSessionLifecycleMergedSyncCtx(
  baseCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewSessionLifecycleLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreGateServicesBaseWithLocalSyncCtx(
    baseCtx,
    buildInterviewSessionLifecycleLocalSyncExtra(localScope),
  );
}

export function buildInterviewCompletionScoringMergedSyncCtx(
  fullCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewCompletionScoringLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreGateServicesFullWithLocalSyncCtx(
    fullCtx,
    buildInterviewCompletionScoringLocalSyncExtra(localScope),
  );
}
