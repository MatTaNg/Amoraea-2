import { Platform } from 'react-native';

import {
  applyTabStashedHtmlAudioVolume,
  isWebHtmlAudioMidUtteranceTabResumeElement,
  shouldSkipWebInterviewTtsVolumeReprime,
} from './webInterviewHtmlAudioTabResume';

const HTML_MEDIA_HAVE_ENOUGH_DATA = 4;

/** Force full media volume on web HTML audio (Android mobile web can sound quiet without this). */
export function ensureWebHtmlAudioElementMaxVolume(
  el: HTMLAudioElement,
  opts?: { force?: boolean },
): void {
  if (Platform.OS !== 'web') return;
  if (!opts?.force && shouldSkipWebInterviewTtsVolumeReprime()) {
    if (isWebHtmlAudioMidUtteranceTabResumeElement(el)) {
      applyTabStashedHtmlAudioVolume(el);
    }
    return;
  }
  try {
    el.volume = 1;
    el.muted = false;
  } catch {
    /* ignore */
  }
}

/**
 * Mobile Chrome often clips the first syllables when `play()` runs before decode finishes.
 * Wait for `canplaythrough` (with timeout) and reset position before audible playback.
 */
export async function waitForWebHtmlAudioElementReady(
  el: HTMLAudioElement,
  timeoutMs = 8000,
  options?: { skipExplicitLoad?: boolean; preservePlaybackPosition?: boolean },
): Promise<void> {
  if (Platform.OS !== 'web') return;
  const preservePosition =
    options?.preservePlaybackPosition || isWebHtmlAudioMidUtteranceTabResumeElement(el);
  if (preservePosition) {
    applyTabStashedHtmlAudioVolume(el);
  } else {
    ensureWebHtmlAudioElementMaxVolume(el, { force: true });
    try {
      el.currentTime = 0;
    } catch {
      /* ignore */
    }
  }
  if (el.readyState >= HTML_MEDIA_HAVE_ENOUGH_DATA) return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      el.removeEventListener('canplaythrough', finish);
      el.removeEventListener('loadeddata', finish);
      clearTimeout(tid);
      resolve();
    };
    el.addEventListener('canplaythrough', finish, { once: true });
    el.addEventListener('loadeddata', finish, { once: true });
    const tid = setTimeout(finish, timeoutMs);
    if (!options?.skipExplicitLoad) {
      try {
        el.load();
      } catch {
        /* ignore */
      }
    }
  });
}
