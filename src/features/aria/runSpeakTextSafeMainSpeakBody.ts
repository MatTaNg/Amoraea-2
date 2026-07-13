import { Platform } from 'react-native';

import { applySpeakTextSafePostPlaybackSuccess } from '@features/aria/applySpeakTextSafePostPlaybackSuccess';
import { applySpeakTextSafeQuestionDeliveredTelemetry, resolveSpeakTextSafeInterviewLineDelivery } from '@features/aria/applySpeakTextSafeQuestionDeliveredTelemetry';
import { finalizeSpeakTextSafeTtsSession } from '@features/aria/finalizeSpeakTextSafeTtsSession';
import { handleSpeakTextSafeTtsPlaybackError } from '@features/aria/handleSpeakTextSafeTtsPlaybackError';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import type { SpeakTextSafeMainPlaybackPrep } from '@features/aria/prepareSpeakTextSafeMainPlayback';
import {
  runSpeakTextSafeWebDurationVerificationLoop,
} from '@features/aria/runSpeakTextSafeWebDurationVerificationLoop';
import type { SpeakTextSafeResolvedOptions } from '@features/aria/runSpeakTextSafeEntry';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import { writeSpeakTextSafePlaybackCompletionTelemetry } from '@features/aria/speakTextSafePlaybackCompletionTelemetry';
import { shouldUseWebTtsDurationVerification } from '@features/aria/speakTextSafeWebDurationRetry';
import { withRetry } from '@utilities/withRetry';

export type SpeakTextSafeMainSpeakBodyArgs = {
  deps: SpeakTextSafeDeps;
  text: string;
  textForAudio: string;
  resolved: SpeakTextSafeResolvedOptions;
  effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource;
  speakGenerationAtStart: number;
  incomingAssistantTtsTextForS2Repair: string;
  closingTtsSessionKey: string;
  playbackPrep: Extract<SpeakTextSafeMainPlaybackPrep, { status: 'ready' }>;
};

