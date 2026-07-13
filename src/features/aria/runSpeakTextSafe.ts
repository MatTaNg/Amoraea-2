import { Platform } from 'react-native';

import { runSpeakTextSafeEntry } from '@features/aria/runSpeakTextSafeEntry';
import { runSpeakTextSafeMainSpeakBody } from '@features/aria/runSpeakTextSafeMainSpeakBody';
import type { SpeakTextSafeDeps, SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import { prepareSpeakTextSafeMainPlayback } from '@features/aria/prepareSpeakTextSafeMainPlayback';

export async function runSpeakTextSafe(
  deps: SpeakTextSafeDeps,
  text: string,
  options: SpeakTextSafeOptions = {},
): Promise<void> {
  const entry = await runSpeakTextSafeEntry(deps, text, options);
  if (entry.status === 'suppressed' || entry.status === 'immediate_greeting_handled') {
    return;
  }

  text = entry.text;
  const {
    textForAudio,
    resolved,
    effectiveTtsTriggerSource,
    speakGenerationAtStart,
    incomingAssistantTtsTextForS2Repair,
    closingTtsSessionKey,
    ttsQueuedPendingTabReturn,
    gestureRestoredAfterTabSwitchForThisPlayback,
  } = entry;
  const {
    silent,
    interviewSpeechRole,
    telemetrySourceOpt,
    skipInterviewSpeechAdvance,
    skipQuestionDeliveredTelemetry,
    skipLastQuestionRef,
    allowDuplicateConsecutiveTts,
    skipGestureGate,
  } = resolved;

  const playbackPrep = await prepareSpeakTextSafeMainPlayback({
    text,
    options,
    userId: deps.userId,
    mobileWebTapToBeginDone: deps.mobileWebTapToBeginDone,
    effectiveTtsTriggerSource,
    speakGenerationAtStart,
    skipGestureGate,
    silent,
    interviewSpeechRole,
    telemetrySourceOpt,
    skipInterviewSpeechAdvance,
    skipQuestionDeliveredTelemetry,
    skipLastQuestionRef,
    allowDuplicateConsecutiveTts,
    ttsQueuedPendingTabReturn,
    gestureRestoredAfterTabSwitchForThisPlayback,
    stopElevenLabsPlayback: deps.stopElevenLabsPlayback,
    referenceCardShouldUpdateOnPlaybackStart: deps.referenceCardShouldUpdateOnPlaybackStart,
    applyReferenceCardFromAssistantSpeechRef: deps.applyReferenceCardFromAssistantSpeechRef,
    interviewStatusRef: deps.interviewStatusRef,
    needsGestureRestoreRef: deps.needsGestureRestoreRef,
    pendingGestureRestoreSpeakRef: deps.pendingGestureRestoreSpeakRef,
    setWebTabGestureRestoreOverlay: deps.setWebTabGestureRestoreOverlay,
    webTtsTabInterruptPendingReplayRef: deps.webTtsTabInterruptPendingReplayRef,
    tabHiddenDuringActiveTtsLineRef: deps.tabHiddenDuringActiveTtsLineRef,
    webTtsSpeakGenerationRef: deps.webTtsSpeakGenerationRef,
    recordingJustFinishedBeforeNextTtsRef: deps.recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef: deps.postRecordingParallelStreamSettleRef,
    ttsLineInFlightRef: deps.ttsLineInFlightRef,
    webTtsUtteranceInFlightRef: deps.webTtsUtteranceInFlightRef,
    webTtsUtteranceInFlightOptionsRef: deps.webTtsUtteranceInFlightOptionsRef,
    tabVisibilityGestureLossPendingRef: deps.tabVisibilityGestureLossPendingRef,
    gestureContextLostAtRef: deps.gestureContextLostAtRef,
  });
  if (playbackPrep.status === 'gesture_queued') {
    return;
  }

  await runSpeakTextSafeMainSpeakBody({
    deps,
    text,
    textForAudio,
    resolved,
    effectiveTtsTriggerSource,
    speakGenerationAtStart,
    incomingAssistantTtsTextForS2Repair,
    closingTtsSessionKey,
    playbackPrep,
  });
}
