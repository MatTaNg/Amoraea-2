import { Platform } from 'react-native';

import {
  getActiveWebHtmlAudioElement,
  getActiveWebHtmlAudioRef,
} from './webInterviewActiveHtmlAudio';
import { getTabStashedHtmlAudioElement } from './webInterviewHtmlAudioTabResume';
import {
  hasActiveWebBufferOrPcmPlayback,
  isExtraWebInterviewPlaybackSurfaceActive,
} from './webInterviewWebAudioPlaybackSurface';

/**
 * Web: true while interview TTS might still be using Web Audio / HTMLAudio / speechSynthesis output.
 * Use after {@link stopElevenLabsPlayback} to poll until surfaces are idle before opening the mic.
 */
export function isWebInterviewPlaybackSurfaceActive(): boolean {
  if (Platform.OS !== 'web') return false;
  if (getActiveWebHtmlAudioRef() != null || hasActiveWebBufferOrPcmPlayback()) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true) return true;
  if (isExtraWebInterviewPlaybackSurfaceActive()) return true;
  return false;
}

/** Require audible playback for at least `sustainMs` before treating tab-restore replay as successful. */
export async function waitForSustainedWebInterviewAudiblePlayback(
  sustainMs: number,
  deadlineMs: number,
): Promise<boolean> {
  if (Platform.OS !== 'web') return false;
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (!isWebInterviewPlaybackAudiblyActive()) {
      await new Promise((resolve) => setTimeout(resolve, 50));
      continue;
    }
    const audibleSince = Date.now();
    while (Date.now() - audibleSince < sustainMs) {
      if (!isWebInterviewPlaybackAudiblyActive()) {
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    if (Date.now() - audibleSince >= sustainMs) {
      return true;
    }
  }
  return false;
}

/** Like {@link isWebInterviewPlaybackSurfaceActive} but false for paused HTML audio (iOS tab background). */
export function isWebInterviewPlaybackAudiblyActive(): boolean {
  if (Platform.OS !== 'web') return false;
  const el = getActiveWebHtmlAudioElement();
  if (el) {
    return !el.paused && !el.ended;
  }
  const stashEl = getTabStashedHtmlAudioElement();
  if (stashEl && !stashEl.paused && !stashEl.ended) {
    return true;
  }
  if (hasActiveWebBufferOrPcmPlayback()) return true;
  if (typeof window !== 'undefined' && window.speechSynthesis?.speaking === true) return true;
  if (isExtraWebInterviewPlaybackSurfaceActive()) return true;
  return false;
}
