import { renderHook, act } from '@testing-library/react-native';
import { InteractionManager } from 'react-native';

import { useAriaInterviewSession } from '../useAriaInterviewSession';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-1', platform: 'web' })),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/sessionAudioTelemetry', () => ({
  gatherRecordingStartTelemetry: jest.fn(() => ({ source: 'test' })),
}));

jest.mock('@features/aria/interviewScenarioScoringSlice', () => ({
  tagInterviewTranscriptMessages: jest.fn((msgs) => msgs),
}));

describe('useAriaInterviewSession', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(InteractionManager, 'runAfterInteractions').mockImplementation((task) => {
      task();
      return { cancel: jest.fn() };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('starts in intro with empty transcript and idle voice state', () => {
    const { result } = renderHook(() => useAriaInterviewSession('user-1'));
    expect(result.current.messages).toEqual([]);
    expect(result.current.status).toBe('intro');
    expect(result.current.voiceState).toBe('idle');
  });

  it('tags scenarioNumber when committing transcript updates', () => {
    const { result } = renderHook(() => useAriaInterviewSession('user-1'));
    act(() => {
      result.current.setMessages([
        { role: 'assistant', content: 'Emma and Ryan had a fight.', scenarioNumber: 1 },
        { role: 'user', content: 'Ryan should listen more.' },
      ]);
    });
    expect(result.current.messages.length).toBe(2);
    expect(result.current.currentMessagesRef.current).toBe(result.current.messages);
    expect(result.current.messages.some((m) => m.scenarioNumber != null)).toBe(true);
  });

  it('awaitTtsScreenReadyGate resolves when screen ready ref is set', async () => {
    const { result } = renderHook(() => useAriaInterviewSession('user-1'));
    act(() => {
      result.current.ttsScreenReadyRef.current = true;
    });
    await act(async () => {
      await result.current.awaitTtsScreenReadyGate('test');
    });
    expect(result.current.ttsScreenReadyRef.current).toBe(true);
  });

  it('marks recording restart telemetry once after VAD bypass', () => {
    const { result } = renderHook(() => useAriaInterviewSession('user-1'));
    act(() => {
      result.current.pendingRecordingRestartAfterVadBypassRef.current = true;
    });
    const first = result.current.takeRecordingStartEventDataWithVadBypassRestart();
    const second = result.current.takeRecordingStartEventDataWithVadBypassRestart();
    expect(first).toMatchObject({ recording_restarted_after_vad_bypass: true });
    expect(second).not.toHaveProperty('recording_restarted_after_vad_bypass');
  });

  it('defaults web tap-to-begin done on native and mic permission to prompt', () => {
    const { result } = renderHook(() => useAriaInterviewSession('user-1'));
    expect(result.current.micPermission).toBe('prompt');
    expect(result.current.micError).toBe(null);
    expect(result.current.exchangeCount).toBe(0);
  });

  it('keeps web Whisper disabled for native apps', () => {
    const { result } = renderHook(() =>
      useAriaInterviewSession('user-1', { whisperProxyUrl: 'https://example.com/whisper' }),
    );
    expect(result.current.useWhisperOnWeb).toBe(false);
    expect(result.current.useTapMicUi).toBe(true);
  });
});
