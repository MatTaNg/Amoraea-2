import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewInterruptDocumentHiddenGestureSyncSlice,
  createInterviewInterruptDocumentHiddenIdentitySyncSlice,
  createInterviewInterruptDocumentHiddenPlaybackSyncSlice,
  createInterviewInterruptDocumentHiddenTtsFlightSyncSlice,
} from '@features/aria/createInterviewInterruptDocumentHiddenTtsSyncSlices';

/** Pick document-hidden TTS interrupt dep-sync fields from a merged interview sync context. */
export function buildInterruptDocumentHiddenTtsSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewInterruptDocumentHiddenIdentitySyncSlice(params),
    createInterviewInterruptDocumentHiddenTtsFlightSyncSlice(params),
    createInterviewInterruptDocumentHiddenPlaybackSyncSlice(params),
    createInterviewInterruptDocumentHiddenGestureSyncSlice(params),
  );
}

export type InterruptDocumentHiddenTtsLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'isWebInterviewPlaybackSurfaceActive'
  | 'gestureContextLostAtRef'
  | 'isMobileWebInterviewTtsSessionActive'
  | 'armMobileWebBackgroundTtsContinue'
  | 'setTtsPlaybackActive'
>;

export function buildInterruptDocumentHiddenTtsLocalSyncExtra(
  scope: InterruptDocumentHiddenTtsLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
