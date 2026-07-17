import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@features/aria/applySpeakTextSafePreDelivery', () => ({
  applySpeakTextSafePreDelivery: jest.fn(),
}));

import { applySpeakTextSafePreDelivery } from '@features/aria/applySpeakTextSafePreDelivery';
import {
  resolveSpeakTextSafeOptions,
  runSpeakTextSafeEntry,
} from '@features/aria/runSpeakTextSafeEntry';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';

function makeDeps(overrides: Partial<SpeakTextSafeDeps> = {}): SpeakTextSafeDeps {
  return {
    userId: 'user-test',
    setVoiceState: jest.fn(),
    setTtsPlaybackReliabilityNotice: jest.fn(),
    setLastTtsCompletionCallbackMs: jest.fn(),
    speak: jest.fn(),
    applyInterviewSpeechComplete: jest.fn(),
    awaitTtsScreenReadyGate: jest.fn().mockResolvedValue(undefined),
    stopElevenLabsPlayback: jest.fn().mockResolvedValue(undefined),
    referenceCardShouldUpdateOnPlaybackStart: jest.fn(() => false),
    persistInterviewAttemptSessionLifecycle: jest.fn().mockResolvedValue(undefined),
    ttsSpeakGenerationRef: { current: 7 },
    currentInterviewMomentRef: { current: 1 },
    currentScenarioRef: { current: 1 },
    s2RepairProbeDeliveredRef: { current: false },
    s3RepairProbeDeliveredRef: { current: false },
    interviewNameRef: { current: 'Maya' },
    lastSuccessfulTtsTextNormalizedRef: { current: null },
    lastSuccessfulTtsDeliveredPreviewRef: { current: '' },
    interviewSessionAttemptIdRef: { current: 'attempt-1' },
    interviewSessionIdRef: { current: 'session-1' },
    scenarioAContemptProbePlaybackConfirmedRef: { current: false },
    scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
    lastQuestionTextRef: { current: '' },
    ttsLineInFlightRef: { current: false },
    interviewStatusRef: { current: 'in_progress' },
    applyReferenceCardFromAssistantSpeechRef: { current: jest.fn() },
    recordingJustFinishedBeforeNextTtsRef: { current: false },
    postRecordingParallelStreamSettleRef: { current: false },
    ttsUtteranceInFlightRef: { current: null },
    ttsUtteranceInFlightOptionsRef: { current: null },
    firstScenarioLifecyclePersistedRef: { current: false },
    ttsSessionHardFailureCountRef: { current: 0 },
    timingRef: { current: {} },
    recordInterviewAssistantDeliveryForMetaExemptionRef: { current: jest.fn() },
    s1ContemptFixVersion: 'test',
    ...overrides,
  } as SpeakTextSafeDeps;
}

describe('resolveSpeakTextSafeOptions', () => {
  it('fills defaults for omitted options', () => {
    expect(resolveSpeakTextSafeOptions()).toEqual({
      silent: false,
      interviewSpeechRole: undefined,
      telemetrySourceOpt: undefined,
      ttsPipeline: undefined,
      skipQuestionDeliveredTelemetry: false,
      skipInterviewSpeechAdvance: false,
      skipQuestionTiming: false,
      skipLastQuestionRef: false,
      allowDuplicateConsecutiveTts: false,
      skipClosingSessionDedup: false,
      skipScenarioAContemptProbeSessionDedup: false,
      skipPcmStream: false,
      prefetchedMpegArrayBuffer: undefined,
      skipGestureGate: false,
      ttsTriggerSource: 'callback',
      immediateWebPlaybackElement: undefined,
      greetingAlreadyAudible: false,
    });
  });
});

describe('runSpeakTextSafeEntry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(applySpeakTextSafePreDelivery).mockReturnValue({
      suppressed: false,
      text: 'Prepared line',
      textForAudio: 'Prepared line audio',
    });
  });

  it('awaits the screen-ready gate before pre-delivery', async () => {
    const deps = makeDeps();
    await runSpeakTextSafeEntry(deps, 'Hello', {});

    expect(deps.awaitTtsScreenReadyGate).toHaveBeenCalledWith('speak_text_safe');
    expect(applySpeakTextSafePreDelivery).toHaveBeenCalled();
  });

  it('returns suppressed when pre-delivery suppresses playback', async () => {
    jest.mocked(applySpeakTextSafePreDelivery).mockReturnValue({
      suppressed: true,
      reason: 'duplicate_consecutive',
    });

    const result = await runSpeakTextSafeEntry(makeDeps(), 'dup', {});

    expect(result).toEqual({ status: 'suppressed' });
  });

  it('returns ready for native playback without web gesture / HTML greeting paths', async () => {
    const deps = makeDeps();

    const result = await runSpeakTextSafeEntry(deps, 'Question?', {
      ttsTriggerSource: 'gesture_handler',
    });

    expect(result).toMatchObject({
      status: 'ready',
      text: 'Prepared line',
      textForAudio: 'Prepared line audio',
      effectiveTtsTriggerSource: 'gesture_handler',
      speakGenerationAtStart: 0,
      incomingAssistantTtsTextForS2Repair: 'Question?',
      closingTtsSessionKey: 'attempt-1',
      ttsQueuedPendingTabReturn: false,
      gestureRestoredAfterTabSwitchForThisPlayback: false,
    });
  });
});
