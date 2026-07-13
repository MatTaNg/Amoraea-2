import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import {
  consumePriorRecordingFlagsForTts,
  drainPriorTtsPlaybackBeforeSpeak,
  releaseRecordingSessionBeforeTts,
} from '@features/aria/speakTextSafePreMainPlayback';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackAudiblyActive: jest.fn(() => false),
  isWebInterviewPlaybackSurfaceActive: jest.fn(() => false),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(),
  setRecordingSessionActive: jest.fn(),
  setTtsPlaybackActive: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

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

const getRuntime = jest.mocked(getSessionLogRuntime);
const surfaceActive = jest.mocked(isWebInterviewPlaybackSurfaceActive);
const audiblyActive = jest.mocked(isWebInterviewPlaybackAudiblyActive);

describe('consumePriorRecordingFlagsForTts', () => {
  it('returns and clears prior recording flags', () => {
    const recordingJustFinishedBeforeNextTtsRef = { current: true };
    const postRecordingParallelStreamSettleRef = { current: false };

    expect(
      consumePriorRecordingFlagsForTts({
        recordingJustFinishedBeforeNextTtsRef,
        postRecordingParallelStreamSettleRef,
      }),
    ).toBe(true);
    expect(recordingJustFinishedBeforeNextTtsRef.current).toBe(false);
    expect(postRecordingParallelStreamSettleRef.current).toBe(false);
  });
});

describe('releaseRecordingSessionBeforeTts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getRuntime.mockReturnValue({
      attemptId: 'attempt-test',
      platform: 'web',
      recordingSessionActive: true,
      ttsPlaybackActive: false,
    } as ReturnType<typeof getSessionLogRuntime>);
  });

  it('logs and clears a stale recording session before TTS', () => {
    releaseRecordingSessionBeforeTts({ userId: 'user-test', telemetrySource: 'turn' });

    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'recording_session_not_released_before_tts',
      }),
    );
    expect(setRecordingSessionActive).toHaveBeenCalledWith(false);
  });

  it('no-ops when recording session is already inactive', () => {
    getRuntime.mockReturnValue({
      attemptId: 'attempt-test',
      platform: 'web',
      recordingSessionActive: false,
      ttsPlaybackActive: false,
    } as ReturnType<typeof getSessionLogRuntime>);

    releaseRecordingSessionBeforeTts({ userId: 'user-test', telemetrySource: 'turn' });

    expect(writeSessionLog).not.toHaveBeenCalled();
    expect(setRecordingSessionActive).not.toHaveBeenCalled();
  });
});

describe('drainPriorTtsPlaybackBeforeSpeak', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    getRuntime.mockReturnValue({
      attemptId: 'attempt-test',
      platform: 'web',
      recordingSessionActive: false,
      ttsPlaybackActive: false,
    } as ReturnType<typeof getSessionLogRuntime>);
    surfaceActive.mockReturnValue(false);
    audiblyActive.mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('no-ops when no prior playback is active', async () => {
    const stopElevenLabsPlayback = jest.fn().mockResolvedValue(undefined);
    const ttsLineInFlightRef = { current: true };

    await drainPriorTtsPlaybackBeforeSpeak({
      userId: 'user-test',
      telemetrySource: 'turn',
      stopElevenLabsPlayback,
      ttsLineInFlightRef,
    });

    expect(stopElevenLabsPlayback).not.toHaveBeenCalled();
    expect(setTtsPlaybackActive).not.toHaveBeenCalled();
  });

  it('forces stop when prior playback is still active after the wait window', async () => {
    getRuntime.mockReturnValue({
      attemptId: 'attempt-test',
      platform: 'web',
      recordingSessionActive: false,
      ttsPlaybackActive: true,
    } as ReturnType<typeof getSessionLogRuntime>);
    surfaceActive.mockReturnValue(true);

    const stopElevenLabsPlayback = jest.fn().mockResolvedValue(undefined);
    const ttsLineInFlightRef = { current: true };

    const drainPromise = drainPriorTtsPlaybackBeforeSpeak({
      userId: 'user-test',
      telemetrySource: 'turn',
      stopElevenLabsPlayback,
      ttsLineInFlightRef,
    });

    await jest.runAllTimersAsync();
    await drainPromise;

    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'tts_playback_prior_turn_still_active',
      }),
    );
    expect(stopElevenLabsPlayback).toHaveBeenCalled();
    expect(ttsLineInFlightRef.current).toBe(false);
    expect(setTtsPlaybackActive).toHaveBeenCalledWith(false);
  });
});
