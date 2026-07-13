import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { PerformInterviewRetakeLocalScope } from '@features/aria/buildPerformInterviewRetakeLocalSyncExtra';
import { buildPerformInterviewRetakeLocalSyncExtra } from '@features/aria/buildPerformInterviewRetakeLocalSyncExtra';
import type { PerformAdminInterviewResetLocalScope } from '@features/aria/buildPerformAdminInterviewResetLocalSyncExtra';
import { buildPerformAdminInterviewResetLocalSyncExtra } from '@features/aria/buildPerformAdminInterviewResetLocalSyncExtra';
import type {
  LoadPostInterviewFeedbackLocalScope,
  SubmitPostInterviewFeedbackLocalScope,
} from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import {
  buildLoadPostInterviewFeedbackLocalSyncExtra,
  buildSubmitPostInterviewFeedbackLocalSyncExtra,
} from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import {
  mergeAriaInterviewCoreWithLocalSyncCtx,
  mergeAriaInterviewServicesBaseWithLocalSyncCtx,
} from '@features/aria/mergeAriaInterviewSyncContextHelpers';

export function buildPerformInterviewRetakeMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: PerformInterviewRetakeLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(coreCtx, buildPerformInterviewRetakeLocalSyncExtra(localScope));
}

export function buildPerformAdminInterviewResetMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: PerformAdminInterviewResetLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildPerformAdminInterviewResetLocalSyncExtra(localScope),
  );
}

export function buildSubmitPostInterviewFeedbackMergedSyncCtx(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  localScope: SubmitPostInterviewFeedbackLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewServicesBaseWithLocalSyncCtx(
    servicesBaseCtx,
    buildSubmitPostInterviewFeedbackLocalSyncExtra(localScope),
  );
}

export function buildLoadPostInterviewFeedbackMergedSyncCtx(
  servicesBaseCtx: AriaInterviewDepsSyncContext,
  localScope: LoadPostInterviewFeedbackLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewServicesBaseWithLocalSyncCtx(
    servicesBaseCtx,
    buildLoadPostInterviewFeedbackLocalSyncExtra(localScope),
  );
}
