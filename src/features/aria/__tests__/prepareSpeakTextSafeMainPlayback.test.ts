import { beforeEach, describe, expect, it, jest } from '@jest/globals';

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

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({
    attemptId: 'attempt-test',
    platform: 'ios',
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
import { writeSessionLog } from '@utilities/sessionLogging/writeSessionLog';

function baseArgs(
  overrides: Partial<Parameters<typeof prepareSpeakTextSafeMainPlayback>[0]> = {},
) {
  return {
    text: 'What is going on between these two?',
    options: {},
    userId: 'user-test',
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
    ttsSpeakGenerationRef: { current: 1 },
    recordingJustFinishedBeforeNextTtsRef: { current: false },
    postRecordingParallelStreamSettleRef: { current: false },
    ttsLineInFlightRef: { current: false },
    ttsUtteranceInFlightRef: { current: null },
    ttsUtteranceInFlightOptionsRef: { current: null },
    ...overrides,
  };
}

describe('prepareSpeakTextSafeMainPlayback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not queue browser gesture restore on native (always ready)', async () => {
    const result = await prepareSpeakTextSafeMainPlayback(baseArgs());

    expect(result.status).toBe('ready');
  });

  it('returns ready context and logs tts_playback_start', async () => {
    const result = await prepareSpeakTextSafeMainPlayback(baseArgs());

    expect(result.status).toBe('ready');
    if (result.status !== 'ready') {
      throw new Error('expected ready prep');
    }
    expect(result.telemetrySource).toBe('turn');
    expect(result.priorRec).toBe(false);
    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'tts_playback_start' }),
    );
  });
});
