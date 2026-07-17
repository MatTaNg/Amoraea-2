import type { MutableRefObject } from 'react';

import type { WebTtsUtteranceReplayOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { getSessionLogRuntime, markLastAudioSessionEventType, setTtsPlaybackActive } from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';

export function finalizeSpeakTextSafeTtsSession(args: {
  userId: string;
  isWeb: boolean;
  telemetrySource: TtsTelemetrySource;
  ttsLineInFlightRef: MutableRefObject<boolean>;
  ttsUtteranceInFlightRef: MutableRefObject<string | null>;
  ttsUtteranceInFlightOptionsRef: MutableRefObject<WebTtsUtteranceReplayOptions | null>;
  setLastTtsCompletionCallbackMs: (ms: number) => void;
}): void {
  if (args.userId) {
    setTtsPlaybackActive(false);
    if (args.ttsLineInFlightRef) {
      args.ttsLineInFlightRef.current = false;
    }
  }

  if (args.ttsUtteranceInFlightRef) {
    args.ttsUtteranceInFlightRef.current = null;
  }
  if (args.ttsUtteranceInFlightOptionsRef) {
    args.ttsUtteranceInFlightOptionsRef.current = null;
  }

  const ttsResolvedAt = Date.now();
  args.setLastTtsCompletionCallbackMs?.(ttsResolvedAt);

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
}
