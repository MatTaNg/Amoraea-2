import type { MutableRefObject } from 'react';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import type { SpeakTextSafeOptions, WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import type { SpeakTextSafeTtsTriggerSource } from '@features/aria/speakTextSafeSuccessfulDelivery';
import {
  consumePriorRecordingFlagsForTts,
  drainPriorTtsPlaybackBeforeSpeak,
  releaseRecordingSessionBeforeTts,
} from '@features/aria/speakTextSafePreMainPlayback';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  consumeTtsBufferCompleteBeforePlaybackFlag,
  consumeTtsPlaybackStrategyForNextPlayback,
  prepareTtsPlaybackTelemetryState,
} from '@features/aria/telemetry/ttsBufferTelemetry';
import { prepareInterviewTtsPlayback } from '@features/aria/utils/audioModeHelpers';
import { gatherTtsPlaybackTelemetry } from '@utilities/sessionLogging/sessionAudioTelemetry';
import { getSessionLogRuntime, setTtsPlaybackActive } from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export type SpeakTextSafeMainPlaybackPrep = {
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
  ttsSpeakGenerationRef: MutableRefObject<number>;
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  ttsUtteranceInFlightRef: MutableRefObject<string | null>;
  ttsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
}): Promise<SpeakTextSafeMainPlaybackPrep> {
  const telemetrySource =
    args.telemetrySourceOpt ??
    (args.interviewSpeechRole === 'assistant_response' ? 'turn' : 'other');
  const onScenarioPlaybackStarted =
    args.interviewSpeechRole === 'assistant_response' &&
    !args.skipInterviewSpeechAdvance &&
    args.referenceCardShouldUpdateOnPlaybackStart(args.text)
      ? () => {
          args.applyReferenceCardFromAssistantSpeechRef?.current?.(args.text);
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

  const shouldYieldInFlightSpeakToTabRestore = () => false;

  prepareTtsPlaybackTelemetryState({
    charCount: stripControlTokens(args.text).trim().length,
    telemetryIsGreeting: telemetrySource === 'greeting',
    isWeb: false,
  });

  const ttsStart = Date.now();
  if (args.userId) {
    setTtsPlaybackActive(true);
    args.ttsLineInFlightRef.current = true;
    writeSessionLog({
      userId: args.userId,
      attemptId: sessionRuntime.attemptId,
      eventType: 'tts_playback_start',
      eventData: {
        ...gatherTtsPlaybackTelemetry({ ttsPlaybackActiveImmediatelyPrior }),
        telemetry_source: telemetrySource,
        tts_buffer_complete_before_playback: consumeTtsBufferCompleteBeforePlaybackFlag(),
        playback_strategy: consumeTtsPlaybackStrategyForNextPlayback(),
        gesture_context_active: null,
        web_tts_gesture_error_prevented: null,
        tts_trigger_source: args.effectiveTtsTriggerSource,
        ...(args.ttsQueuedPendingTabReturn ? { tts_queued_pending_tab_return: true } : {}),
        ...(args.gestureRestoredAfterTabSwitchForThisPlayback
          ? { gesture_restored_after_tab_switch: true }
          : {}),
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
