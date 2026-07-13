import { Platform } from 'react-native';

import { ANTHROPIC_API_KEY, ANTHROPIC_PROXY_URL } from '@features/aria/scoreInterviewModuleConstants';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import {
  getPrefetchedGreetingHtmlAudioElement,
  releaseWebInterviewGreetingPrefetch,
  resetWebInterviewOpeningGreetingSyncIfInterrupted,
  WEB_INTERVIEW_OPENING_GREETING,
} from '@features/aria/utils/webInterviewGreetingAudio';
import { isPreAuthorizedAudioPendingForNextTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { primeHtmlAudioForMobileTtsFromMicGesture } from '@features/aria/utils/webInterviewSharedHtmlAudio';
import { preAuthorizeAudioElementOnMicTapGesture } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import { probeHeadphoneRoute } from '@features/aria/utils/audioRouteHeadphones';
import { setPlaybackMode } from '@features/aria/utils/audioModeHelpers';
import { isGreetingOnly } from '@features/aria/interviewLocalPersistence';
import { applyInterviewStartUnavailableFailure } from '@features/aria/applyInterviewStartUnavailableFailure';
import { resetSessionLogRuntime } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';
import type { StartInterviewDeps, StartInterviewParams } from '@features/aria/sessionLifecycleTypes';

export type DeliverInterviewOpeningParams = {
  opts: StartInterviewParams | undefined;
  greetingSyncStarted: boolean;
  earlyWebRouteProbe: HeadphoneProbeResult | null;
  interviewAttemptBootstrap: StartInterviewDeps['interviewAttemptBootstrap'];
  runSessionStartLogging: (probe: HeadphoneProbeResult) => Promise<void>;
};

export async function deliverInterviewOpeningGreeting(
  deps: StartInterviewDeps,
  params: DeliverInterviewOpeningParams,
): Promise<void> {
  const {
    userId,
    isAdmin,
    audioRecorder,
    speakTextSafe,
    notifyScenarioStarted,
    resetInterviewProgressRefs,
    hasResumedRef,
    lastHeadphoneProbeRef,
    setAudioRouteKind,
    lastAudioRouteFingerprintRef,
    setVoiceState,
    setStatus,
    setInterviewStatus,
    recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef,
    lastVoiceTurnLanguageRef,
    lastVoiceTurnConfidenceRef,
    currentScenarioRef,
    interviewSessionIdRef,
    lastQuestionTextRef,
    currentMessagesRef,
  } = deps;
  const { opts, greetingSyncStarted, earlyWebRouteProbe, interviewAttemptBootstrap, runSessionStartLogging } =
    params;

  const openingLineText = WEB_INTERVIEW_OPENING_GREETING;
  let openingLineDeliveredEarly = false;
  let sessionStartLogged = false;
  const runSessionStartOnce = async (probe: HeadphoneProbeResult) => {
    if (sessionStartLogged) return;
    sessionStartLogged = true;
    await runSessionStartLogging(probe);
  };
  const hasApiKeys = !!ANTHROPIC_API_KEY || !!ANTHROPIC_PROXY_URL;
  const webGestureFirstGreeting =
    Platform.OS === 'web' &&
    opts?.fromUserGesture === true &&
    hasApiKeys &&
    !!userId &&
    !isAdmin &&
    interviewAttemptBootstrap === 'ready';

  let routeProbe: HeadphoneProbeResult =
    earlyWebRouteProbe ??
    lastHeadphoneProbeRef.current ?? {
      input: null,
      fingerprint: null,
      kind: 'unknown',
      shouldShowHeadphonePrompt: false,
    };
  if (Platform.OS === 'web' && !earlyWebRouteProbe) {
    routeProbe = await probeHeadphoneRoute();
    lastHeadphoneProbeRef.current = routeProbe;
    setAudioRouteKind(routeProbe.kind);
    lastAudioRouteFingerprintRef.current = routeProbe.fingerprint;
  }

  if (webGestureFirstGreeting) {
    const skipOpeningBecauseStorageResume =
      currentMessagesRef.current.length > 0 &&
      !isGreetingOnly(currentMessagesRef.current) &&
      (hasResumedRef.current ||
        currentMessagesRef.current.filter((m) => m.role === 'user').length >= 2);
    if (skipOpeningBecauseStorageResume) {
      await runSessionStartOnce(routeProbe);
      return;
    }
    setStatus('active');
    setInterviewStatus('in_progress');
    hasResumedRef.current = true;
    setVoiceState((prev) => (prev === 'speaking' ? 'speaking' : 'processing'));
    resetInterviewProgressRefs();
    if (Platform.OS === 'web') {
      audioRecorder.resetWebMicInputFallbackState();
    }
    recordingJustFinishedBeforeNextTtsRef.current = false;
    postRecordingParallelStreamSettleRef.current = false;
    lastVoiceTurnLanguageRef.current = null;
    lastVoiceTurnConfidenceRef.current = null;
    currentScenarioRef.current = 1;
    const openingRowWeb: MessageWithScenario = {
      role: 'assistant',
      content: openingLineText,
      scenarioNumber: 1,
    };
    deps.setMessages([openingRowWeb]);
    currentMessagesRef.current = [openingRowWeb];
    lastQuestionTextRef.current = openingLineText;
    await notifyScenarioStarted(1, [openingRowWeb], { allowMessageHistoryShrink: true });
    resetWebInterviewOpeningGreetingSyncIfInterrupted();
    const prefetchedEl = getPrefetchedGreetingHtmlAudioElement();
    void remoteLog('[START] opening_greeting_playback', {
      prefetched_element: prefetchedEl != null,
      preauth_pending: isPreAuthorizedAudioPendingForNextTts(),
    });
    if (prefetchedEl) {
      await speakTextSafe(openingLineText, {
        telemetrySource: 'greeting',
        ttsTriggerSource: 'gesture_handler',
        immediateWebPlaybackElement: prefetchedEl,
        greetingAlreadyAudible: false,
        skipGestureGate: true,
      });
      releaseWebInterviewGreetingPrefetch();
    } else {
      await speakTextSafe(openingLineText, {
        telemetrySource: 'greeting',
        ttsTriggerSource: 'gesture_handler',
        skipGestureGate: true,
      });
    }
    openingLineDeliveredEarly = true;
    if (Platform.OS === 'web') {
      primeHtmlAudioForMobileTtsFromMicGesture();
      preAuthorizeAudioElementOnMicTapGesture();
    }
    await runSessionStartOnce(routeProbe);
  }

  if (Platform.OS !== 'web') {
    const granted = await audioRecorder.requestPermission();
    deps.setMicPermission(granted ? 'granted' : 'denied');
    await remoteLog('[START] Mic permission result', { granted });
    if (!granted) {
      if (__DEV__) console.warn('[Amoraea] Mic permission denied at start');
      setVoiceState('idle');
      deps.setMicError('Microphone access was denied. Enable the microphone in settings, then try again.');
      return;
    }
  }

  if (Platform.OS !== 'web') {
    routeProbe = await probeHeadphoneRoute();
    lastHeadphoneProbeRef.current = routeProbe;
    setAudioRouteKind(routeProbe.kind);
    lastAudioRouteFingerprintRef.current = routeProbe.fingerprint;
  }

  if (Platform.OS !== 'web') {
    await setPlaybackMode();
    await remoteLog('[START] Audio mode set');
  }

  if (!openingLineDeliveredEarly) {
    setStatus('active');
    setInterviewStatus('in_progress');
    hasResumedRef.current = true;
    setVoiceState('processing');
    resetInterviewProgressRefs();
    if (Platform.OS === 'web') {
      audioRecorder.resetWebMicInputFallbackState();
    }
    recordingJustFinishedBeforeNextTtsRef.current = false;
    postRecordingParallelStreamSettleRef.current = false;
    lastVoiceTurnLanguageRef.current = null;
    lastVoiceTurnConfidenceRef.current = null;
  }

  if (userId) {
    await runSessionStartOnce(routeProbe);
  } else {
    resetSessionLogRuntime({
      sessionCorrelationId: interviewSessionIdRef.current,
      attemptId: null,
      sessionLogsRequireAttemptId: false,
    });
  }

  const hasKey = !!ANTHROPIC_API_KEY;
  const hasProxy = !!ANTHROPIC_PROXY_URL;
  await remoteLog('[START] API check', {
    hasAnthropicKey: hasKey,
    hasProxyUrl: hasProxy,
    willUseFallback: !hasKey && !hasProxy,
  });

  if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) {
    await remoteLog('[START] No API key or proxy — interview unavailable');
    if (__DEV__) console.error('[Amoraea] INIT: No API key or proxy — interview unavailable');
    await applyInterviewStartUnavailableFailure(deps);
    return;
  }

  if (!openingLineDeliveredEarly) {
    await remoteLog('[START] Delivering real greeting');
    currentScenarioRef.current = 1;
    const openingRowNative: MessageWithScenario = {
      role: 'assistant',
      content: openingLineText,
      scenarioNumber: 1,
    };
    deps.setMessages([openingRowNative]);
    lastQuestionTextRef.current = openingLineText;
    await notifyScenarioStarted(1, [openingRowNative], { allowMessageHistoryShrink: true });
    await speakTextSafe(openingLineText, {
      telemetrySource: 'greeting',
      ttsTriggerSource: opts?.fromUserGesture ? 'gesture_handler' : 'callback',
      skipGestureGate: Platform.OS === 'web' && opts?.fromUserGesture === true,
    });
    await remoteLog('[START] Real greeting sent');
  }
}