export async function runSpeakTextSafeMainSpeakBody(
  args: SpeakTextSafeMainSpeakBodyArgs,
): Promise<void> {
  const {
    deps,
    text,
    textForAudio,
    resolved,
    effectiveTtsTriggerSource,
    speakGenerationAtStart,
    incomingAssistantTtsTextForS2Repair,
    closingTtsSessionKey,
    playbackPrep,
  } = args;

  const {
    userId,
    setVoiceState,
    setWebTabGestureRestoreOverlay,
    setWebDesktopPendingTtsGestureOverlay,
    setTtsPlaybackReliabilityNotice,
    setLastTtsCompletionCallbackMs,
    speak,
    applyInterviewSpeechComplete,
    ensureWebGestureFlushListener,
    stopElevenLabsPlayback,
    webSpeechShouldDeferToUserGesture,
    rearmWebMicPreInitAfterTtsPlaybackComplete,
    scheduleWebMicPreInitRefreshAfterTtsCompletes,
    webTtsSpeakGenerationRef,
    currentInterviewMomentRef,
    currentScenarioRef,
    s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef,
    lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef,
    interviewSessionAttemptIdRef,
    interviewSessionIdRef,
    scenarioAContemptProbePlaybackConfirmedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioAContemptProbeTtsDeliveredSessionRef,
    webTtsTabInterruptPendingReplayRef,
    pendingGestureRestoreSpeakRef,
    needsGestureRestoreRef,
    tabHiddenDuringActiveTtsLineRef,
    webTtsUtteranceInFlightRef,
    webTtsUtteranceInFlightOptionsRef,
    firstScenarioLifecyclePersistedRef,
    ttsSessionHardFailureCountRef,
    timingRef,
    pendingWebSpeechForGestureRef,
    persistInterviewAttemptSessionLifecycle,
    recordInterviewAssistantDeliveryForMetaExemptionRef,
    ttsLineInFlightRef,
  } = deps;

  const {
    silent,
    interviewSpeechRole,
    ttsPipeline,
    skipQuestionDeliveredTelemetry,
    skipInterviewSpeechAdvance,
    skipQuestionTiming,
    skipLastQuestionRef,
    skipPcmStream,
    prefetchedMpegArrayBuffer,
  } = resolved;

  const {
    telemetrySource,
    priorRec,
    sessionRuntime: rt0,
    onScenarioPlaybackStarted,
    shouldYieldInFlightSpeakToTabRestore,
    ttsStart,
  } = playbackPrep;

  try {
    const charCount = stripControlTokens(text).trim().length;
    const useWebDurationVerification = shouldUseWebTtsDurationVerification({
      silent,
      charCount,
      telemetrySource,
    });

    let speakOutcome:
      | { scenarioSplitDelivery?: { segment1_expected_duration_ms: number; segment2_expected_duration_ms: number } }
      | void
      | undefined;
    let actualTtsMs = 0;
    let verificationOk = true;
    let acceptedStableTruncationAsEstimationError = false;

    if (useWebDurationVerification) {
      ({
        speakOutcome,
        actualTtsMs,
        verificationOk,
        acceptedStableTruncationAsEstimationError,
      } = await runSpeakTextSafeWebDurationVerificationLoop({
        speak,
        textForAudio,
        text,
        charCount,
        telemetrySource,
        interviewSpeechRole,
        skipLastQuestionRef,
        skipPcmStream,
        skipMicPreInitDuringPlayback: priorRec,
        effectiveTtsTriggerSource,
        prefetchedMpegArrayBuffer,
        onScenarioPlaybackStarted,
        priorRec,
        userId,
        interviewSessionId: interviewSessionIdRef.current,
        stopElevenLabsPlayback,
        shouldYieldInFlightSpeakToTabRestore,
        tabHiddenDuringActiveTtsLine: tabHiddenDuringActiveTtsLineRef.current,
        currentInterviewMoment: currentInterviewMomentRef.current,
        currentScenario: currentScenarioRef.current,
        s2RepairProbeDeliveredRef,
        s3RepairProbeDeliveredRef,
        ttsSessionHardFailureCountRef,
        setTtsPlaybackReliabilityNotice,
        skipQuestionTiming,
        timingRef,
      }));
    } else {
      speakOutcome = await withRetry(
        () =>
          speak(textForAudio, {
            telemetrySource,
            skipQuestionTiming,
            skipLastQuestionRef,
            ttsTriggerSource: effectiveTtsTriggerSource,
            skipPcmStream,
            skipMicPreInitDuringPlayback: priorRec,
            prefetchedMpegArrayBuffer,
            onPlaybackStarted: onScenarioPlaybackStarted,
          }),
        {
          retries: 1,
          baseDelay: 3000,
          context: 'TTS',
          sessionLog:
            userId ? { userId, attemptId: rt0.attemptId, platform: rt0.platform } : undefined,
        },
      );
      actualTtsMs = Date.now() - ttsStart;
    }

    let audioPlaybackTruncated = false;
    if (userId) {
      ({ audioPlaybackTruncated } = writeSpeakTextSafePlaybackCompletionTelemetry({
        userId,
        text,
        telemetrySource,
        speakOutcome,
        actualTtsMs,
        charCount,
        useWebDurationVerification,
        verificationOk,
        acceptedStableTruncationAsEstimationError,
        currentInterviewMoment: currentInterviewMomentRef.current,
        scenarioAContemptProbePlaybackConfirmedRef,
        showScenarioCardCanonicalPlaybackConfirmedKindsRef,
      }));
    }

    const { skipDeliveryForTabInterrupt, isInterviewLine } = resolveSpeakTextSafeInterviewLineDelivery({
      isWeb: Platform.OS === 'web',
      webTtsTabInterruptPendingReplay: webTtsTabInterruptPendingReplayRef.current,
      tabHiddenDuringActiveTtsLine: tabHiddenDuringActiveTtsLineRef.current,
      speakGenerationAtStart,
      webTtsSpeakGeneration: webTtsSpeakGenerationRef.current,
      skipQuestionDeliveredTelemetry,
      interviewSpeechRole,
      telemetrySource,
    });
    if (userId) {
      applySpeakTextSafeQuestionDeliveredTelemetry({
        userId,
        text,
        isInterviewLine,
        audioPlaybackTruncated,
        ttsPipeline,
        currentInterviewMoment: currentInterviewMomentRef.current,
        currentScenario: currentScenarioRef.current,
        incomingAssistantTtsTextForS2Repair,
        s2RepairProbeDeliveredRef,
        s3RepairProbeDeliveredRef,
        recordInterviewAssistantDeliveryForMetaExemptionRef,
        firstScenarioLifecyclePersistedRef,
        interviewSessionAttemptIdRef,
        persistInterviewAttemptSessionLifecycle,
      });
    }
    applySpeakTextSafePostPlaybackSuccess({
      text,
      silent,
      skipDeliveryForTabInterrupt,
      interviewSpeechRole,
      skipInterviewSpeechAdvance,
      applyInterviewSpeechComplete,
      lastSuccessfulTtsTextNormalizedRef,
      lastSuccessfulTtsDeliveredPreviewRef,
      scenarioAContemptProbeTtsDeliveredSessionRef,
      scenarioAContemptProbePlaybackConfirmedRef,
      showScenarioCardCanonicalPlaybackConfirmedKindsRef,
      closingTtsSessionKey,
    });
  } catch (err) {
    handleSpeakTextSafeTtsPlaybackError({
      err,
      text,
      interviewSpeechRole,
      skipInterviewSpeechAdvance,
      isWeb: Platform.OS === 'web',
      webTtsTabInterruptPendingReplay: webTtsTabInterruptPendingReplayRef.current,
      speakGenerationAtStart,
      webTtsSpeakGeneration: webTtsSpeakGenerationRef.current,
      setVoiceState,
      pendingGestureRestoreSpeakRef,
      needsGestureRestoreRef,
      setWebTabGestureRestoreOverlay,
      pendingWebSpeechForGestureRef,
      ensureWebGestureFlushListener,
      setWebDesktopPendingTtsGestureOverlay,
      applyInterviewSpeechComplete,
    });
  } finally {
    finalizeSpeakTextSafeTtsSession({
      userId,
      isWeb: Platform.OS === 'web',
      telemetrySource,
      ttsLineInFlightRef,
      webTtsTabInterruptPendingReplay: webTtsTabInterruptPendingReplayRef.current,
      tabHiddenDuringActiveTtsLineRef,
      webTtsUtteranceInFlightRef,
      webTtsUtteranceInFlightOptionsRef,
      setLastTtsCompletionCallbackMs,
      webSpeechShouldDeferToUserGesture,
      scheduleWebMicPreInitRefreshAfterTtsCompletes,
      rearmWebMicPreInitAfterTtsPlaybackComplete,
    });
  }
}
