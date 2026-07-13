export type WebInterviewExtraPlaybackHooks = {
  stop?: () => void;
  isActive?: () => boolean;
};

let activeWebBufferSource: AudioBufferSourceNode | null = null;
const activePcmStreamSources: AudioBufferSourceNode[] = [];

/**
 * Incremented when tab hides or {@link stopElevenLabsPlayback} runs so in-flight PCM stream readers
 * stop calling {@link AudioBufferSourceNode#start} (Chrome suspend/resume + continued scheduling → overlap/static).
 */
let webInterviewTtsScheduleEpoch = 0;

let extraWebInterviewPlaybackHooks: WebInterviewExtraPlaybackHooks = {};

export function bumpWebInterviewTtsScheduleEpoch(): void {
  webInterviewTtsScheduleEpoch += 1;
}

export function captureWebInterviewTtsScheduleEpoch(): { isStale: () => boolean } {
  const epochCapture = webInterviewTtsScheduleEpoch;
  return {
    isStale: () => epochCapture !== webInterviewTtsScheduleEpoch,
  };
}

export function getActiveWebBufferSource(): AudioBufferSourceNode | null {
  return activeWebBufferSource;
}

export function assignActiveWebBufferSource(src: AudioBufferSourceNode): void {
  activeWebBufferSource = src;
}

export function clearActiveWebBufferSourceIfMatches(src: AudioBufferSourceNode): void {
  if (activeWebBufferSource === src) {
    activeWebBufferSource = null;
  }
}

export function registerActivePcmStreamSource(src: AudioBufferSourceNode): void {
  activePcmStreamSources.push(src);
}

export function unregisterActivePcmStreamSource(src: AudioBufferSourceNode): void {
  const idx = activePcmStreamSources.indexOf(src);
  if (idx >= 0) activePcmStreamSources.splice(idx, 1);
}

export function hasActiveWebBufferOrPcmPlayback(): boolean {
  return activeWebBufferSource != null || activePcmStreamSources.length > 0;
}

export function stopAllActivePcmStreamSources(): void {
  for (const s of activePcmStreamSources) {
    try {
      s.stop(0);
    } catch {
      /* ignore */
    }
  }
  activePcmStreamSources.length = 0;
}

export function stopActiveWebBufferPlayback(): void {
  if (!activeWebBufferSource) return;
  try {
    activeWebBufferSource.stop(0);
  } catch {
    /* ignore */
  }
  activeWebBufferSource = null;
}

/** Stops in-flight Web Audio buffer and PCM stream nodes (tab hide / hard stop). */
export function stopActiveWebBufferAndPcmPlayback(): void {
  stopAllActivePcmStreamSources();
  stopActiveWebBufferPlayback();
}

export function registerExtraWebInterviewPlaybackHooks(hooks: WebInterviewExtraPlaybackHooks): void {
  extraWebInterviewPlaybackHooks = hooks;
}

export function stopExtraWebInterviewPlaybackHooks(): void {
  extraWebInterviewPlaybackHooks.stop?.();
}

export function isExtraWebInterviewPlaybackSurfaceActive(): boolean {
  return extraWebInterviewPlaybackHooks.isActive?.() === true;
}

export function resetWebInterviewWebAudioPlaybackSurface(): void {
  stopActiveWebBufferAndPcmPlayback();
  webInterviewTtsScheduleEpoch = 0;
  extraWebInterviewPlaybackHooks = {};
}
