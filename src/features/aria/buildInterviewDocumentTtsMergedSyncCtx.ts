import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewCoreWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';
import type { DeliverRecordingRetryLineLocalScope } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';
import { buildDeliverRecordingRetryLineLocalSyncExtra } from '@features/aria/buildDeliverRecordingRetryLineSyncExtra';

export function buildDeliverRecordingRetryLineMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: DeliverRecordingRetryLineLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildDeliverRecordingRetryLineLocalSyncExtra(localScope),
  );
}
