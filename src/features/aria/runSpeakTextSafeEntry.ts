import { Platform } from 'react-native';

import { applySpeakTextSafePreDelivery } from '@features/aria/applySpeakTextSafePreDelivery';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import {
  runSpeakTextSafeImmediateWebGreetingPlayback,
} from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import type { SpeakTextSafeDeps, SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { isPreAuthorizedAudioPendingForNextTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';
import {
  refreshSpeakTextSafeWebGestureAfterLongProcessing,
  runSpeakTextSafePreauthorizedTabGestureRestore,
} from '@features/aria/speakTextSafeWebGestureGate';

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
  immediateWebPlaybackElement?: HTMLAudioElement;
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
  let effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource =
    Platform.OS === 'web' && isPreAuthorizedAudioPendingForNextTts()
      ? 'preauthorized_element'
      : resolved.ttsTriggerSource;

  await deps.awaitTtsScreenReadyGate('speak_text_safe');
  const speakGenerationAtStart =
    Platform.OS === 'web' ? deps.webTtsSpeakGenerationRef.current : 0;
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
    setVoiceState: deps.setVoiceState,
  });
  if (preDelivery.suppressed) {
    return { status: 'suppressed' };
  }

  const preparedText = preDelivery.text;
  const textForAudio = preDelivery.textForAudio;

  if (Platform.OS === 'web') {
    if (await refreshSpeakTextSafeWebGestureAfterLongProcessing(deps.userId)) {
      effectiveTtsTriggerSource = 'preauthorized_element';
    }
  }

  if (Platform.OS === 'web' && resolved.immediateWebPlaybackElement && deps.userId) {
    const handled = await runSpeakTextSafeImmediateWebGreetingPlayback(deps, {
      userId: deps.userId,
      text: preparedText,
      options,
      mobileWebTapToBeginDone: deps.mobileWebTapToBeginDone,
      immediateWebPlaybackElement: resolved.immediateWebPlaybackElement,
    });
    if (handled) {
      return { status: 'immediate_greeting_handled' };
    }
  }

  let ttsQueuedPendingTabReturn = false;
  let gestureRestoredAfterTabSwitchForThisPlayback = false;

  if (
    Platform.OS === 'web' &&
    effectiveTtsTriggerSource === 'preauthorized_element' &&
    !resolved.skipGestureGate
  ) {
    const tabRestore = await runSpeakTextSafePreauthorizedTabGestureRestore({
      userId: deps.userId,
      needsGestureRestoreRef: deps.needsGestureRestoreRef,
      tabVisibilityGestureLossPendingRef: deps.tabVisibilityGestureLossPendingRef,
      gestureContextLostAtRef: deps.gestureContextLostAtRef,
      webTtsTabInterruptPendingReplayRef: deps.webTtsTabInterruptPendingReplayRef,
      pendingGestureRestoreSpeakRef: deps.pendingGestureRestoreSpeakRef,
      setWebTabGestureRestoreOverlay: deps.setWebTabGestureRestoreOverlay,
    });
    ttsQueuedPendingTabReturn = tabRestore.ttsQueuedPendingTabReturn;
    gestureRestoredAfterTabSwitchForThisPlayback = tabRestore.gestureRestoredAfterTabSwitch;
  }

  return {
    status: 'ready',
    text: preparedText,
    textForAudio,
    resolved,
    effectiveTtsTriggerSource,
    speakGenerationAtStart,
    incomingAssistantTtsTextForS2Repair,
    closingTtsSessionKey,
    ttsQueuedPendingTabReturn,
    gestureRestoredAfterTabSwitchForThisPlayback,
  };
}
