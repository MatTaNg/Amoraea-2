import { applySpeakTextSafePreDelivery } from '@features/aria/applySpeakTextSafePreDelivery';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/speakTextSafeSuccessfulDelivery';
import type { SpeakTextSafeDeps, SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';

export type SpeakTextSafeResolvedOptions = {
  silent: boolean;
  interviewSpeechRole?: SpeakTextSafeOptions['interviewSpeechRole'];
  telemetrySourceOpt?: TtsTelemetrySource;
  ttsPipeline?: string;
  skipQuestionDeliveredTelemetry: boolean;
  skipInterviewSpeechAdvance: boolean;
  skipQuestionTiming: boolean;
  skipLastQuestionRef: boolean;
  allowDuplicateConsecutiveTts: boolean;
  skipClosingSessionDedup: boolean;
  skipScenarioAContemptProbeSessionDedup: boolean;
  skipPcmStream: boolean;
  prefetchedMpegArrayBuffer?: ArrayBuffer;
  skipGestureGate: boolean;
  ttsTriggerSource: SpeakTextSafeTtsTriggerSource;
  immediateWebPlaybackElement?: unknown;
  greetingAlreadyAudible: boolean;
};

export type RunSpeakTextSafeEntryResult =
  | { status: 'suppressed' }
  | { status: 'immediate_greeting_handled' }
  | {
      status: 'ready';
      text: string;
      textForAudio: string;
      resolved: SpeakTextSafeResolvedOptions;
      effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource;
      speakGenerationAtStart: number;
      incomingAssistantTtsTextForS2Repair: string;
      closingTtsSessionKey: string;
      ttsQueuedPendingTabReturn: boolean;
      gestureRestoredAfterTabSwitchForThisPlayback: boolean;
    };

export function resolveSpeakTextSafeOptions(
  options: SpeakTextSafeOptions = {},
): SpeakTextSafeResolvedOptions {
  const {
    silent = false,
    interviewSpeechRole,
    telemetrySource: telemetrySourceOpt,
    ttsPipeline,
    skipQuestionDeliveredTelemetry = false,
    skipInterviewSpeechAdvance = false,
    skipQuestionTiming = false,
    skipLastQuestionRef = false,
    allowDuplicateConsecutiveTts = false,
    skipClosingSessionDedup = false,
    skipScenarioAContemptProbeSessionDedup = false,
    skipPcmStream = false,
    prefetchedMpegArrayBuffer,
    skipGestureGate = false,
    ttsTriggerSource = 'callback',
    immediateWebPlaybackElement,
    greetingAlreadyAudible = false,
  } = options;

  return {
    silent,
    interviewSpeechRole,
    telemetrySourceOpt,
    ttsPipeline,
    skipQuestionDeliveredTelemetry,
    skipInterviewSpeechAdvance,
    skipQuestionTiming,
    skipLastQuestionRef,
    allowDuplicateConsecutiveTts,
    skipClosingSessionDedup,
    skipScenarioAContemptProbeSessionDedup,
    skipPcmStream,
    prefetchedMpegArrayBuffer,
    skipGestureGate,
    ttsTriggerSource,
    immediateWebPlaybackElement,
    greetingAlreadyAudible,
  };
}

export async function runSpeakTextSafeEntry(
  deps: SpeakTextSafeDeps,
  text: string,
  options: SpeakTextSafeOptions = {},
): Promise<RunSpeakTextSafeEntryResult> {
  const resolved = resolveSpeakTextSafeOptions(options);
  const effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource = resolved.ttsTriggerSource;

  await deps.awaitTtsScreenReadyGate('speak_text_safe');
  const speakGenerationAtStart = 0;
  const incomingAssistantTtsTextForS2Repair = text;
  const closingTtsSessionKey =
    deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current;

  const preDelivery = applySpeakTextSafePreDelivery({
    text,
    silent: resolved.silent,
    interviewSpeechRole: resolved.interviewSpeechRole,
    telemetrySourceOpt: resolved.telemetrySourceOpt,
    allowDuplicateConsecutiveTts: resolved.allowDuplicateConsecutiveTts,
    skipClosingSessionDedup: resolved.skipClosingSessionDedup,
    skipScenarioAContemptProbeSessionDedup: resolved.skipScenarioAContemptProbeSessionDedup,
    userId: deps.userId,
    interviewName: deps.interviewNameRef.current,
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    currentScenario: deps.currentScenarioRef.current,
    s2RepairProbeDelivered: deps.s2RepairProbeDeliveredRef.current,
    lastSuccessfulTtsTextNormalized: deps.lastSuccessfulTtsTextNormalizedRef.current,
    lastSuccessfulTtsDeliveredPreview: deps.lastSuccessfulTtsDeliveredPreviewRef.current,
    lastQuestionText: deps.lastQuestionTextRef.current,
    closingTtsSessionKey,
    interviewSessionId: deps.interviewSessionIdRef.current,
    scenarioAContemptProbePlaybackConfirmed: deps.scenarioAContemptProbePlaybackConfirmedRef.current,
    situation3CanonicalPlaybackConfirmed:
      !!deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.situation_3,
    s3RepairProbeDelivered: !!deps.s3RepairProbeDeliveredRef?.current,
    setVoiceState: deps.setVoiceState,
  });
  if (preDelivery.suppressed) {
    return { status: 'suppressed' };
  }

  return {
    status: 'ready',
    text: preDelivery.text,
    textForAudio: preDelivery.textForAudio,
    resolved,
    effectiveTtsTriggerSource,
    speakGenerationAtStart,
    incomingAssistantTtsTextForS2Repair,
    closingTtsSessionKey,
    ttsQueuedPendingTabReturn: false,
    gestureRestoredAfterTabSwitchForThisPlayback: false,
  };
}
