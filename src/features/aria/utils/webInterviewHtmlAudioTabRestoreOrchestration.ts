/**
 * Backward-compatible barrel for HTML audio tab-restore orchestration.
 * Implementation lives in focused modules under this directory.
 */

export { clearHtmlAudioTabResumeState } from './webInterviewTabRestoreCapture';
export {
  attachTabStashHtmlAudioPlaybackHandoff,
  clearWebInterviewHtmlTabRestoreState,
  holdTabStashedHtmlAudioForGestureResume,
  pauseActiveWebInterviewHtmlAudioWithoutRevoke,
  refreshWebInterviewHtmlTabStashForRepeatHide,
  restoreWebInterviewTabStashedPlaybackVolume,
  syncTabStashHtmlAudioPositionForResumeReturn,
} from './webInterviewTabRestoreStashOps';
export {
  canSoftPauseActiveWebHtmlAudioForTabResume,
  resumeWebInterviewHtmlAudioAfterTabHide,
  softPauseActiveWebHtmlAudioForTabHide,
  tryPrepareWebInterviewHtmlAudioTabResume,
} from './webInterviewTabHideAudioPause';
export { trySyncStartTabRestoreHtmlPlaybackInUserGesture } from './webInterviewTabRestoreSyncPlay';

import { bindWebInterviewSharedHtmlAudioActiveElement } from './webInterviewSharedHtmlAudio';
import { getActiveWebHtmlAudioElement } from './webInterviewActiveHtmlAudio';

bindWebInterviewSharedHtmlAudioActiveElement(getActiveWebHtmlAudioElement);
