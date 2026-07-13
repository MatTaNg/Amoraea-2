import { logTtsAutoplayPlayOutcome, type TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';

import {
  clearActiveWebHtmlAudio,
  clearActiveWebHtmlAudioObjectUrlIfMatches,
} from './webInterviewActiveHtmlAudio';
import {
  getTabHtmlAudioResumeSnapshot,
  hasWebInterviewHtmlAudioTabResumePending,
  isHtmlAudioPausedForTabResume,
} from './webInterviewHtmlAudioTabResume';

const LOOSE_UNTIL_METADATA_MS = 600_000;

export function createWebInterviewHtmlAudioSafetyTimeoutScheduler(args: {
  htmlAudio: HTMLAudioElement;
  objectUrl: string;
  telemetrySource: TtsTelemetrySource;
  isSettled: () => boolean;
  onSafetyTimeoutResolve: () => void;
  clearTabResumeState: () => void;
}): {
  clearSafetyTimeout: () => void;
  scheduleSafetyTimeout: (reason: string) => void;
  attachMetadataListeners: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const clearSafetyTimeout = () => {
    if (timeoutId != null) clearTimeout(timeoutId);
    timeoutId = null;
  };

  const scheduleSafetyTimeout = (reason: string) => {
    if (args.isSettled()) return;
    clearSafetyTimeout();
    const d = args.htmlAudio.duration;
    const tabSnap = getTabHtmlAudioResumeSnapshot();
    const resumeAt =
      tabSnap && tabSnap.element === args.htmlAudio && Number.isFinite(tabSnap.resumeSeconds)
        ? tabSnap.resumeSeconds
        : args.htmlAudio.currentTime;
    let safetyMs = LOOSE_UNTIL_METADATA_MS;
    if (Number.isFinite(d) && d > 0) {
      const remainingSec =
        Number.isFinite(resumeAt) && resumeAt > 0 && d > resumeAt + 0.35 ? d - resumeAt : d;
      if (remainingSec > 0.5) {
        safetyMs = Math.min(600_000, Math.ceil(remainingSec * 1000) + 5000);
      }
    }
    timeoutId = setTimeout(() => {
      if (isHtmlAudioPausedForTabResume() || hasWebInterviewHtmlAudioTabResumePending()) {
        scheduleSafetyTimeout('tab_paused_hold');
        return;
      }
      if (!args.htmlAudio.ended && !args.htmlAudio.paused) {
        const d = args.htmlAudio.duration;
        const ct = args.htmlAudio.currentTime;
        if (Number.isFinite(d) && d > 0.5 && ct < d - 0.35) {
          scheduleSafetyTimeout('still_playing');
          return;
        }
      }
      try {
        if (!args.htmlAudio.ended) {
          args.htmlAudio.pause();
        }
      } catch {
        /* ignore */
      }
      try {
        clearActiveWebHtmlAudio();
        clearActiveWebHtmlAudioObjectUrlIfMatches(args.objectUrl);
        args.clearTabResumeState();
        URL.revokeObjectURL(args.objectUrl);
      } catch {
        /* ignore */
      }
      logTtsAutoplayPlayOutcome({
        pipeline: 'elevenlabs_web_html_audio',
        outcome: 'playback_timeout',
        telemetrySource: args.telemetrySource,
        errorMessagePreview: `safety_fallback_ms=${safetyMs} reason=${reason}`,
      });
      args.onSafetyTimeoutResolve();
    }, safetyMs);
  };

  const attachMetadataListeners = () => {
    args.htmlAudio.addEventListener('loadedmetadata', () => scheduleSafetyTimeout('loadedmetadata'));
    args.htmlAudio.addEventListener('durationchange', () => scheduleSafetyTimeout('durationchange'));
    scheduleSafetyTimeout('initial');
  };

  return {
    clearSafetyTimeout,
    scheduleSafetyTimeout,
    attachMetadataListeners,
  };
}
