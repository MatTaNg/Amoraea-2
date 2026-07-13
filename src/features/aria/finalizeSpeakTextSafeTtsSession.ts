import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import type { WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { getSessionLogRuntime, markLastAudioSessionEventType, setTtsPlaybackActive } from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';

export function finalizeSpeakTextSafeTtsSession(args: {
  userId: string;
  isWeb: boolean;
  telemetrySource: TtsTelemetrySource;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  webTtsTabInterruptPendingReplay: boolean;
  tabHiddenDuringActiveTtsLineRef: MutableRefObject<boolean>;
  webTtsUtteranceInFlightRef: MutableRefObject<string | null>;
  webTtsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  setLastTtsCompletionCallbackMs: (ms: number) => void;
  webSpeechShouldDeferToUserGesture: () => boolean;
  scheduleWebMicPreInitRefreshAfterTtsCompletes: () => void;
  rearmWebMicPreInitAfterTtsPlaybackComplete: () => Promise<void>;
}): void {
  if (args.userId) {
    setTtsPlaybackActive(false);
    args.ttsLineInFlightRef.current = false;
  }

  if (args.isWeb) {
    if (!args.webTtsTabInterruptPendingReplay) {
      args.tabHiddenDuringActiveTtsLineRef.current = false;
    }
    if (!args.webTtsTabInterruptPendingReplay) {
      args.webTtsUtteranceInFlightRef.current = null;
      args.webTtsUtteranceInFlightOptionsRef.current = null;
    }
  }

  const ttsResolvedAt = Date.now();
  args.setLastTtsCompletionCallbackMs(ttsResolvedAt);

  if (!args.userId || !args.isWeb) {
    return;
  }

  const r = getSessionLogRuntime();
  markLastAudioSessionEventType('audio_session_deactivation_confirmed');
  writeAudioSessionLog({
    userId: args.userId,
    attemptId: r.attemptId,
    eventType: 'audio_session_deactivation_confirmed',
    eventData: {
      deactivation_succeeded: true,
      deactivation_timestamp: ttsResolvedAt,
      time_since_tts_completion_ms: 0,
      recording_session_active: r.recordingSessionActive,
    },
    platform: r.platform,
  });
  args.scheduleWebMicPreInitRefreshAfterTtsCompletes();
  if (args.telemetrySource === 'greeting' && args.webSpeechShouldDeferToUserGesture()) {
    void args.rearmWebMicPreInitAfterTtsPlaybackComplete();
  } else if (args.telemetrySource !== 'greeting' && !args.webSpeechShouldDeferToUserGesture()) {
    void args.rearmWebMicPreInitAfterTtsPlaybackComplete();
  }
}
