import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import type { PendingGestureRestoreSpeakEntry } from '@features/aria/hooks/useAriaInterviewSession';
import type { SpeakTextSafeOptions, WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import {
  consumePriorRecordingFlagsForTts,
  drainPriorTtsPlaybackBeforeSpeak,
  releaseRecordingSessionBeforeTts,
} from '@features/aria/speakTextSafePreMainPlayback';
import { resolveSpeakTextSafeGestureContextLostResolution } from '@features/aria/speakTextSafeWebGestureTelemetry';
import {
  isSpeakTextSafeInFlightTabRestorePending,
  queueSpeakTextSafePendingGestureRestore,
  readWebTtsGestureContextTelemetry,
  shouldYieldSpeakTextSafeInFlightToTabRestore,
} from '@features/aria/speakTextSafeWebGestureGate';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  consumeTtsBufferCompleteBeforePlaybackFlag,
  consumeTtsPlaybackStrategyForNextPlayback,
  prepareTtsPlaybackTelemetryState,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { prepareInterviewTtsPlayback } from '@features/aria/utils/audioModeHelpers';
import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';
import { gatherTtsPlaybackTelemetry } from '@utilities/sessionLogging/sessionAudioTelemetry';
import { getSessionLogRuntime, setTtsPlaybackActive } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export type SpeakTextSafeMainPlaybackPrep =
  | { status: 'gesture_queued' }
  | {
      status: 'ready';
      telemetrySource: TtsTelemetrySource;
      priorRec: boolean;
      ttsPlaybackActiveImmediatelyPrior: boolean;
      sessionRuntime: ReturnType<typeof getSessionLogRuntime>;
      onScenarioPlaybackStarted?: () => void;
      shouldYieldInFlightSpeakToTabRestore: () => boolean;
      ttsStart: number;
    };

export async function prepareSpeakTextSafeMainPlayback(args: {
  text: string;
  options: SpeakTextSafeOptions;
  userId: string;
  mobileWebTapToBeginDone: boolean;
  effectiveTtsTriggerSource: SpeakTextSafeTtsTriggerSource;
  speakGenerationAtStart: number;
  skipGestureGate: boolean;
  silent: boolean;
  interviewSpeechRole?: SpeakTextSafeOptions['interviewSpeechRole'];
  telemetrySourceOpt?: TtsTelemetrySource;
  skipInterviewSpeechAdvance: boolean;
  skipQuestionDeliveredTelemetry: boolean;
  skipLastQuestionRef: boolean;
  allowDuplicateConsecutiveTts: boolean;
  ttsQueuedPendingTabReturn: boolean;
  gestureRestoredAfterTabSwitchForThisPlayback: boolean;
  stopElevenLabsPlayback: () => Promise<void>;
  referenceCardShouldUpdateOnPlaybackStart: (rawText: string) => boolean;
  applyReferenceCardFromAssistantSpeechRef: MutableRefObject<(rawText: string) => void>;
  interviewStatusRef: MutableRefObject<string>;
  needsGestureRestoreRef: MutableRefObject<boolean>;
  pendingGestureRestoreSpeakRef: MutableRefObject<PendingGestureRestoreSpeakEntry | null>;
  setWebTabGestureRestoreOverlay: (visible: boolean) => void;
  webTtsTabInterruptPendingReplayRef: MutableRefObject<boolean>;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
  webTtsSpeakGenerationRef: MutableRefObject<number>;
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  webTtsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  tabVisibilityGestureLossPendingRef: MutableRefObject<boolean>;
  gestureContextLostAtRef: MutableRefObject<{
    atMs: number;
    reason: GestureContextLostReason;
  } | null>;
}): Promise<SpeakTextSafeMainPlaybackPrep> {
  if (
    Platform.OS === 'web' &&
    !args.skipGestureGate &&
    args.needsGestureRestoreRef.current &&
    args.interviewStatusRef.current === 'in_progress'
  ) {
    await queueSpeakTextSafePendingGestureRestore({
      text: args.text,
      options: args.options,
      prior: args.pendingGestureRestoreSpeakRef.current,
      pendingGestureRestoreSpeakRef: args.pendingGestureRestoreSpeakRef,
      setWebTabGestureRestoreOverlay: args.setWebTabGestureRestoreOverlay,
    });
    return { status: 'gesture_queued' };
  }

  const telemetrySource =
    args.telemetrySourceOpt ??
    (args.interviewSpeechRole === 'assistant_response' ? 'turn' : 'other');
  const onScenarioPlaybackStarted =
    args.interviewSpeechRole === 'assistant_response' &&
    !args.skipInterviewSpeechAdvance &&
    args.referenceCardShouldUpdateOnPlaybackStart(args.text)
      ? () => {
          args.applyReferenceCardFromAssistantSpeechRef.current(args.text);
        }
      : undefined;

  const sessionRuntime = getSessionLogRuntime();
  const ttsPlaybackActiveImmediatelyPrior = sessionRuntime.ttsPlaybackActive;
  await drainPriorTtsPlaybackBeforeSpeak({
    userId: args.userId,
    telemetrySource,
    stopElevenLabsPlayback: args.stopElevenLabsPlayback,
    ttsLineInFlightRef: args.ttsLineInFlightRef,
  });
  releaseRecordingSessionBeforeTts({ userId: args.userId, telemetrySource });
  const priorRec = consumePriorRecordingFlagsForTts({
    recordingJustFinishedBeforeNextTtsRef: args.recordingJustFinishedBeforeNextTtsRef,
    postRecordingParallelStreamSettleRef: args.postRecordingParallelStreamSettleRef,
  });
  await prepareInterviewTtsPlayback('speakTextSafe', { afterRecording: priorRec });

  const shouldYieldInFlightSpeakToTabRestore = () =>
    isSpeakTextSafeInFlightTabRestorePending({
      isWeb: Platform.OS === 'web',
      webTtsTabInterruptPendingReplay: args.webTtsTabInterruptPendingReplayRef.current,
      tabHiddenDuringActiveTtsLine: args.tabHiddenDuringActiveTtsLineRef.current,
      speakGenerationAtStart: args.speakGenerationAtStart,
      webTtsSpeakGeneration: args.webTtsSpeakGenerationRef.current,
    });

  if (
    shouldYieldSpeakTextSafeInFlightToTabRestore({
      isWeb: Platform.OS === 'web',
      telemetrySourceOpt: args.telemetrySourceOpt,
      skipGestureGate: args.skipGestureGate,
      webTtsTabInterruptPendingReplay: args.webTtsTabInterruptPendingReplayRef.current,
      tabHiddenDuringActiveTtsLine: args.tabHiddenDuringActiveTtsLineRef.current,
      speakGenerationAtStart: args.speakGenerationAtStart,
      webTtsSpeakGeneration: args.webTtsSpeakGenerationRef.current,
    })
  ) {
    await queueSpeakTextSafePendingGestureRestore({
      text: args.text,
      options: args.options,
      prior: args.pendingGestureRestoreSpeakRef.current,
      pendingGestureRestoreSpeakRef: args.pendingGestureRestoreSpeakRef,
      setWebTabGestureRestoreOverlay: args.setWebTabGestureRestoreOverlay,
      defaultRestoreMode: 'replay',
    });
    return { status: 'gesture_queued' };
  }

  if (Platform.OS === 'web') {
    if (!args.webTtsTabInterruptPendingReplayRef.current) {
      args.tabHiddenDuringActiveTtsLineRef.current = false;
    }
    if (!args.silent) {
      args.webTtsUtteranceInFlightRef.current = args.text;
      args.webTtsUtteranceInFlightOptionsRef.current = {
        interviewSpeechRole: args.interviewSpeechRole,
        telemetrySource: args.telemetrySourceOpt,
        skipInterviewSpeechAdvance: args.skipInterviewSpeechAdvance,
        skipQuestionDeliveredTelemetry: args.skipQuestionDeliveredTelemetry,
        skipLastQuestionRef: args.skipLastQuestionRef,
        allowDuplicateConsecutiveTts: args.allowDuplicateConsecutiveTts,
        silent: args.silent,
        skipGestureGate: args.skipGestureGate,
        ttsTriggerSource: args.effectiveTtsTriggerSource,
      };
    }
  }

  prepareTtsPlaybackTelemetryState({
    charCount: stripControlTokens(args.text).trim().length,
    telemetryIsGreeting: telemetrySource === 'greeting',
    isWeb: Platform.OS === 'web',
  });

  const ttsStart = Date.now();
  if (args.userId) {
    setTtsPlaybackActive(true);
    args.ttsLineInFlightRef.current = true;
    const { gestureContextActive, webTtsGestureErrorPrevented } = readWebTtsGestureContextTelemetry({
      isWeb: Platform.OS === 'web',
      mobileWebTapToBeginDone: args.mobileWebTapToBeginDone,
    });
    const gestureResolution = resolveSpeakTextSafeGestureContextLostResolution({
      isWeb: Platform.OS === 'web',
      gestureContextActive,
      effectiveTtsTriggerSource: args.effectiveTtsTriggerSource,
      gestureContextLostAt: args.gestureContextLostAtRef.current,
      tabVisibilityGestureLossPending: args.tabVisibilityGestureLossPendingRef.current,
    });
    if (gestureResolution.clearTabVisibilityGestureLossPending) {
      args.tabVisibilityGestureLossPendingRef.current = false;
    }
    if (gestureResolution.clearGestureContextLostAt) {
      args.gestureContextLostAtRef.current = null;
    }
    const gesture_context_lost_reason = gestureResolution.reason;
    writeSessionLog({
      userId: args.userId,
      attemptId: sessionRuntime.attemptId,
      eventType: 'tts_playback_start',
      eventData: {
        ...gatherTtsPlaybackTelemetry({ ttsPlaybackActiveImmediatelyPrior }),
        telemetry_source: telemetrySource,
        tts_buffer_complete_before_playback: consumeTtsBufferCompleteBeforePlaybackFlag(),
        playback_strategy: consumeTtsPlaybackStrategyForNextPlayback(),
        gesture_context_active: gestureContextActive,
        web_tts_gesture_error_prevented: webTtsGestureErrorPrevented,
        tts_trigger_source: args.effectiveTtsTriggerSource,
        ...(args.ttsQueuedPendingTabReturn ? { tts_queued_pending_tab_return: true } : {}),
        ...(args.gestureRestoredAfterTabSwitchForThisPlayback
          ? { gesture_restored_after_tab_switch: true }
          : {}),
        ...(gesture_context_lost_reason != null ? { gesture_context_lost_reason } : {}),
      },
      platform: sessionRuntime.platform,
    });
  }

  return {
    status: 'ready',
    telemetrySource,
    priorRec,
    ttsPlaybackActiveImmediatelyPrior,
    sessionRuntime,
    onScenarioPlaybackStarted,
    shouldYieldInFlightSpeakToTabRestore,
    ttsStart,
  };
}
