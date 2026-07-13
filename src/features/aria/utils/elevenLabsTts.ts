/**
 * Backward-compatible barrel for interview TTS utilities.
 * Implementation lives in focused modules under this directory.
 */

export { captureWebSpeechSynthTabRestoreText } from './webSpeechSynthTabResume';
export {
  hasWebInterviewTabRestoreStash,
  waitForWebInterviewTabRestorePlaybackEnd,
} from './webInterviewTabRestoreStash';
export {
  hasWebInterviewHtmlAudioTabResumePending,
  isWebInterviewMidUtteranceTabResumeActive,
} from './webInterviewHtmlAudioTabResume';
export {
  ensureWebHtmlAudioElementMaxVolume,
  waitForWebHtmlAudioElementReady,
} from './webInterviewHtmlAudioVolume';
export {
  ensureSharedHtmlAudioElementForInterviewTts,
  primeHtmlAudioForMobileTtsFromMicGesture,
} from './webInterviewSharedHtmlAudio';
export { isWebInterviewAudioUnlocked } from './webInterviewWebAudioContext';
export { ensureWebInterviewTtsOutputVolumePrimed } from './webInterviewTtsOutputVolume';
export { getActiveWebHtmlAudioVolumeForTelemetry } from './webInterviewActiveHtmlAudio';
export {
  isWebInterviewPlaybackAudiblyActive,
  isWebInterviewPlaybackSurfaceActive,
} from './webInterviewPlaybackSurface';
export { registerExtraWebInterviewPlaybackHooks } from './webInterviewWebAudioPlaybackSurface';
export { hasPendingWebGestureBlobUrl } from './webInterviewPendingGestureBlob';
export { tryPlayPendingWebTtsAudioInUserGesture } from './webInterviewPendingGestureBlobPlayback';
export { isWebAudioAutoplayBlockedError } from './webTtsAutoplayPolicy';
export { fetchElevenLabsMpegArrayBuffer } from './elevenLabsTtsFetch';
export type { ElevenLabsSpeakOptions } from './elevenLabsSpeakTypes';
export { stopElevenLabsPlayback, stopElevenLabsSpeech } from './elevenLabsTtsPlaybackStop';
export { trySpeakWebSpeechInUserGesture } from './interviewWebSpeechSynthesis';
export {
  attachTabStashHtmlAudioPlaybackHandoff,
  canSoftPauseActiveWebHtmlAudioForTabResume,
  clearWebInterviewHtmlTabRestoreState,
  holdTabStashedHtmlAudioForGestureResume,
  pauseActiveWebInterviewHtmlAudioWithoutRevoke,
  refreshWebInterviewHtmlTabStashForRepeatHide,
  restoreWebInterviewTabStashedPlaybackVolume,
  resumeWebInterviewHtmlAudioAfterTabHide,
  syncTabStashHtmlAudioPositionForResumeReturn,
  tryPrepareWebInterviewHtmlAudioTabResume,
  trySyncStartTabRestoreHtmlPlaybackInUserGesture,
} from './webInterviewHtmlAudioTabRestoreOrchestration';
export {
  debugNoteWebAudioRouteChange,
  interruptWebInterviewTtsForTabHide,
  pauseWebInterviewHtmlAudioForDocumentHidden,
  resetWebInterviewAudioSession,
  unlockWebAudioForAutoplay,
} from './webInterviewTtsDocumentLifecycle';
export { resetElevenLabsSpokenContext } from './elevenLabsSpokenContext';
export { WebTtsRequiresUserGestureError, isWebTtsRequiresUserGestureError } from './webTtsGestureErrors';
export { webSpeechShouldDeferToUserGesture } from './webSpeechDeferPolicy';
export { speakWithElevenLabs } from './speakWithElevenLabsCore';
