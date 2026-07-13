import { Platform } from 'react-native';

import { runAttemptMobileWebHtmlTabResumeAfterScreenReturn } from '@features/aria/runAttemptMobileWebHtmlTabResumeAfterScreenReturn';
import { transcriptHasInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import { getWebAutoplayContext } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  attachTabStashHtmlAudioPlaybackHandoff,
  holdTabStashedHtmlAudioForGestureResume,
  restoreWebInterviewTabStashedPlaybackVolume,
  syncTabStashHtmlAudioPositionForResumeReturn,
} from '@features/aria/utils/webInterviewHtmlAudioTabRestoreOrchestration';
import {
  isWebInterviewPlaybackAudiblyActive,
} from '@features/aria/utils/webInterviewPlaybackSurface';
import { hasWebInterviewHtmlAudioTabResumePending } from '@features/aria/utils/webInterviewHtmlAudioTabResume';
import { markWebInterviewUserGestureNow } from '@features/aria/utils/webInterviewGestureContext';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';

export function runSyncInterviewTtsAfterScreenReturn(deps: InterviewWebTabRestoreSessionDeps): void {
  if (Platform.OS !== 'web' || deps.interviewStatusRef.current !== 'in_progress') return;
  if (
    deps.isInterviewCompleteRef.current ||
    transcriptHasInterviewClosingAssistantMessage(deps.currentMessagesRef.current)
  ) {
    return;
  }
  if (hasWebInterviewHtmlAudioTabResumePending()) {
    if (
      deps.mobileTabHideLetPlaybackContinueRef.current &&
      isWebInterviewPlaybackAudiblyActive()
    ) {
      syncTabStashHtmlAudioPositionForResumeReturn();
      restoreWebInterviewTabStashedPlaybackVolume();
      attachTabStashHtmlAudioPlaybackHandoff();
      deps.mobileTabHideLetPlaybackContinueRef.current = false;
      deps.mobileTabHideBackgroundUtteranceRef.current = null;
      deps.pendingGestureRestoreSpeakRef.current = null;
      deps.webTtsTabInterruptPendingReplayRef.current = false;
      deps.tabHiddenDuringActiveTtsLineRef.current = false;
      deps.setWebTabRestoreOverlayVisible(false);
      if (deps.voiceStateRef.current === 'idle') {
        deps.setVoiceState('speaking');
      }
      return;
    }
    holdTabStashedHtmlAudioForGestureResume();
    if (getWebAutoplayContext().isMobileWeb) {
      markWebInterviewUserGestureNow();
    }
    if (runAttemptMobileWebHtmlTabResumeAfterScreenReturn(deps)) {
      return;
    }
    if (deps.queueMobileWebHtmlResumeAfterScreenReturn()) {
      if (deps.voiceStateRef.current === 'idle') {
        deps.setVoiceState('speaking');
      }
      deps.ensureWebGestureFlushListener();
      return;
    }
  }
  const playbackAudible = isWebInterviewPlaybackAudiblyActive();
  if (deps.mobileTabHideLetPlaybackContinueRef.current && !playbackAudible) {
    if (hasWebInterviewHtmlAudioTabResumePending()) {
      if (deps.queueMobileWebHtmlResumeAfterScreenReturn()) {
        if (deps.voiceStateRef.current === 'idle') {
          deps.setVoiceState('speaking');
        }
        deps.ensureWebGestureFlushListener();
        return;
      }
    }
    if (!hasWebInterviewHtmlAudioTabResumePending()) {
      deps.dismissAfterAndroidBackgroundPlaybackEnd({ force: true });
      if (deps.voiceStateRef.current === 'speaking') {
        deps.setVoiceState('idle');
      }
    }
    return;
  }
  if (playbackAudible) {
    if (hasWebInterviewHtmlAudioTabResumePending()) {
      restoreWebInterviewTabStashedPlaybackVolume();
    }
    if (deps.voiceStateRef.current === 'idle') {
      deps.setVoiceState('speaking');
    }
    if (deps.mobileTabHideLetPlaybackContinueRef.current) {
      attachTabStashHtmlAudioPlaybackHandoff();
      deps.pendingGestureRestoreSpeakRef.current = null;
      deps.webTtsTabInterruptPendingReplayRef.current = false;
      deps.tabHiddenDuringActiveTtsLineRef.current = false;
      deps.setWebTabRestoreOverlayVisible(false);
    } else if (!hasWebInterviewHtmlAudioTabResumePending()) {
      const tabRestoreStillPending =
        deps.pendingGestureRestoreSpeakRef.current != null ||
        deps.webTtsTabInterruptPendingReplayRef.current ||
        deps.tabHiddenDuringActiveTtsLineRef.current;
      if (!tabRestoreStillPending) {
        deps.pendingGestureRestoreSpeakRef.current = null;
        deps.webTtsTabInterruptPendingReplayRef.current = false;
        deps.tabHiddenDuringActiveTtsLineRef.current = false;
        deps.setWebTabRestoreOverlayVisible(false);
      }
    }
    return;
  }
  const speakUtteranceAwaitingAudio =
    (deps.webTtsUtteranceInFlightRef.current?.trim().length ?? 0) > 0;
  const staleRuntimeLocks =
    !speakUtteranceAwaitingAudio &&
    (deps.parallelStreamingTtsRef.current.active ||
      deps.ttsLineInFlightRef.current ||
      getSessionLogRuntime().ttsPlaybackActive);
  if (staleRuntimeLocks && typeof deps.clearStaleWebInterviewTtsRuntimeLocks === 'function') {
    deps.clearStaleWebInterviewTtsRuntimeLocks({ force: true });
    if (deps.voiceStateRef.current === 'speaking') {
      deps.setVoiceState('idle');
    }
  }
}
