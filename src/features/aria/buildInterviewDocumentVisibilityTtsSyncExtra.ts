import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewDocumentVisibilityHandlerSyncSlice,
  createInterviewDocumentVisibilityRestoreSyncSlice,
  createInterviewDocumentVisibilitySessionSyncSlice,
} from '@features/aria/createInterviewDocumentVisibilityTtsSyncSlices';

/** Pick document-visibility TTS dep-sync fields from a merged interview sync context. */
export function buildInterviewDocumentVisibilityTtsSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewDocumentVisibilityHandlerSyncSlice(params),
    createInterviewDocumentVisibilitySessionSyncSlice(params),
    createInterviewDocumentVisibilityRestoreSyncSlice(params),
  );
}

export type InterviewDocumentVisibilityTtsLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'docVisibilityWasHiddenRef'
  | 'interruptInterviewTtsForDocumentHidden'
  | 'syncInterviewTtsAfterScreenReturn'
  | 'ensureWebGestureFlushListener'
  | 'handleWebTabGestureRestoreTapRef'
  | 'hasWebInterviewHtmlAudioTabResumePending'
  | 'isWebInterviewPlaybackAudiblyActive'
>;

export function buildInterviewDocumentVisibilityTtsLocalSyncExtra(
  scope: InterviewDocumentVisibilityTtsLocalScope,
): AriaInterviewDepsSyncContext {
  return scope;
}
