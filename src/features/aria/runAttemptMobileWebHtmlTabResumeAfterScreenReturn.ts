import { Platform } from 'react-native';

import { getWebAutoplayContext } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  attachTabStashHtmlAudioPlaybackHandoff,
  trySyncStartTabRestoreHtmlPlaybackInUserGesture,
} from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { markWebInterviewUserGestureNow } from '@features/aria/utils/webInterviewGestureContext';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';

export function runAttemptMobileWebHtmlTabResumeAfterScreenReturn(
  deps: InterviewWebTabRestoreSessionDeps,
): boolean {
  if (Platform.OS !== 'web' || !getWebAutoplayContext().isMobileWeb) return false;
  if (!hasWebInterviewHtmlAudioTabResumePending()) return false;
  if (!deps.queueMobileWebHtmlResumeAfterScreenReturn()) return false;
  const pending = deps.pendingGestureRestoreSpeakRef.current;
  if (!pending) return false;
  markWebInterviewUserGestureNow();
  const sync = trySyncStartTabRestoreHtmlPlaybackInUserGesture({
    telemetrySource: 'replay',
    replayFromStart: false,
    onPlayStarted: () => {
      deps.needsGestureRestoreRef.current = false;
      deps.setWebTabRestoreOverlayVisible(false);
      deps.setVoiceState('speaking');
      attachTabStashHtmlAudioPlaybackHandoff();
    },
  });
  if (!sync.started) return false;
  deps.webTabRestoreReplayInFlightRef.current = true;
  void sync.done
    .then(() => {
      attachTabStashHtmlAudioPlaybackHandoff();
      deps.dismissTabRestoreOverlay({ deliveredText: pending.text });
      deps.mobileTabHideLetPlaybackContinueRef.current = false;
      deps.mobileTabHideBackgroundUtteranceRef.current = null;
    })
    .catch(() => {
      deps.needsGestureRestoreRef.current = true;
      deps.setWebTabRestoreOverlayVisible(true);
      deps.ensureWebGestureFlushListener();
    })
    .finally(() => {
      deps.webTabRestoreReplayInFlightRef.current = false;
    });
  return true;
}
