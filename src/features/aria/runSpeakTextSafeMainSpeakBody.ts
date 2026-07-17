import { applySpeakTextSafePostPlaybackSuccess } from '@features/aria/applySpeakTextSafePostPlaybackSuccess';
import { applySpeakTextSafeQuestionDeliveredTelemetry, resolveSpeakTextSafeInterviewLineDelivery } from '@features/aria/applySpeakTextSafeQuestionDeliveredTelemetry';
import { finalizeSpeakTextSafeTtsSession } from '@features/aria/finalizeSpeakTextSafeTtsSession';
import { handleSpeakTextSafeTtsPlaybackError } from '@features/aria/handleSpeakTextSafeTtsPlaybackError';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import type { SpeakTextSafeMainPlaybackPrep } from '@features/aria/prepareSpeakTextSafeMainPlayback';
import type { SpeakTextSafeResolvedOptions } from '@features/aria/runSpeakTextSafeEntry';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/speakTextSafeSuccessfulDelivery';
import { writeSpeakTextSafePlaybackCompletionTelemetry } from '@features/aria/speakTextSafePlaybackCompletionTelemetry';
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
    setLastTtsCompletionCallbackMs,
    speak,
    applyInterviewSpeechComplete,
    ttsSpeakGenerationRef,
    currentInterviewMomentRef,
    currentScenarioRef,
    s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef,
    lastSuccessfulTtsTextNormalizedRef,
    lastSuccessfulTtsDeliveredPreviewRef,
    interviewSessionAttemptIdRef,
    scenarioAContemptProbePlaybackConfirmedRef,
    showScenarioCardCanonicalPlaybackConfirmedKindsRef,
    scenarioAContemptProbeTtsDeliveredSessionRef,
    ttsUtteranceInFlightRef,
    ttsUtteranceInFlightOptionsRef,
    firstScenarioLifecyclePersistedRef,
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
    ttsStart,
  } = playbackPrep;

  try {
    const charCount = stripControlTokens(text).trim().length;

    const speakOutcome = await withRetry(
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
    const actualTtsMs = Date.now() - ttsStart;

    let audioPlaybackTruncated = false;
    if (userId) {
      ({ audioPlaybackTruncated } = writeSpeakTextSafePlaybackCompletionTelemetry({
        userId,
        text,
        telemetrySource,
        speakOutcome,
        actualTtsMs,
        charCount,
        useWebDurationVerification: false,
        verificationOk: true,
        acceptedStableTruncationAsEstimationError: false,
        currentInterviewMoment: currentInterviewMomentRef.current,
        scenarioAContemptProbePlaybackConfirmedRef,
        showScenarioCardCanonicalPlaybackConfirmedKindsRef,
      }));
    }

    const { skipDeliveryForTabInterrupt, isInterviewLine } = resolveSpeakTextSafeInterviewLineDelivery({
      isWeb: false,
      webTtsTabInterruptPendingReplay: false,
      tabHiddenDuringActiveTtsLine: false,
      speakGenerationAtStart,
      webTtsSpeakGeneration: ttsSpeakGenerationRef.current,
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
    if (__DEV__ && err instanceof TypeError && /current/.test(err.message)) {
      const missing = [
        ['showScenarioCardCanonicalPlaybackConfirmedKindsRef', showScenarioCardCanonicalPlaybackConfirmedKindsRef],
        ['scenarioAContemptProbePlaybackConfirmedRef', scenarioAContemptProbePlaybackConfirmedRef],
        ['recordInterviewAssistantDeliveryForMetaExemptionRef', recordInterviewAssistantDeliveryForMetaExemptionRef],
        ['firstScenarioLifecyclePersistedRef', firstScenarioLifecyclePersistedRef],
        ['lastSuccessfulTtsTextNormalizedRef', lastSuccessfulTtsTextNormalizedRef],
        ['currentInterviewMomentRef', currentInterviewMomentRef],
        ['currentScenarioRef', currentScenarioRef],
      ]
        .filter(([, ref]) => ref == null)
        .map(([name]) => name);
      if (missing.length > 0) {
        console.warn('[TTS] speakTextSafe missing deps refs:', missing.join(', '));
      }
    }
    handleSpeakTextSafeTtsPlaybackError({
      err,
      text,
      interviewSpeechRole,
      skipInterviewSpeechAdvance,
      setVoiceState,
      applyInterviewSpeechComplete,
    });
  } finally {
    finalizeSpeakTextSafeTtsSession({
      userId,
      isWeb: false,
      telemetrySource,
      ttsLineInFlightRef,
      webTtsTabInterruptPendingReplay: false,
      ttsUtteranceInFlightRef,
      ttsUtteranceInFlightOptionsRef,
      setLastTtsCompletionCallbackMs,
    });
  }
}
