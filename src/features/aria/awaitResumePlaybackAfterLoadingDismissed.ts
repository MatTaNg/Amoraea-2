import type { MutableRefObject } from 'react';

const RESUME_PLAYBACK_WAIT_POLL_MS = 32;
export const RESUME_PLAYBACK_WAIT_AFTER_LOADING_MS = 15000;

/** Resume welcome / emotion catch-up must run after the loading overlay unmounts (modal + mic UI). */
export async function awaitResumePlaybackAfterLoadingDismissed(
  resumeLoadingFlowActiveRef: MutableRefObject<boolean>,
  timeoutMs = RESUME_PLAYBACK_WAIT_AFTER_LOADING_MS,
): Promise<void> {
  const started = Date.now();
  while (resumeLoadingFlowActiveRef.current) {
    if (Date.now() - started >= timeoutMs) return;
    await new Promise<void>((resolve) => {
      setTimeout(resolve, RESUME_PLAYBACK_WAIT_POLL_MS);
    });
  }
}
