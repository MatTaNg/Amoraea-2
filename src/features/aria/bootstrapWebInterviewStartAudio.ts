import { Platform } from 'react-native';

import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import {
  isWebGreetingAudiblePlaybackActive,
  isWebInterviewOpeningGreetingSyncAudible,
  resetWebInterviewOpeningGreetingSyncIfInterrupted,
  stopWebInterviewGreetingPlaybackIfActive,
} from '@features/aria/utils/webInterviewGreetingAudio';
import { primeHtmlAudioForMobileTtsFromMicGesture } from '@features/aria/utils/webInterviewSharedHtmlAudio';
import {
  resetWebInterviewAudioSession,
  unlockWebAudioForAutoplay,
} from '@features/aria/utils/webInterviewTtsDocumentLifecycle';
import { markWebInterviewUserGestureNow } from '@features/aria/utils/webInterviewGestureContext';
import { probeHeadphoneRoute } from '@features/aria/utils/audioRouteHeadphones';
import { preAuthorizeAudioElementOnMicTapGesture } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { requestMicrophonePermissionForInterviewStart } from '@utilities/permissions/requestMicPermission';
import { refreshWebAudioRoutesForSession } from '@utilities/sessionLogging/webMediaDeviceAudioRoute';
import { remoteLog } from '@utilities/remoteLog';
import { writeSessionLog } from '@utilities/sessionLogging';
import type { StartInterviewDeps, StartInterviewParams } from '@features/aria/sessionLifecycleTypes';

export type WebInterviewStartBootstrapOptions = {
  /** When true, do not start prefetched opening greeting audio on the Begin tap (mid-interview resume). */
  skipOpeningGreetingSync?: boolean;
};

export type WebInterviewStartBootstrapResult = {
  greetingSyncStarted: boolean;
  earlyWebRouteProbe: HeadphoneProbeResult | null;
  aborted: boolean;
};

export async function bootstrapWebInterviewStartAudio(
  deps: StartInterviewDeps,
  params: StartInterviewParams | undefined,
  interviewStartTapClockMs: number,
  options?: WebInterviewStartBootstrapOptions,
): Promise<WebInterviewStartBootstrapResult> {
  const {
    userId,
    hasResumedRef,
    interviewSessionAttemptIdRef,
    audioRecorder,
    lastHeadphoneProbeRef,
    setAudioRouteKind,
    lastAudioRouteFingerprintRef,
    setMobileWebTapToBeginDone,
    setMicError,
    setVoiceState,
    setStatus,
    setInterviewStatus,
  } = deps;
  const opts = params;
  let greetingSyncStarted = false;
  let earlyWebRouteProbe: HeadphoneProbeResult | null = null;

  if (!hasResumedRef.current) {
    resetWebInterviewAudioSession();
  }
  if (opts?.fromUserGesture && Platform.OS === 'web') {
    setMobileWebTapToBeginDone(true);
    markWebInterviewUserGestureNow();
  }
  if (Platform.OS !== 'web') {
    return { greetingSyncStarted, earlyWebRouteProbe, aborted: false };
  }

  unlockWebAudioForAutoplay();
  const skipOpeningGreetingSync = options?.skipOpeningGreetingSync === true;
  if (opts?.fromUserGesture === true) {
    primeHtmlAudioForMobileTtsFromMicGesture();
    preAuthorizeAudioElementOnMicTapGesture();
  }
  // Opening greeting plays after mic grant via speakTextSafe (prefetch element or ElevenLabs).
  // Sync play before await mic skips pre-auth and is often interrupted by the permission UI.
  if (opts?.fromUserGesture === true && !skipOpeningGreetingSync) {
    void remoteLog('[START] deferring_opening_greeting_until_after_mic');
  }
  const micGate = await requestMicrophonePermissionForInterviewStart();
  const attemptIdForMicGate = interviewSessionAttemptIdRef.current;
  const webPlat = 'web' as const;
  if (!micGate.ok) {
    if (greetingSyncStarted) {
      stopWebInterviewGreetingPlaybackIfActive();
      hasResumedRef.current = false;
      setStatus('starting_interview');
      setInterviewStatus('not_started');
    }
    if (userId) {
      writeSessionLog({
        userId,
        attemptId: attemptIdForMicGate,
        eventType: 'mic_permission_denied_at_start',
        eventData: {
          platform: webPlat,
          attempt_id: attemptIdForMicGate,
          error_name: micGate.errorName ?? 'unknown',
        },
        platform: webPlat,
      });
    } else {
      void remoteLog('mic_permission_denied_at_start', {
        platform: webPlat,
        attempt_id: attemptIdForMicGate,
        error_name: micGate.errorName ?? 'unknown',
      });
    }
    setMicError(
      'Microphone access is required to complete the interview. Please allow microphone access and try again.',
    );
    setVoiceState('idle');
    return { greetingSyncStarted, earlyWebRouteProbe, aborted: true };
  }
  audioRecorder.markWebMicPermissionGranted();
  const timeToGrantMs = Date.now() - interviewStartTapClockMs;
  if (isWebGreetingAudiblePlaybackActive() || isWebInterviewOpeningGreetingSyncAudible()) {
    resetWebInterviewOpeningGreetingSyncIfInterrupted();
    void remoteLog('[START] cleared_stale_opening_greeting_before_deliver', {
      time_to_grant_ms: timeToGrantMs,
    });
  }
  if (userId) {
    writeSessionLog({
      userId,
      attemptId: attemptIdForMicGate,
      eventType: 'mic_permission_granted_at_start',
      eventData: {
        platform: webPlat,
        attempt_id: attemptIdForMicGate,
        time_to_grant_ms: timeToGrantMs,
      },
      platform: webPlat,
    });
  } else {
    void remoteLog('mic_permission_granted_at_start', {
      platform: webPlat,
      attempt_id: attemptIdForMicGate,
      time_to_grant_ms: timeToGrantMs,
    });
  }
  await refreshWebAudioRoutesForSession({ probeMicrophone: false });
  if (opts?.fromUserGesture) {
    earlyWebRouteProbe = await probeHeadphoneRoute();
    lastHeadphoneProbeRef.current = earlyWebRouteProbe;
    setAudioRouteKind(earlyWebRouteProbe.kind);
    lastAudioRouteFingerprintRef.current = earlyWebRouteProbe.fingerprint;
  }
  return { greetingSyncStarted, earlyWebRouteProbe, aborted: false };
}
