import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@utilities/withRetry', () => ({
  withRetry: jest.fn((fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@features/aria/speakTextSafePlaybackCompletionTelemetry', () => ({
  writeSpeakTextSafePlaybackCompletionTelemetry: jest.fn(() => ({
    audioPlaybackTruncated: false,
  })),
}));

jest.mock('@features/aria/applySpeakTextSafeQuestionDeliveredTelemetry', () => ({
  resolveSpeakTextSafeInterviewLineDelivery: jest.fn(() => ({
    skipDeliveryForTabInterrupt: false,
    isInterviewLine: true,
  })),
  applySpeakTextSafeQuestionDeliveredTelemetry: jest.fn(),
}));

jest.mock('@features/aria/applySpeakTextSafePostPlaybackSuccess', () => ({
  applySpeakTextSafePostPlaybackSuccess: jest.fn(),
}));

jest.mock('@features/aria/handleSpeakTextSafeTtsPlaybackError', () => ({
  handleSpeakTextSafeTtsPlaybackError: jest.fn(),
}));

jest.mock('@features/aria/finalizeSpeakTextSafeTtsSession', () => ({
  finalizeSpeakTextSafeTtsSession: jest.fn(),
}));

import { applySpeakTextSafePostPlaybackSuccess } from '@features/aria/applySpeakTextSafePostPlaybackSuccess';
import { applySpeakTextSafeQuestionDeliveredTelemetry } from '@features/aria/applySpeakTextSafeQuestionDeliveredTelemetry';
import { finalizeSpeakTextSafeTtsSession } from '@features/aria/finalizeSpeakTextSafeTtsSession';
import { handleSpeakTextSafeTtsPlaybackError } from '@features/aria/handleSpeakTextSafeTtsPlaybackError';
import {
  runSpeakTextSafeMainSpeakBody,
  type SpeakTextSafeMainSpeakBodyArgs,
} from '@features/aria/runSpeakTextSafeMainSpeakBody';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import { withRetry } from '@utilities/withRetry';

function makeDeps(): SpeakTextSafeDeps {
  return {
    userId: 'user-test',
    setVoiceState: jest.fn(),
    setTtsPlaybackReliabilityNotice: jest.fn(),
    setLastTtsCompletionCallbackMs: jest.fn(),
    speak: jest.fn().mockResolvedValue(undefined),
    applyInterviewSpeechComplete: jest.fn(),
    awaitTtsScreenReadyGate: jest.fn(),
    stopElevenLabsPlayback: jest.fn().mockResolvedValue(undefined),
    referenceCardShouldUpdateOnPlaybackStart: jest.fn(() => false),
    persistInterviewAttemptSessionLifecycle: jest.fn().mockResolvedValue(undefined),
    ttsSpeakGenerationRef: { current: 1 },
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
    ttsLineInFlightRef: { current: true },
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
  } as SpeakTextSafeDeps;
}

function baseArgs(overrides: Partial<SpeakTextSafeMainSpeakBodyArgs> = {}): SpeakTextSafeMainSpeakBodyArgs {
  return {
    deps: makeDeps(),
    text: 'What is going on between these two?',
    textForAudio: 'What is going on between these two?',
    resolved: {
      silent: false,
      interviewSpeechRole: 'assistant_response',
      telemetrySourceOpt: 'turn',
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
    },
    effectiveTtsTriggerSource: 'callback',
    speakGenerationAtStart: 1,
    incomingAssistantTtsTextForS2Repair: 'What is going on between these two?',
    closingTtsSessionKey: 'attempt-1',
    playbackPrep: {
      status: 'ready',
      telemetrySource: 'turn',
      priorRec: false,
      ttsPlaybackActiveImmediatelyPrior: false,
      sessionRuntime: { attemptId: 'attempt-1', platform: 'web', ttsPlaybackActive: false },
      shouldYieldInFlightSpeakToTabRestore: () => false,
      ttsStart: Date.now() - 50,
    },
    ...overrides,
  };
}

describe('runSpeakTextSafeMainSpeakBody', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('speaks via withRetry', async () => {
    const args = baseArgs();
    await runSpeakTextSafeMainSpeakBody(args);

    expect(withRetry).toHaveBeenCalled();
    expect(args.deps.speak).toHaveBeenCalledWith(
      args.textForAudio,
      expect.objectContaining({ telemetrySource: 'turn', ttsTriggerSource: 'callback' }),
    );
    expect(applySpeakTextSafePostPlaybackSuccess).toHaveBeenCalled();
    expect(applySpeakTextSafeQuestionDeliveredTelemetry).toHaveBeenCalled();
    expect(finalizeSpeakTextSafeTtsSession).toHaveBeenCalled();
  });

  it('routes playback errors through the shared handler and still finalizes', async () => {
    const args = baseArgs();
    const err = new Error('gesture required');
    jest.mocked(args.deps.speak).mockRejectedValueOnce(err);

    await runSpeakTextSafeMainSpeakBody(args);

    expect(handleSpeakTextSafeTtsPlaybackError).toHaveBeenCalledWith(
      expect.objectContaining({ err, text: args.text }),
    );
    expect(applySpeakTextSafePostPlaybackSuccess).not.toHaveBeenCalled();
    expect(finalizeSpeakTextSafeTtsSession).toHaveBeenCalled();
  });
});
