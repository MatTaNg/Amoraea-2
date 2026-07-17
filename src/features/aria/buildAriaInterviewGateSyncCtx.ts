import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { AriaInterviewGateSyncScope } from '@features/aria/ariaInterviewGateSyncScopeTypes';
import {
  createInterviewGateClosingSyncSlice,
  createInterviewGateIdentitySyncSlice,
  createInterviewGateMetaSkipSyncSlice,
  createInterviewGateMomentScenarioSyncSlice,
  createInterviewGateProgressResetSyncSlice,
  createInterviewGateResumeEmotionSyncSlice,
  createInterviewGateWebTtsSyncSlice,
} from '@features/aria/createInterviewGateSyncSlices';
import { assignDefinedSyncSlices } from '@features/aria/syncAriaInterviewDepsTypes';

export type { AriaInterviewGateSyncScope } from '@features/aria/ariaInterviewGateSyncScopeTypes';

type SyncExtraParams = AriaInterviewDepsSyncContext;
/** Merge grouped gate sync slices into one context object for dep sync. */
export function buildAriaInterviewGateSyncCtx(scope: AriaInterviewGateSyncScope): SyncExtraParams {
  return assignDefinedSyncSlices(
    createInterviewGateIdentitySyncSlice(scope.identity),
    createInterviewGateClosingSyncSlice(scope.closing),
    createInterviewGateMetaSkipSyncSlice(scope.metaSkip),
    createInterviewGateMomentScenarioSyncSlice(scope.moments),
    createInterviewGateWebTtsSyncSlice(scope.webTts),
    createInterviewGateResumeEmotionSyncSlice(scope.resumeEmotion),
    createInterviewGateProgressResetSyncSlice(scope.progressReset),
  );
}
