export type WebHtmlAudioPlaybackHandoff = {
  clearSafetyTimeout: () => void;
  completePlayback: () => void;
  objectUrl: string;
};

let abortActiveWebHtmlAudioPlayback: (() => void) | null = null;
let activeWebHtmlAudioPlaybackHandoff: WebHtmlAudioPlaybackHandoff | null = null;
let abortActiveWebBufferAudioPlayback: (() => void) | null = null;

export function assignAbortActiveWebHtmlAudioPlayback(handler: (() => void) | null): void {
  abortActiveWebHtmlAudioPlayback = handler;
}

export function getAbortActiveWebHtmlAudioPlayback(): (() => void) | null {
  return abortActiveWebHtmlAudioPlayback;
}

export function clearAbortActiveWebHtmlAudioPlaybackIfMatches(handler: () => void): void {
  if (abortActiveWebHtmlAudioPlayback === handler) {
    abortActiveWebHtmlAudioPlayback = null;
  }
}

export function triggerAbortActiveWebHtmlAudioPlayback(): void {
  abortActiveWebHtmlAudioPlayback?.();
  abortActiveWebHtmlAudioPlayback = null;
}

export function assignActiveWebHtmlAudioPlaybackHandoff(
  handoff: WebHtmlAudioPlaybackHandoff | null,
): void {
  activeWebHtmlAudioPlaybackHandoff = handoff;
}

export function getActiveWebHtmlAudioPlaybackHandoff(): WebHtmlAudioPlaybackHandoff | null {
  return activeWebHtmlAudioPlaybackHandoff;
}

export function clearActiveWebHtmlAudioPlaybackHandoffIfObjectUrl(objectUrl: string): void {
  if (activeWebHtmlAudioPlaybackHandoff?.objectUrl === objectUrl) {
    activeWebHtmlAudioPlaybackHandoff = null;
  }
}

export function claimWebHtmlAudioPlaybackHandoffForTabResume(
  objectUrl: string,
): WebHtmlAudioPlaybackHandoff | null {
  const handoff = activeWebHtmlAudioPlaybackHandoff;
  if (!handoff || handoff.objectUrl !== objectUrl) return null;
  handoff.clearSafetyTimeout();
  return handoff;
}

export function clearAbortActiveWebBufferAudioPlaybackIfMatches(handler: () => void): void {
  if (abortActiveWebBufferAudioPlayback === handler) {
    abortActiveWebBufferAudioPlayback = null;
  }
}

export function assignAbortActiveWebBufferAudioPlayback(handler: (() => void) | null): void {
  abortActiveWebBufferAudioPlayback = handler;
}

export function abortInFlightWebInterviewPlaybackForTabHide(opts?: {
  includeHtmlAudio?: boolean;
}): void {
  if (opts?.includeHtmlAudio !== false) {
    triggerAbortActiveWebHtmlAudioPlayback();
  }
  abortActiveWebBufferAudioPlayback?.();
  abortActiveWebBufferAudioPlayback = null;
}

export function resetWebInterviewHtmlAudioPlaybackHooks(): void {
  abortActiveWebHtmlAudioPlayback = null;
  activeWebHtmlAudioPlaybackHandoff = null;
  abortActiveWebBufferAudioPlayback = null;
}
