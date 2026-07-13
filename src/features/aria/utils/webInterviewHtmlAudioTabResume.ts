import { Platform } from 'react-native';

import { getWebInterviewTabRestoreStash } from './webInterviewTabRestoreStash';

export const TAB_RESTORE_SYNC_DEDUPE_MS = 900;
const WEB_TAB_RESUME_VOLUME_LOCK_MS = 30_000;

export type TabHtmlAudioResumeSnapshot = {
  element: HTMLAudioElement;
  objectUrl: string;
  resumeSeconds: number;
  /** `<audio>` volume when tab hide soft-paused — avoid speaker snap on mid-utterance resume. */
  volume: number;
};

let tabHtmlAudioResumeSnapshot: TabHtmlAudioResumeSnapshot | null = null;
let htmlAudioPausedForTabResume = false;
let tabPausedHtmlAudioResumeSeconds: number | null = null;
let webInterviewTabResumeVolumeLockedUntilMs: number | null = null;
let lastTabRestoreSyncPlayKey: string | null = null;
let lastTabRestoreSyncPlayAtMs = 0;

export function getTabHtmlAudioResumeSnapshot(): TabHtmlAudioResumeSnapshot | null {
  return tabHtmlAudioResumeSnapshot;
}

export function getTabPausedHtmlAudioResumeSeconds(): number | null {
  return tabPausedHtmlAudioResumeSeconds;
}

export function getTabStashedHtmlAudioElement(): HTMLAudioElement | null {
  if (Platform.OS !== 'web') return null;
  const snap = tabHtmlAudioResumeSnapshot;
  if (!snap || snap.element.ended) return null;
  return snap.element;
}

export function isHtmlAudioPausedForTabResume(): boolean {
  return htmlAudioPausedForTabResume;
}

export function setHtmlAudioPausedForTabResume(paused: boolean): void {
  htmlAudioPausedForTabResume = paused;
}

export function clearWebInterviewHtmlAudioTabResumeState(): void {
  htmlAudioPausedForTabResume = false;
  tabPausedHtmlAudioResumeSeconds = null;
  tabHtmlAudioResumeSnapshot = null;
  webInterviewTabResumeVolumeLockedUntilMs = null;
  lastTabRestoreSyncPlayKey = null;
  lastTabRestoreSyncPlayAtMs = 0;
}

export function recordTabHtmlAudioResumeSnapshot(snapshot: TabHtmlAudioResumeSnapshot): void {
  tabHtmlAudioResumeSnapshot = snapshot;
  tabPausedHtmlAudioResumeSeconds = snapshot.resumeSeconds;
  htmlAudioPausedForTabResume = true;
}

export function resolveObjectUrlForTabHtmlAudioCapture(
  el: HTMLAudioElement,
  activeWebHtmlAudioObjectUrl: string | null,
): string {
  return (el.src ?? activeWebHtmlAudioObjectUrl ?? tabHtmlAudioResumeSnapshot?.objectUrl ?? '').trim();
}

export function hasWebInterviewHtmlAudioTabResumePending(): boolean {
  if (Platform.OS !== 'web') return false;
  if (getWebInterviewTabRestoreStash() != null) return true;
  const snap = tabHtmlAudioResumeSnapshot;
  if (!snap || snap.element.ended) return false;
  return Number.isFinite(snap.resumeSeconds) && snap.resumeSeconds >= 0;
}

export function shouldSkipWebInterviewTtsVolumeReprime(): boolean {
  if (Platform.OS !== 'web') return false;
  if (htmlAudioPausedForTabResume || hasWebInterviewHtmlAudioTabResumePending()) return true;
  return (
    webInterviewTabResumeVolumeLockedUntilMs != null &&
    Date.now() < webInterviewTabResumeVolumeLockedUntilMs
  );
}

export function isWebHtmlAudioMidUtteranceTabResumeElement(el: HTMLAudioElement): boolean {
  if (!htmlAudioPausedForTabResume && !hasWebInterviewHtmlAudioTabResumePending()) {
    return false;
  }
  const snap = tabHtmlAudioResumeSnapshot;
  return (
    snap?.element === el &&
    Number.isFinite(snap.resumeSeconds) &&
    snap.resumeSeconds > 0.05
  );
}

/** True while tab-hide stash or post-resume volume lock is active — skip route/volume re-prime. */
export function isWebInterviewMidUtteranceTabResumeActive(): boolean {
  return shouldSkipWebInterviewTtsVolumeReprime();
}

/** Mid-utterance tab resume: restore pre-pause level instead of re-priming to max (avoids speaker snap). */
export function applyTabStashedHtmlAudioVolume(el: HTMLAudioElement): void {
  if (Platform.OS !== 'web') return;
  const snap = tabHtmlAudioResumeSnapshot;
  const vol =
    snap?.element === el && Number.isFinite(snap.volume) && snap.volume > 0
      ? snap.volume
      : null;
  try {
    el.muted = false;
    if (vol != null) {
      el.volume = vol;
      webInterviewTabResumeVolumeLockedUntilMs = Date.now() + WEB_TAB_RESUME_VOLUME_LOCK_MS;
    }
  } catch {
    /* ignore */
  }
}

/** Restore pre-pause `<audio>` volume on the stashed or active element (mobile tab/home return). */
export function restoreWebInterviewTabStashedPlaybackVolume(
  getActiveElement?: () => HTMLAudioElement | null,
  el?: HTMLAudioElement,
): void {
  if (Platform.OS !== 'web') return;
  const target = el ?? tabHtmlAudioResumeSnapshot?.element ?? getActiveElement?.() ?? null;
  if (target) applyTabStashedHtmlAudioVolume(target);
}

export function shouldSkipTabRestoreSyncPlay(playKey: string): boolean {
  const now = Date.now();
  return (
    lastTabRestoreSyncPlayKey === playKey &&
    now - lastTabRestoreSyncPlayAtMs < TAB_RESTORE_SYNC_DEDUPE_MS
  );
}

export function markTabRestoreSyncPlayStarted(playKey: string): void {
  lastTabRestoreSyncPlayKey = playKey;
  lastTabRestoreSyncPlayAtMs = Date.now();
}
