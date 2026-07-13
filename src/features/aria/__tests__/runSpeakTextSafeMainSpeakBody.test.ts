import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/speakTextSafeWebDurationRetry', () => ({
  shouldUseWebTtsDurationVerification: jest.fn(() => false),
}));

jest.mock('@features/aria/runSpeakTextSafeWebDurationVerificationLoop', () => ({
  runSpeakTextSafeWebDurationVerificationLoop: jest.fn(),
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
import { runSpeakTextSafeWebDurationVerificationLoop } from '@features/aria/runSpeakTextSafeWebDurationVerificationLoop';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import { shouldUseWebTtsDurationVerification } from '@features/aria/speakTextSafeWebDurationRetry';
import { withRetry } from '@utilities/withRetry';

function makeDeps(): SpeakTextSafeDeps {
  return {
    userId: 'user-test',
    mobileWebTapToBeginDone: true,
    setVoiceState: jest.fn(),
    setWebTabGestureRestoreOverlay: jest.fn(),
    setWebDesktopPendingTtsGestureOverlay: jest.fn(),
    setTtsPlaybackReliabilityNotice: jest.fn(),
    setLastTtsCompletionCallbackMs: jest.fn(),
    speak: jest.fn().mockResolvedValue(undefined),
    applyInterviewSpeechComplete: jest.fn(),
    ensureWebGestureFlushListener: jest.fn(),
    awaitTtsScreenReadyGate: jest.fn(),
    stopElevenLabsPlayback: jest.fn().mockResolvedValue(undefined),
    webSpeechShouldDeferToUserGesture: jest.fn(() => false),
    rearmWebMicPreInitAfterTtsPlaybackComplete: jest.fn().mockResolvedValue(undefined),
    scheduleWebMicPreInitRefreshAfterTtsCompletes: jest.fn(),
    referenceCardShouldUpdateOnPlaybackStart: jest.fn(() => false),
    persistInterviewAttemptSessionLifecycle: jest.fn().mockResolvedValue(undefined),
    webTtsSpeakGenerationRef: { current: 1 },
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
    needsGestureRestoreRef: { current: false },
    tabVisibilityGestureLossPendingRef: { current: false },
    gestureContextLostAtRef: { current: null },
    webTtsTabInterruptPendingReplayRef: { current: false },
    pendingGestureRestoreSpeakRef: { current: null },
    interviewStatusRef: { current: 'in_progress' },
    applyReferenceCardFromAssistantSpeechRef: { current: jest.fn() },
    recordingJustFinishedBeforeNextTtsRef: { current: false },
    postRecordingParallelStreamSettleRef: { current: false },
    tabHiddenDuringActiveTtsLineRef: { current: false },
    webTtsUtteranceInFlightRef: { current: null },
    webTtsUtteranceInFlightOptionsRef: { current: null },
    firstScenarioLifecyclePersistedRef: { current: false },
    ttsSessionHardFailureCountRef: { current: 0 },
    timingRef: { current: {} },
    pendingWebSpeechForGestureRef: { current: null },
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
    jest.mocked(shouldUseWebTtsDurationVerification).mockReturnValue(false);
  });

  it('speaks via withRetry when web duration verification is disabled', async () => {
    const args = baseArgs();
    await runSpeakTextSafeMainSpeakBody(args);

    expect(withRetry).toHaveBeenCalled();
    expect(args.deps.speak).toHaveBeenCalledWith(
      args.textForAudio,
      expect.objectContaining({ telemetrySource: 'turn', ttsTriggerSource: 'callback' }),
    );
    expect(runSpeakTextSafeWebDurationVerificationLoop).not.toHaveBeenCalled();
    expect(applySpeakTextSafePostPlaybackSuccess).toHaveBeenCalled();
    expect(applySpeakTextSafeQuestionDeliveredTelemetry).toHaveBeenCalled();
    expect(finalizeSpeakTextSafeTtsSession).toHaveBeenCalled();
  });

  it('uses the web duration verification loop when enabled', async () => {
    jest.mocked(shouldUseWebTtsDurationVerification).mockReturnValue(true);
    jest.mocked(runSpeakTextSafeWebDurationVerificationLoop).mockResolvedValue({
      speakOutcome: undefined,
      actualTtsMs: 1200,
      verificationOk: true,
      acceptedStableTruncationAsEstimationError: false,
    });

    await runSpeakTextSafeMainSpeakBody(baseArgs());

    expect(runSpeakTextSafeWebDurationVerificationLoop).toHaveBeenCalled();
    expect(withRetry).not.toHaveBeenCalled();
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
