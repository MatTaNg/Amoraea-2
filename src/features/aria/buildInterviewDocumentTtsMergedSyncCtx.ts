import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewCoreWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';
import type { DeliverRecordingRetryLineLocalScope } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
import { buildDeliverRecordingRetryLineLocalSyncExtra } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
import type { InterruptDocumentHiddenTtsLocalScope } from '@features/aria/buildInterruptDocumentHiddenTtsSyncExtra';
import { buildInterruptDocumentHiddenTtsLocalSyncExtra } from '@features/aria/buildInterruptDocumentHiddenTtsSyncExtra';
import type { InterviewDocumentVisibilityTtsLocalScope } from '@features/aria/buildInterviewDocumentVisibilityTtsSyncExtra';
import { buildInterviewDocumentVisibilityTtsLocalSyncExtra } from '@features/aria/buildInterviewDocumentVisibilityTtsSyncExtra';
import type { TabRestoreWatchdogLocalScope } from '@features/aria/buildInterviewTabRestoreLocalSyncExtras';
import { buildTabRestoreWatchdogLocalSyncExtra } from '@features/aria/buildInterviewTabRestoreLocalSyncExtras';

export function buildDeliverRecordingRetryLineMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: DeliverRecordingRetryLineLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildDeliverRecordingRetryLineLocalSyncExtra(localScope),
  );
}

export function buildInterruptDocumentHiddenTtsMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: InterruptDocumentHiddenTtsLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildInterruptDocumentHiddenTtsLocalSyncExtra(localScope),
  );
}

export function buildInterviewDocumentVisibilityTtsMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: InterviewDocumentVisibilityTtsLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildInterviewDocumentVisibilityTtsLocalSyncExtra(localScope),
  );
}

export function buildTabRestoreWatchdogMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: TabRestoreWatchdogLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(coreCtx, buildTabRestoreWatchdogLocalSyncExtra(localScope));
}
