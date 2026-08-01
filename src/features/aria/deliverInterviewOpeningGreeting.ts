import { ANTHROPIC_API_KEY, ANTHROPIC_PROXY_URL } from '@features/aria/scoreInterviewModuleConstants';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { HeadphoneProbeResult } from '@features/aria/utils/audioRouteHeadphones';
import { INTERVIEW_OPENING_GREETING } from '@features/aria/utils/interviewOpeningGreeting';
import { probeHeadphoneRoute } from '@features/aria/utils/audioRouteHeadphones';
import { setPlaybackMode } from '@features/aria/utils/audioModeHelpers';
import { applyInterviewStartUnavailableFailure } from '@features/aria/applyInterviewStartUnavailableFailure';
import { resetSessionLogRuntime } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';
import { applyDevScenarioJumpAtInterviewStart } from '@features/aria/applyDevScenarioJumpAtInterviewStart';
import { resolveDevScenarioJumpTargetFromSession } from '@features/aria/devScenarioJumpReferral';
import type {
  InterviewSessionLifecycleDeps,
  StartInterviewDeps,
  StartInterviewParams,
} from '@features/aria/sessionLifecycleTypes';

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
  } = deps;
  const { opts, interviewAttemptBootstrap: _interviewAttemptBootstrap, runSessionStartLogging } =
    params;

  const openingLineText = INTERVIEW_OPENING_GREETING;
  let sessionStartLogged = false;
  const runSessionStartOnce = async (probe: HeadphoneProbeResult) => {
    if (sessionStartLogged) return;
    sessionStartLogged = true;
    await runSessionStartLogging(probe);
  };

  let routeProbe: HeadphoneProbeResult =
    params.earlyWebRouteProbe ??
    lastHeadphoneProbeRef.current ?? {
      input: null,
      fingerprint: null,
      kind: 'unknown',
      shouldShowHeadphonePrompt: false,
    };

  const granted = await audioRecorder.requestPermission();
  deps.setMicPermission(granted ? 'granted' : 'denied');
  if (__DEV__) {
    console.log('[START] Mic permission result', { granted });
  }
  await remoteLog('[START] Mic permission result', { granted });
  if (!granted) {
    if (__DEV__) console.warn('[Amoraea] Mic permission denied at start');
    setVoiceState('idle');
    deps.setMicError(
      'Microphone access was denied. Enable the microphone in settings, then try again.',
    );
    return;
  }

  routeProbe = await probeHeadphoneRoute();
  lastHeadphoneProbeRef.current = routeProbe;
  setAudioRouteKind(routeProbe.kind);
  lastAudioRouteFingerprintRef.current = routeProbe.fingerprint;

  await setPlaybackMode();
  await remoteLog('[START] Audio mode set');

  setStatus('active');
  setInterviewStatus('in_progress');
  if (__DEV__) {
    console.log('[START] Interview status -> active / in_progress');
  }
  hasResumedRef.current = true;
  setVoiceState('processing');
  resetInterviewProgressRefs();
  recordingJustFinishedBeforeNextTtsRef.current = false;
  postRecordingParallelStreamSettleRef.current = false;
  lastVoiceTurnLanguageRef.current = null;
  lastVoiceTurnConfidenceRef.current = null;

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

  await remoteLog('[START] Delivering real greeting');
  const devJumpTarget = await resolveDevScenarioJumpTargetFromSession(undefined);
  if (devJumpTarget != null && devJumpTarget !== 1) {
    const jumped = await applyDevScenarioJumpAtInterviewStart(
      deps as InterviewSessionLifecycleDeps,
      devJumpTarget,
      { fromUserGesture: opts?.fromUserGesture },
    );
    if (jumped) {
      await remoteLog('[START] Dev scenario jump greeting sent', { target: devJumpTarget });
      return;
    }
  }

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
  });
  await remoteLog('[START] Real greeting sent');
}
