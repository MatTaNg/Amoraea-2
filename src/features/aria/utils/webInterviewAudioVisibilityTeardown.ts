/** True when the last tab-hide actually paused/stopped interview playback (skip idle reprime on return). */
let webTabHideAudioTeardownApplied = false;

let webInterviewAudioVisibilityListenerAttached = false;

export function takeWebTabHideAudioTeardownApplied(): boolean {
  const hadTeardown = webTabHideAudioTeardownApplied;
  webTabHideAudioTeardownApplied = false;
  return hadTeardown;
}

export function markWebTabHideAudioTeardownApplied(): void {
  webTabHideAudioTeardownApplied = true;
}

export function clearWebTabHideAudioTeardownApplied(): void {
  webTabHideAudioTeardownApplied = false;
}

export function attachWebInterviewAudioVisibilityHandler(handlers: {
  onHidden: () => void;
  onVisible: () => void | Promise<void>;
}): void {
  if (typeof document === 'undefined') return;
  if (webInterviewAudioVisibilityListenerAttached) return;
  webInterviewAudioVisibilityListenerAttached = true;
  document.addEventListener('visibilitychange', () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      handlers.onHidden();
      return;
    }
    void handlers.onVisible();
  });
}

export function resetWebInterviewAudioVisibilityTeardown(): void {
  webTabHideAudioTeardownApplied = false;
  webInterviewAudioVisibilityListenerAttached = false;
}
