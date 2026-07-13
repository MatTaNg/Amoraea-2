import { Platform } from 'react-native';

import { markWebTabBecameVisible } from './webInterviewGestureContext';
import {
  hasWebInterviewHtmlAudioTabResumePending,
  isWebInterviewMidUtteranceTabResumeActive,
} from './webInterviewHtmlAudioTabResume';
import {
  canSoftPauseActiveWebHtmlAudioForTabResume,
  clearHtmlAudioTabResumeState,
  clearWebInterviewHtmlTabRestoreState,
  holdTabStashedHtmlAudioForGestureResume,
  refreshWebInterviewHtmlTabStashForRepeatHide,
  softPauseActiveWebHtmlAudioForTabHide,
} from './webInterviewHtmlAudioTabRestoreOrchestration';
import {
  abortInFlightWebInterviewPlaybackForTabHide,
  resetWebInterviewHtmlAudioPlaybackHooks,
} from './webInterviewHtmlAudioPlaybackHooks';
import { isWebInterviewPlaybackSurfaceActive } from './webInterviewPlaybackSurface';
import {
  attachWebInterviewAudioVisibilityHandler,
  clearWebTabHideAudioTeardownApplied,
  markWebTabHideAudioTeardownApplied,
  resetWebInterviewAudioVisibilityTeardown,
  takeWebTabHideAudioTeardownApplied,
} from './webInterviewAudioVisibilityTeardown';
import {
  ensureSharedWebAudioContextResumedForPlayback,
  getSharedWebAudioContext,
  resetWebInterviewWebAudioContext,
  suspendSharedWebAudioContextForTabHide,
  unlockWebInterviewSharedAudioContext,
} from './webInterviewWebAudioContext';
import {
  assignActiveWebHtmlAudioObjectUrl,
  clearActiveWebHtmlAudio,
  getActiveWebHtmlAudioRef,
  resetWebInterviewActiveHtmlAudio,
} from './webInterviewActiveHtmlAudio';
import { ensureWebInterviewTtsOutputVolumePrimed } from './webInterviewTtsOutputVolume';
import {
  bumpWebInterviewTtsScheduleEpoch,
  resetWebInterviewWebAudioPlaybackSurface,
  stopActiveWebBufferAndPcmPlayback,
} from './webInterviewWebAudioPlaybackSurface';
import { resetCachedWebSpeechVoice } from './interviewWebSpeechSynthesis';
import { resetNativeElevenLabsMp3PlaybackState } from './nativeElevenLabsMp3Playback';
import { resetWebInterviewPendingGestureBlob } from './webInterviewPendingGestureBlob';
import { resetElevenLabsSpokenContext } from './elevenLabsSpokenContext';
import {
  reprimeSharedHtmlAudioSilentPlay,
  resetWebInterviewSharedHtmlAudio,
} from './webInterviewSharedHtmlAudio';

export function debugNoteWebAudioRouteChange(source: string, routeData?: Record<string, unknown>): void {
  if (Platform.OS !== 'web') return;
  void source;
  void routeData;
  void getSharedWebAudioContext();
}

async function handleWebInterviewDocumentVisibilityChange(): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
  markWebTabBecameVisible();
  const hadTeardown = takeWebTabHideAudioTeardownApplied();
  const tabResumePending = hasWebInterviewHtmlAudioTabResumePending();
  if (tabResumePending) {
    holdTabStashedHtmlAudioForGestureResume();
  }
  const ctx = getSharedWebAudioContext();
  /** Resume only when we tore down on hide, or Chrome suspended the context in the background. */
  const needsContextResume =
    !tabResumePending &&
    (hadTeardown || (ctx != null && ctx.state !== 'closed' && ctx.state !== 'running'));
  if (needsContextResume) {
    await ensureSharedWebAudioContextResumedForPlayback('other');
  }
  if (hadTeardown && !tabResumePending) {
    reprimeSharedHtmlAudioSilentPlay();
  }
}

/**
 * Tear down active web TTS outputs when the document is hidden.
 * Suspends the shared AudioContext so background tabs do not advance decoded audio silently.
 * HTML audio is paused without seeking — full utterance replay is handled in AriaScreen.
 */
