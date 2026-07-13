import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/applySpeakTextSafePreDelivery', () => ({
  applySpeakTextSafePreDelivery: jest.fn(),
}));

jest.mock('@features/aria/runSpeakTextSafeImmediateWebGreeting', () => ({
  runSpeakTextSafeImmediateWebGreetingPlayback: jest.fn().mockResolvedValue(true),
}));

jest.mock('@features/aria/speakTextSafeWebGestureGate', () => ({
  refreshSpeakTextSafeWebGestureAfterLongProcessing: jest.fn().mockResolvedValue(false),
  runSpeakTextSafePreauthorizedTabGestureRestore: jest.fn().mockResolvedValue({
    ttsQueuedPendingTabReturn: true,
    gestureRestoredAfterTabSwitch: true,
  }),
}));

jest.mock('@features/aria/utils/webPreAuthorizedTtsAudio', () => ({
  isPreAuthorizedAudioPendingForNextTts: jest.fn(() => false),
}));

import { applySpeakTextSafePreDelivery } from '@features/aria/applySpeakTextSafePreDelivery';
import {
  resolveSpeakTextSafeOptions,
  runSpeakTextSafeEntry,
} from '@features/aria/runSpeakTextSafeEntry';
import { runSpeakTextSafeImmediateWebGreetingPlayback } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import {
  refreshSpeakTextSafeWebGestureAfterLongProcessing,
  runSpeakTextSafePreauthorizedTabGestureRestore,
} from '@features/aria/speakTextSafeWebGestureGate';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import { isPreAuthorizedAudioPendingForNextTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';

function makeDeps(overrides: Partial<SpeakTextSafeDeps> = {}): SpeakTextSafeDeps {
  return {
    userId: 'user-test',
    mobileWebTapToBeginDone: true,
    setVoiceState: jest.fn(),
    setWebTabGestureRestoreOverlay: jest.fn(),
    setWebDesktopPendingTtsGestureOverlay: jest.fn(),
    setTtsPlaybackReliabilityNotice: jest.fn(),
    setLastTtsCompletionCallbackMs: jest.fn(),
    speak: jest.fn(),
    applyInterviewSpeechComplete: jest.fn(),
    ensureWebGestureFlushListener: jest.fn(),
    awaitTtsScreenReadyGate: jest.fn().mockResolvedValue(undefined),
    stopElevenLabsPlayback: jest.fn().mockResolvedValue(undefined),
    webSpeechShouldDeferToUserGesture: jest.fn(() => false),
    rearmWebMicPreInitAfterTtsPlaybackComplete: jest.fn().mockResolvedValue(undefined),
    scheduleWebMicPreInitRefreshAfterTtsCompletes: jest.fn(),
    referenceCardShouldUpdateOnPlaybackStart: jest.fn(() => false),
    persistInterviewAttemptSessionLifecycle: jest.fn().mockResolvedValue(undefined),
    webTtsSpeakGenerationRef: { current: 7 },
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
    jest.mocked(isPreAuthorizedAudioPendingForNextTts).mockReturnValue(false);
    jest.mocked(refreshSpeakTextSafeWebGestureAfterLongProcessing).mockResolvedValue(false);
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
    expect(runSpeakTextSafeImmediateWebGreetingPlayback).not.toHaveBeenCalled();
  });

  it('handles immediate web greeting playback and short-circuits', async () => {
    const immediateWebPlaybackElement = {} as HTMLAudioElement;
    const deps = makeDeps();

    const result = await runSpeakTextSafeEntry(deps, 'Hi there', {
      immediateWebPlaybackElement,
    });

    expect(result).toEqual({ status: 'immediate_greeting_handled' });
    expect(runSpeakTextSafeImmediateWebGreetingPlayback).toHaveBeenCalledWith(
      deps,
      expect.objectContaining({
        userId: 'user-test',
        text: 'Prepared line',
        immediateWebPlaybackElement,
      }),
    );
  });

  it('falls through to main playback when immediate web greeting fails', async () => {
    jest.mocked(runSpeakTextSafeImmediateWebGreetingPlayback).mockResolvedValueOnce(false);
    const immediateWebPlaybackElement = {} as HTMLAudioElement;
    const deps = makeDeps();

    const result = await runSpeakTextSafeEntry(deps, 'Hi there', {
      immediateWebPlaybackElement,
    });

    expect(result.status).toBe('ready');
  });

  it('returns ready with tab-restore flags for preauthorized playback', async () => {
    jest.mocked(isPreAuthorizedAudioPendingForNextTts).mockReturnValue(true);
    const deps = makeDeps();

    const result = await runSpeakTextSafeEntry(deps, 'Question?', {});

    expect(result).toMatchObject({
      status: 'ready',
      text: 'Prepared line',
      textForAudio: 'Prepared line audio',
      effectiveTtsTriggerSource: 'preauthorized_element',
      speakGenerationAtStart: 7,
      incomingAssistantTtsTextForS2Repair: 'Question?',
      closingTtsSessionKey: 'attempt-1',
      ttsQueuedPendingTabReturn: true,
      gestureRestoredAfterTabSwitchForThisPlayback: true,
    });
    expect(runSpeakTextSafePreauthorizedTabGestureRestore).toHaveBeenCalled();
  });

  it('promotes trigger source after long-processing gesture refresh', async () => {
    jest.mocked(refreshSpeakTextSafeWebGestureAfterLongProcessing).mockResolvedValue(true);
    const deps = makeDeps();

    const result = await runSpeakTextSafeEntry(deps, 'Line', {
      ttsTriggerSource: 'callback',
    });

    expect(result).toMatchObject({
      status: 'ready',
      effectiveTtsTriggerSource: 'preauthorized_element',
    });
  });
});
