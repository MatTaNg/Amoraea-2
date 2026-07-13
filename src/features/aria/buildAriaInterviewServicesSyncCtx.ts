import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewServicesBootstrapSyncSlice,
  createInterviewServicesIdentitySyncSlice,
  createInterviewServicesLiveStateSyncSlice,
  createInterviewServicesRoutingSyncSlice,
  createInterviewServicesSessionRefsSyncSlice,
  createInterviewServicesStoragePipelineSyncSlice,
  createInterviewServicesTranscriptHelpersSyncSlice,
  createInterviewServicesUiSettersSyncSlice,
} from '@features/aria/createInterviewServicesSyncSlices';

export type AriaInterviewServicesSyncScope = {
  identity: AriaInterviewDepsSyncContext;
  sessionRefs: AriaInterviewDepsSyncContext;
  liveState: AriaInterviewDepsSyncContext;
  routing: AriaInterviewDepsSyncContext;
  storagePipeline: AriaInterviewDepsSyncContext;
  bootstrap: AriaInterviewDepsSyncContext;
  uiSetters: AriaInterviewDepsSyncContext;
  transcriptHelpers: AriaInterviewDepsSyncContext;
};

/** Merge grouped services sync slices into one context object for dep sync. */
export function buildAriaInterviewServicesSyncCtx(scope: AriaInterviewServicesSyncScope): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewServicesIdentitySyncSlice(scope.identity),
    createInterviewServicesSessionRefsSyncSlice(scope.sessionRefs),
    createInterviewServicesLiveStateSyncSlice(scope.liveState),
    createInterviewServicesRoutingSyncSlice(scope.routing),
    createInterviewServicesStoragePipelineSyncSlice(scope.storagePipeline),
    createInterviewServicesBootstrapSyncSlice(scope.bootstrap),
    createInterviewServicesUiSettersSyncSlice(scope.uiSetters),
    createInterviewServicesTranscriptHelpersSyncSlice(scope.transcriptHelpers),
  );
}
