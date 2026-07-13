import { Platform } from 'react-native';

import {
  clearWebInterviewHtmlAudioTabResumeState,
  recordTabHtmlAudioResumeSnapshot,
  resolveObjectUrlForTabHtmlAudioCapture,
} from './webInterviewHtmlAudioTabResume';
import { setWebInterviewTabRestoreStash } from './webInterviewTabRestoreStash';
import {
  assignActiveWebHtmlAudioObjectUrl,
  getActiveWebHtmlAudioElement,
  getActiveWebHtmlAudioObjectUrl,
} from './webInterviewActiveHtmlAudio';
import { hasActiveWebBufferOrPcmPlayback } from './webInterviewWebAudioPlaybackSurface';
import { releaseWebInterviewTabRestoreStash } from './webInterviewTabRestoreStash';

export function releaseWebInterviewTabRestoreStashForInterview(revokeObjectUrl: boolean): void {
  releaseWebInterviewTabRestoreStash(revokeObjectUrl, {
    onRevokeObjectUrl: (url) => {
      if (getActiveWebHtmlAudioObjectUrl() === url) {
        assignActiveWebHtmlAudioObjectUrl(null);
      }
    },
  });
}

/** Re-exported for HTML playback cleanup and tab-hide paths. */
export function clearHtmlAudioTabResumeState(): void {
  clearWebInterviewHtmlAudioTabResumeState();
}

export function captureTabHtmlAudioResumeSnapshotFromElement(el: HTMLAudioElement): boolean {
  if (Platform.OS !== 'web') return false;
  if (hasActiveWebBufferOrPcmPlayback()) return false;
  if (el.ended) return false;
  const resumeSeconds = el.currentTime;
  if (!Number.isFinite(resumeSeconds) || resumeSeconds < 0) return false;
  const objectUrl = resolveObjectUrlForTabHtmlAudioCapture(el, getActiveWebHtmlAudioObjectUrl());
  if (!objectUrl) return false;
  const d = el.duration;
  if (Number.isFinite(d) && d > 0 && resumeSeconds >= d - 0.35) return false;
  let volume = 1;
  try {
    const v = el.volume;
    if (Number.isFinite(v) && v > 0) volume = v;
  } catch {
    /* ignore */
  }
  recordTabHtmlAudioResumeSnapshot({ element: el, objectUrl, resumeSeconds, volume });
  setWebInterviewTabRestoreStash({ objectUrl, resumeSeconds });
  return true;
}

export function captureTabHtmlAudioResumeSnapshot(): boolean {
  const el = getActiveWebHtmlAudioElement();
  if (!el) return false;
  return captureTabHtmlAudioResumeSnapshotFromElement(el);
}
