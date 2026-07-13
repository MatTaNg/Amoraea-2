import type { MutableRefObject } from 'react';
import { Platform } from 'react-native';

import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import {
  isWebInterviewPlaybackAudiblyActive,
  isWebInterviewPlaybackSurfaceActive,
} from '@features/aria/utils/webInterviewPlaybackSurface';
import {
  getSessionLogRuntime,
  setRecordingSessionActive,
  setTtsPlaybackActive,
} from '@utilities/sessionLogging';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

export async function drainPriorTtsPlaybackBeforeSpeak(args: {
  userId: string;
  telemetrySource: TtsTelemetrySource;
  stopElevenLabsPlayback: () => Promise<void>;
  ttsLineInFlightRef: MutableRefObject<boolean>;
}): Promise<void> {
  const rt0 = getSessionLogRuntime();
  const ttsPlaybackActiveImmediatelyPrior = rt0.ttsPlaybackActive;
  const webPriorPlaybackStillActive = () =>
    Platform.OS === 'web' &&
    (isWebInterviewPlaybackSurfaceActive() || isWebInterviewPlaybackAudiblyActive());

  if (!ttsPlaybackActiveImmediatelyPrior && !webPriorPlaybackStillActive()) {
    return;
  }

  const waitStartMs = Date.now();
  const deadline = waitStartMs + 8000;
  while (
    Date.now() < deadline &&
    (getSessionLogRuntime().ttsPlaybackActive || webPriorPlaybackStillActive())
  ) {
    await new Promise<void>((res) => setTimeout(res, 80));
  }

  const waitedMs = Date.now() - waitStartMs;
  const priorStillActive =
    getSessionLogRuntime().ttsPlaybackActive || webPriorPlaybackStillActive();

  if (priorStillActive) {
    if (args.userId) {
      writeSessionLog({
        userId: args.userId,
        attemptId: rt0.attemptId,
        eventType: 'tts_playback_prior_turn_still_active',
        eventData: {
          telemetry_source: args.telemetrySource,
          waited_ms: waitedMs,
          playback_surface_still_active: isWebInterviewPlaybackSurfaceActive(),
          playback_audibly_still_active: isWebInterviewPlaybackAudiblyActive(),
        },
        platform: rt0.platform,
      });
    }
    await args.stopElevenLabsPlayback();
    args.ttsLineInFlightRef.current = false;
    setTtsPlaybackActive(false);
  } else if (getSessionLogRuntime().ttsPlaybackActive) {
    setTtsPlaybackActive(false);
  }
}

export function releaseRecordingSessionBeforeTts(args: {
  userId: string;
  telemetrySource: TtsTelemetrySource;
}): void {
  if (!getSessionLogRuntime().recordingSessionActive) {
    return;
  }
  if (args.userId) {
    const rt0 = getSessionLogRuntime();
    writeSessionLog({
      userId: args.userId,
      attemptId: rt0.attemptId,
      eventType: 'recording_session_not_released_before_tts',
      eventData: { telemetry_source: args.telemetrySource },
      platform: rt0.platform,
    });
  }
  setRecordingSessionActive(false);
}

export function consumePriorRecordingFlagsForTts(args: {
  recordingJustFinishedBeforeNextTtsRef: MutableRefObject<boolean>;
  postRecordingParallelStreamSettleRef: MutableRefObject<boolean>;
}): boolean {
  const priorRec =
    args.recordingJustFinishedBeforeNextTtsRef.current ||
    args.postRecordingParallelStreamSettleRef.current;
  args.recordingJustFinishedBeforeNextTtsRef.current = false;
  return priorRec;
}
