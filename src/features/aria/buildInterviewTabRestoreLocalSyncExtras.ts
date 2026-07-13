import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type TabRestoreWatchdogLocalScope = Pick<
  SyncExtraParams,
  | 'webTabGestureRestoreOverlayRef'
  | 'isWebInterviewPlaybackSurfaceActive'
  | 'isWebInterviewPlaybackAudiblyActive'
  | 'hasWebInterviewHtmlAudioTabResumePending'
  | 'isWebInterviewMidUtteranceTabResumeActive'
  | 'isInterviewerOutputActiveForMicGate'
  | 'queueMobileWebHtmlResumeAfterScreenReturn'
  | 'resolveStaleWebTtsRuntimeLockThresholdMs'
  | 'clearStaleWebInterviewTtsRuntimeLocks'
  | 'dismissAfterAndroidBackgroundPlaybackEnd'
  | 'dismissTabRestoreOverlay'
  | 'ensureWebGestureFlushListener'
  | 'setWebInterviewerOutputActive'
  | 'tabRestoreHtmlPlayStartTimeoutMs'
  | 'staleWebTtsRuntimeLockSinceMsRef'
  | 'speakingWithoutPlaybackSinceMsRef'
>;

export function buildTabRestoreWatchdogLocalSyncExtra(scope: TabRestoreWatchdogLocalScope): SyncExtraParams {
  return scope;
}
