import { Platform } from 'react-native';

import {
  assignAbortActiveWebHtmlAudioPlayback,
  claimWebHtmlAudioPlaybackHandoffForTabResume,
} from './webInterviewHtmlAudioPlaybackHooks';
import {
  getTabHtmlAudioResumeSnapshot,
  getTabStashedHtmlAudioElement,
  hasWebInterviewHtmlAudioTabResumePending,
  restoreWebInterviewTabStashedPlaybackVolume as restoreWebInterviewTabStashedPlaybackVolumeCore,
  setHtmlAudioPausedForTabResume,
} from './webInterviewHtmlAudioTabResume';
import {
  assignActiveWebHtmlAudio,
  clearActiveWebHtmlAudio,
  getActiveWebHtmlAudioElement,
} from './webInterviewActiveHtmlAudio';
import { resolveWebInterviewTabRestorePlaybackEndEarly } from './webInterviewTabRestoreStash';
import {
  captureTabHtmlAudioResumeSnapshotFromElement,
  clearHtmlAudioTabResumeState,
  releaseWebInterviewTabRestoreStashForInterview,
} from './webInterviewTabRestoreCapture';

export function pauseActiveWebInterviewHtmlAudioWithoutRevoke(): void {
  if (Platform.OS !== 'web') return;
  const el = getActiveWebHtmlAudioElement();
  if (el) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
  clearActiveWebHtmlAudio();
}

/**
 * Repeat tab-hide while stash is still pending: refresh pause position + volume instead of
 * leaving a stale seek (second resume replays from an old `currentTime` → overlap / volume snap).
 */
export function refreshWebInterviewHtmlTabStashForRepeatHide(): void {
  if (Platform.OS !== 'web') return;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return;
  const el = getTabStashedHtmlAudioElement() ?? getActiveWebHtmlAudioElement();
  if (!el || el.ended) return;
  if (!el.paused) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
  if (!captureTabHtmlAudioResumeSnapshotFromElement(el)) return;
  assignAbortActiveWebHtmlAudioPlayback(null);
  clearActiveWebHtmlAudio();
}

export function restoreWebInterviewTabStashedPlaybackVolume(el?: HTMLAudioElement): void {
  restoreWebInterviewTabStashedPlaybackVolumeCore(getActiveWebHtmlAudioElement, el);
}

/**
 * Chrome may auto-resume a soft-paused utterance when the tab becomes visible before our handoff
 * runs — pause it so resume goes through a single controlled path (clears safety timeout overlap).
 */
export function holdTabStashedHtmlAudioForGestureResume(): boolean {
  if (Platform.OS !== 'web') return false;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return false;
  const el = getTabStashedHtmlAudioElement();
  if (!el) return false;
  if (!el.ended) {
    /** Chrome may advance `currentTime` while away — refresh stash before pause/resume (avoids overlap snap). */
    captureTabHtmlAudioResumeSnapshotFromElement(el);
  }
  if (!el.paused && !el.ended) {
    try {
      el.pause();
    } catch {
      /* ignore */
    }
  }
  setHtmlAudioPausedForTabResume(true);
  return true;
}

/** Sync tab-stash seek position + volume from the stashed element (navigation/home return). */
export function syncTabStashHtmlAudioPositionForResumeReturn(): boolean {
  if (Platform.OS !== 'web') return false;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return false;
  const el = getTabStashedHtmlAudioElement();
  if (!el || el.ended) return false;
  return captureTabHtmlAudioResumeSnapshotFromElement(el);
}

/** Re-link soft-paused HTML audio to the in-flight speak promise (clears wall-clock safety timeout). */
export function attachTabStashHtmlAudioPlaybackHandoff(): boolean {
  if (Platform.OS !== 'web') return false;
  const snap = getTabHtmlAudioResumeSnapshot();
  if (!snap || snap.element.ended) return false;
  assignActiveWebHtmlAudio(snap.element);
  const handoff = claimWebHtmlAudioPlaybackHandoffForTabResume(snap.objectUrl);
  if (handoff) {
    assignAbortActiveWebHtmlAudioPlayback(null);
  }
  return handoff != null;
}

/** Drop stashed HTML tab-resume state (snapshot + blob URL). Safe after replay or dismiss. */
export function clearWebInterviewHtmlTabRestoreState(): void {
  if (Platform.OS !== 'web') return;
  try {
    getTabHtmlAudioResumeSnapshot()?.element.pause();
  } catch {
    /* ignore */
  }
  clearHtmlAudioTabResumeState();
  releaseWebInterviewTabRestoreStashForInterview(true);
  resolveWebInterviewTabRestorePlaybackEndEarly();
}
