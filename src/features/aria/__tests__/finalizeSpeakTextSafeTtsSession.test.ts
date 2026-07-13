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
    const tabHiddenDuringActiveTtsLineRef = { current: true };
    const webTtsUtteranceInFlightRef = { current: 'line' };
    const webTtsUtteranceInFlightOptionsRef = { current: { silent: false } };
    const setLastTtsCompletionCallbackMs = jest.fn();
    const scheduleWebMicPreInitRefreshAfterTtsCompletes = jest.fn();
    const rearmWebMicPreInitAfterTtsPlaybackComplete = jest.fn().mockResolvedValue(undefined);

    finalizeSpeakTextSafeTtsSession({
      userId: 'user-test',
      isWeb: true,
      telemetrySource: 'turn',
      ttsLineInFlightRef,
      webTtsTabInterruptPendingReplay: false,
      tabHiddenDuringActiveTtsLineRef,
      webTtsUtteranceInFlightRef,
      webTtsUtteranceInFlightOptionsRef,
      setLastTtsCompletionCallbackMs,
      webSpeechShouldDeferToUserGesture: () => false,
      scheduleWebMicPreInitRefreshAfterTtsCompletes,
      rearmWebMicPreInitAfterTtsPlaybackComplete,
    });

    expect(setTtsPlaybackActive).toHaveBeenCalledWith(false);
    expect(ttsLineInFlightRef.current).toBe(false);
    expect(tabHiddenDuringActiveTtsLineRef.current).toBe(false);
    expect(webTtsUtteranceInFlightRef.current).toBeNull();
    expect(setLastTtsCompletionCallbackMs).toHaveBeenCalled();
    expect(markLastAudioSessionEventType).toHaveBeenCalledWith('audio_session_deactivation_confirmed');
    expect(writeAudioSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'audio_session_deactivation_confirmed' }),
    );
    expect(scheduleWebMicPreInitRefreshAfterTtsCompletes).toHaveBeenCalled();
    expect(rearmWebMicPreInitAfterTtsPlaybackComplete).toHaveBeenCalled();
  });

  it('preserves tab-interrupt replay refs while a replay is still pending', () => {
    const tabHiddenDuringActiveTtsLineRef = { current: true };
    const webTtsUtteranceInFlightRef = { current: 'pending replay' };

    finalizeSpeakTextSafeTtsSession({
      userId: 'user-test',
      isWeb: true,
      telemetrySource: 'turn',
      ttsLineInFlightRef: { current: true },
      webTtsTabInterruptPendingReplay: true,
      tabHiddenDuringActiveTtsLineRef,
      webTtsUtteranceInFlightRef,
      webTtsUtteranceInFlightOptionsRef: { current: { silent: false } },
      setLastTtsCompletionCallbackMs: jest.fn(),
      webSpeechShouldDeferToUserGesture: () => false,
      scheduleWebMicPreInitRefreshAfterTtsCompletes: jest.fn(),
      rearmWebMicPreInitAfterTtsPlaybackComplete: jest.fn(),
    });

    expect(tabHiddenDuringActiveTtsLineRef.current).toBe(true);
    expect(webTtsUtteranceInFlightRef.current).toBe('pending replay');
  });
});