export function pauseWebInterviewHtmlAudioForDocumentHidden(): void {
  if (Platform.OS !== 'web') return;
  // #region agent log
  fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'03bb9d'},body:JSON.stringify({sessionId:'03bb9d',location:'webInterviewTtsDocumentLifecycle.ts:pause_hidden',message:'audio_teardown_on_hide',data:{htmlResumePending:hasWebInterviewHtmlAudioTabResumePending(),surfaceActive:isWebInterviewPlaybackSurfaceActive()},timestamp:Date.now(),hypothesisId:'E'})}).catch(()=>{});
  // #endregion
  if (hasWebInterviewHtmlAudioTabResumePending()) {
    markWebTabHideAudioTeardownApplied();
    suspendSharedWebAudioContextForTabHide();
    refreshWebInterviewHtmlTabStashForRepeatHide();
    return;
  }
  const softPauseHtmlInitial = canSoftPauseActiveWebHtmlAudioForTabResume();
  const hasActivePlayback =
    isWebInterviewPlaybackSurfaceActive() ||
    softPauseHtmlInitial ||
    (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true);
  if (!hasActivePlayback) {
    clearWebTabHideAudioTeardownApplied();
    return;
  }
  markWebTabHideAudioTeardownApplied();
  /** Stop PCM / Web Audio buffer first — they block {@link canSoftPauseActiveWebHtmlAudioForTabResume}. */
  stopActiveWebBufferAndPcmPlayback();
  const softPauseHtml = canSoftPauseActiveWebHtmlAudioForTabResume();
  if (!softPauseHtml) {
    clearHtmlAudioTabResumeState();
    bumpWebInterviewTtsScheduleEpoch();
  }
  abortInFlightWebInterviewPlaybackForTabHide({ includeHtmlAudio: !softPauseHtml });
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
  if (softPauseHtml) {
    softPauseActiveWebHtmlAudioForTabHide();
    suspendSharedWebAudioContextForTabHide();
    return;
  }
  const activeHtmlAudio = getActiveWebHtmlAudioRef();
  if (activeHtmlAudio) {
    try {
      activeHtmlAudio.pause();
    } catch {
      /* ignore */
    }
    clearActiveWebHtmlAudio();
    assignActiveWebHtmlAudioObjectUrl(null);
    clearHtmlAudioTabResumeState();
  }
  suspendSharedWebAudioContextForTabHide();
}

/** Same as {@link pauseWebInterviewHtmlAudioForDocumentHidden} — explicit name for tab-switch interrupt path. */
export function interruptWebInterviewTtsForTabHide(): void {
  pauseWebInterviewHtmlAudioForDocumentHidden();
}

/**
 * Call **synchronously** from a real user gesture (Start interview, mic `onPressIn`, mic permission, etc.).
 * Creates/resumes a shared `AudioContext` and plays a minimal silent buffer so later MP3 playback via
 * `decodeAudioData` + `AudioBufferSourceNode` is allowed without another tap (avoids HTMLAudio T12 on Brave/Chrome).
 * Sets web interview audio unlocked on success so `speakWithElevenLabs` / `speakFallback` may run.
 */
export function unlockWebAudioForAutoplay(): void {
  if (Platform.OS !== 'web') return;
  unlockWebInterviewSharedAudioContext(() => {
    attachWebInterviewAudioVisibilityHandler({
      onHidden: pauseWebInterviewHtmlAudioForDocumentHidden,
      onVisible: handleWebInterviewDocumentVisibilityChange,
    });
    if (!isWebInterviewMidUtteranceTabResumeActive()) {
      ensureWebInterviewTtsOutputVolumePrimed();
    }
  });
}

/** Reset at each new interview session so the first gesture in that session must unlock again. */
export function resetWebInterviewAudioSession(): void {
  resetWebInterviewWebAudioContext();
  resetWebInterviewAudioVisibilityTeardown();
  resetElevenLabsSpokenContext();
  clearWebInterviewHtmlTabRestoreState();
  resetWebInterviewHtmlAudioPlaybackHooks();
  resetWebInterviewSharedHtmlAudio();
  resetWebInterviewActiveHtmlAudio();
  resetWebInterviewWebAudioPlaybackSurface();
  resetWebInterviewPendingGestureBlob();
  resetNativeElevenLabsMp3PlaybackState();
  resetCachedWebSpeechVoice();
}
