import { describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({
    attemptId: 'attempt-test',
    platform: 'web',
    recordingSessionActive: false,
  })),
  markLastAudioSessionEventType: jest.fn(),
  setTtsPlaybackActive: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/audioSessionLogEnvelope', () => ({
  writeAudioSessionLog: jest.fn(),
}));

import { finalizeSpeakTextSafeTtsSession } from '@features/aria/finalizeSpeakTextSafeTtsSession';
import {
  markLastAudioSessionEventType,
  setTtsPlaybackActive,
} from '@utilities/sessionLogging';
import { writeAudioSessionLog } from '@utilities/sessionLogging/audioSessionLogEnvelope';

describe('finalizeSpeakTextSafeTtsSession', () => {
  it('clears in-flight playback state and logs web deactivation telemetry', () => {
    const ttsLineInFlightRef = { current: true };
    const ttsUtteranceInFlightRef = { current: 'line' };
    const ttsUtteranceInFlightOptionsRef = { current: { silent: false } };
    const setLastTtsCompletionCallbackMs = jest.fn();

    finalizeSpeakTextSafeTtsSession({
      userId: 'user-test',
      isWeb: true,
      telemetrySource: 'turn',
      ttsLineInFlightRef,
      webTtsTabInterruptPendingReplay: false,
      ttsUtteranceInFlightRef,
      ttsUtteranceInFlightOptionsRef,
      setLastTtsCompletionCallbackMs,
    });

    expect(setTtsPlaybackActive).toHaveBeenCalledWith(false);
    expect(ttsLineInFlightRef.current).toBe(false);
    expect(ttsUtteranceInFlightRef.current).toBeNull();
    expect(setLastTtsCompletionCallbackMs).toHaveBeenCalled();
    expect(markLastAudioSessionEventType).toHaveBeenCalledWith('audio_session_deactivation_confirmed');
    expect(writeAudioSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'audio_session_deactivation_confirmed' }),
    );
  });

  it('clears stale playback state regardless of prior replay state', () => {
    const ttsUtteranceInFlightRef = { current: 'pending replay' };

    finalizeSpeakTextSafeTtsSession({
      userId: 'user-test',
      isWeb: true,
      telemetrySource: 'turn',
      ttsLineInFlightRef: { current: true },
      webTtsTabInterruptPendingReplay: true,
      ttsUtteranceInFlightRef,
      ttsUtteranceInFlightOptionsRef: { current: { silent: false } },
      setLastTtsCompletionCallbackMs: jest.fn(),
    });

    expect(ttsUtteranceInFlightRef.current).toBeNull();
  });
});
