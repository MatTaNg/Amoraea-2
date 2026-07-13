import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/speakTextSafePreMainPlayback', () => ({
  drainPriorTtsPlaybackBeforeSpeak: jest.fn().mockResolvedValue(undefined),
  releaseRecordingSessionBeforeTts: jest.fn(),
  consumePriorRecordingFlagsForTts: jest.fn(() => false),
}));

jest.mock('@features/aria/utils/audioModeHelpers', () => ({
  prepareInterviewTtsPlayback: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@features/aria/telemetry/ttsBufferTelemetry', () => ({
  prepareTtsPlaybackTelemetryState: jest.fn(),
  consumeTtsBufferCompleteBeforePlaybackFlag: jest.fn(() => true),
  consumeTtsPlaybackStrategyForNextPlayback: jest.fn(() => 'buffered_complete'),
}));

jest.mock('@features/aria/speakTextSafeWebGestureGate', () => ({
  isSpeakTextSafeInFlightTabRestorePending: jest.fn(() => false),
  queueSpeakTextSafePendingGestureRestore: jest.fn().mockResolvedValue(undefined),
  readWebTtsGestureContextTelemetry: jest.fn(() => ({
    gestureContextActive: true,
    webTtsGestureErrorPrevented: false,
  })),
  shouldYieldSpeakTextSafeInFlightToTabRestore: jest.fn(() => false),
}));

jest.mock('@features/aria/speakTextSafeWebGestureTelemetry', () => ({
  resolveSpeakTextSafeGestureContextLostResolution: jest.fn(() => ({
    clearTabVisibilityGestureLossPending: false,
    clearGestureContextLostAt: false,
  })),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({
    attemptId: 'attempt-test',
    platform: 'web',
    ttsPlaybackActive: false,
  })),
  setTtsPlaybackActive: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/sessionAudioTelemetry', () => ({
  gatherTtsPlaybackTelemetry: jest.fn(() => ({ prior_playback_active: false })),
}));

import { prepareSpeakTextSafeMainPlayback } from '@features/aria/prepareSpeakTextSafeMainPlayback';
import { queueSpeakTextSafePendingGestureRestore } from '@features/aria/speakTextSafeWebGestureGate';
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

function baseArgs(
  overrides: Partial<Parameters<typeof prepareSpeakTextSafeMainPlayback>[0]> = {},
) {
  return {
    text: 'What is going on between these two?',
    options: {},
    userId: 'user-test',
    mobileWebTapToBeginDone: true,
    effectiveTtsTriggerSource: 'callback' as const,
    speakGenerationAtStart: 1,
    skipGestureGate: false,
    silent: false,
    interviewSpeechRole: 'assistant_response' as const,
    telemetrySourceOpt: 'turn' as const,
    skipInterviewSpeechAdvance: false,
    skipQuestionDeliveredTelemetry: false,
    skipLastQuestionRef: false,
    allowDuplicateConsecutiveTts: false,
    ttsQueuedPendingTabReturn: false,
    gestureRestoredAfterTabSwitchForThisPlayback: false,
    stopElevenLabsPlayback: jest.fn().mockResolvedValue(undefined),
    referenceCardShouldUpdateOnPlaybackStart: () => false,
    applyReferenceCardFromAssistantSpeechRef: { current: jest.fn() },
    interviewStatusRef: { current: 'in_progress' },
    needsGestureRestoreRef: { current: false },
    pendingGestureRestoreSpeakRef: { current: null },
    setWebTabGestureRestoreOverlay: jest.fn(),
    webTtsTabInterruptPendingReplayRef: { current: false },
    tabHiddenDuringActiveTtsLineRef: { current: false },
    webTtsSpeakGenerationRef: { current: 1 },
    recordingJustFinishedBeforeNextTtsRef: { current: false },
    postRecordingParallelStreamSettleRef: { current: false },
    ttsLineInFlightRef: { current: false },
    webTtsUtteranceInFlightRef: { current: null },
    webTtsUtteranceInFlightOptionsRef: { current: null },
    tabVisibilityGestureLossPendingRef: { current: false },
    gestureContextLostAtRef: { current: null },
    ...overrides,
  };
}

describe('prepareSpeakTextSafeMainPlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues gesture restore when interview still needs gesture reauth', async () => {
    const result = await prepareSpeakTextSafeMainPlayback(
      baseArgs({ needsGestureRestoreRef: { current: true } }),
    );

    expect(result).toEqual({ status: 'gesture_queued' });
    expect(queueSpeakTextSafePendingGestureRestore).toHaveBeenCalled();
  });

  it('returns ready context and logs tts_playback_start', async () => {
    const webTtsUtteranceInFlightRef = { current: null as string | null };

    const result = await prepareSpeakTextSafeMainPlayback(
      baseArgs({ webTtsUtteranceInFlightRef }),
    );

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error('expected ready prep');
    }
    expect(result.telemetrySource).toBe('turn');
    expect(result.priorRec).toBe(false);
    expect(webTtsUtteranceInFlightRef.current).toBe('What is going on between these two?');
    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'tts_playback_start' }),
    );
  });
});
