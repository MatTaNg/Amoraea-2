import { Platform } from 'react-native';

import { TtsTabResumeFallbackError } from './webTtsGestureErrors';

export type WebInterviewTabRestoreStash = {
  objectUrl: string;
  resumeSeconds: number;
};

let webInterviewTabRestoreStash: WebInterviewTabRestoreStash | null = null;
let webInterviewTabRestoreEndResolve: (() => void) | null = null;
let webInterviewTabRestoreEndReject: ((err: Error) => void) | null = null;

export function getWebInterviewTabRestoreStash(): WebInterviewTabRestoreStash | null {
  return webInterviewTabRestoreStash;
}

export function setWebInterviewTabRestoreStash(stash: WebInterviewTabRestoreStash | null): void {
  webInterviewTabRestoreStash = stash;
}

export function hasWebInterviewTabRestoreStash(): boolean {
  return Platform.OS === 'web' && webInterviewTabRestoreStash != null;
}

export function assignWebInterviewTabRestorePlaybackEndHandlers(
  resolve: () => void,
  reject: (err: Error) => void,
): void {
  webInterviewTabRestoreEndResolve = resolve;
  webInterviewTabRestoreEndReject = reject;
}

export function clearWebInterviewTabRestorePlaybackEndHandlers(): void {
  webInterviewTabRestoreEndResolve = null;
  webInterviewTabRestoreEndReject = null;
}

export function releaseWebInterviewTabRestoreStash(
  revokeObjectUrl: boolean,
  hooks?: { onRevokeObjectUrl?: (url: string) => void },
): void {
  if (revokeObjectUrl && webInterviewTabRestoreStash?.objectUrl) {
    const url = webInterviewTabRestoreStash.objectUrl;
    hooks?.onRevokeObjectUrl?.(url);
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  webInterviewTabRestoreStash = null;
}

export function settleWebInterviewTabRestorePlaybackEnd(err?: Error): void {
  if (err) {
    webInterviewTabRestoreEndReject?.(err);
  } else {
    webInterviewTabRestoreEndResolve?.();
  }
  clearWebInterviewTabRestorePlaybackEndHandlers();
}

export function resolveWebInterviewTabRestorePlaybackEndEarly(): void {
  webInterviewTabRestoreEndResolve?.();
  clearWebInterviewTabRestorePlaybackEndHandlers();
}

/** Wait until sync-started tab-restore HTML audio finishes (or fails). */
export function waitForWebInterviewTabRestorePlaybackEnd(timeoutMs = 600_000): Promise<void> {
  if (Platform.OS !== 'web') return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      clearWebInterviewTabRestorePlaybackEndHandlers();
      reject(new TtsTabResumeFallbackError());
    }, timeoutMs);
    assignWebInterviewTabRestorePlaybackEndHandlers(
      () => {
        clearTimeout(timeoutId);
        resolve();
      },
      (err: Error) => {
        clearTimeout(timeoutId);
        reject(err);
      },
    );
  });
}
