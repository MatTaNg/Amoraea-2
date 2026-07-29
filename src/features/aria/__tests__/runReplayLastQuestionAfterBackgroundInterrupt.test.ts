import { runReplayLastQuestionAfterBackgroundInterrupt } from '@features/aria/runReplayLastQuestionAfterBackgroundInterrupt';
import type { InterviewMicLifecycleDeps } from '@features/aria/hooks/interviewMicLifecycleTypes';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import {
  acquireResumeWelcomePlaybackLock,
  isResumeWelcomePlaybackLocked,
  releaseResumeWelcomePlaybackLock,
} from '@features/aria/interviewLocalPersistence';
import {
  clearResumeDeferredUserSpeech,
  peekResumeDeferredUserSpeech,
  queueResumeDeferredUserSpeech,
} from '@features/aria/resumeDeferredUserSpeech';
import { buildResumeWelcomeMessage } from '@utilities/interviewResumeCursor';

jest.mock('@features/aria/interviewLocalPersistence', () => {
  const actual = jest.requireActual<typeof import('@features/aria/interviewLocalPersistence')>(
    '@features/aria/interviewLocalPersistence',
  );
  return {
    ...actual,
    wasResumeWelcomeSpoken: jest.fn(async () => false),
    markResumeWelcomeSpoken: jest.fn(async () => undefined),
  };
});

jest.mock('@features/aria/utils/audioModeHelpers', () => ({
  markNativePlaybackBridgeBeforeNextTts: jest.fn(),
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

function baseDeps(overrides: Partial<InterviewMicLifecycleDeps> = {}): InterviewMicLifecycleDeps {
  return {
    navigation: { addListener: () => () => {} },
    userId: 'user-1',
    userIdRef: { current: 'user-1' },
    voiceState: 'idle',
    interviewStatus: 'in_progress',
    interviewStatusRef: { current: 'in_progress' },
    resumeLoadingFlowActiveRef: { current: false },
    audioRecorder: {
      isRecording: false,
      reinitializeMicrophoneSession: jest.fn(async () => true),
      stopRecording: jest.fn(),
      releaseRecordingInstance: jest.fn(async () => undefined),
    },
    applyRouteProbeAfterResume: jest.fn(async () => undefined),
    setMicSessionRecovering: jest.fn(),
    setMicNeedsReconnect: jest.fn(),
    setLateStartIdleCueVisible: jest.fn(),
    setPreInitMeterLevel: jest.fn(),
    setVoiceState: jest.fn(),
    setEmotionModalVisible: jest.fn(),
    parallelStreamingTtsRef: { current: { cancelRequested: false } },
    ttsSpeakGenerationRef: { current: 0 },
    interviewSessionAttemptIdRef: { current: 'attempt-1' },
    interviewSessionIdRef: { current: 'session-1' },
    currentInterviewMomentRef: { current: 1 },
    currentScenarioRef: { current: 1 },
    lastQuestionTextRef: { current: 'What happened next?' },
    resumeLastAssistantTextRef: { current: 'What happened next?' },
    resumeWelcomeMessageRef: { current: 'Welcome back. Let us continue.' },
    currentMessagesRef: { current: [] },
    interviewNameRef: { current: 'Matt' },
    resumeInPersonalPartRef: { current: false },
    emotionModalPendingTransitionRef: { current: false },
    resumeOfferWelcomeTtsRef: { current: false },
    resumeRepeatChoicePendingRef: { current: false },
    processUserSpeech: jest.fn(async () => undefined),
    speakTextSafe: jest.fn(async () => undefined),
    interruptAllInterviewTtsOutput: jest.fn(),
    stopElevenLabsPlayback: jest.fn(async () => undefined),
    hasInterviewClosingSpeakInFlightForSession: () => false,
    classifyInterviewQuestionType: () => 'unknown',
    ...overrides,
  };
}

describe('runReplayLastQuestionAfterBackgroundInterrupt', () => {
  beforeEach(() => {
    clearResumeDeferredUserSpeech();
    releaseResumeWelcomePlaybackLock('attempt-1');
  });

  it('replays resume welcome when interrupted during resume welcome TTS', async () => {
    const speakTextSafe = jest.fn(async () => undefined);
    const expectedWelcome = buildResumeWelcomeMessage({
      mode: 'replay_incomplete',
      resumeScenario: 1,
      lastQuestionText: 'What happened next?',
    });
    const deps = baseDeps({
      resumeOfferWelcomeTtsRef: { current: true },
      speakTextSafe,
    });

    await runReplayLastQuestionAfterBackgroundInterrupt(deps, 'tts');

    expect(speakTextSafe).toHaveBeenCalledWith(
      expectedWelcome,
      expect.objectContaining({ telemetrySource: 'greeting' }),
    );
    expect(deps.resumeOfferWelcomeTtsRef.current).toBe(false);
    expect(deps.resumeWelcomeMessageRef.current).toBe(expectedWelcome);
  });

  it('replays welcome and last question when interrupted during recording', async () => {
    const speakTextSafe = jest.fn(async () => undefined);
    const expectedWelcome = buildResumeWelcomeMessage({
      mode: 'replay_incomplete',
      resumeScenario: 1,
      lastQuestionText: 'What happened next?',
    });
    const deps = baseDeps({ speakTextSafe });

    await runReplayLastQuestionAfterBackgroundInterrupt(deps, 'recording');

    expect(speakTextSafe).toHaveBeenCalledWith(
      expectedWelcome,
      expect.objectContaining({ telemetrySource: 'greeting' }),
    );
    if (!/\bi just (?:said|asked you)\b/i.test(expectedWelcome)) {
      expect(speakTextSafe).toHaveBeenCalledWith(
        'What happened next?',
        expect.objectContaining({ telemetrySource: 'replay' }),
      );
    }
  });

  it('replays last question only for regular TTS interrupt', async () => {
    const speakTextSafe = jest.fn(async () => undefined);
    const deps = baseDeps({ speakTextSafe });

    await runReplayLastQuestionAfterBackgroundInterrupt(deps, 'tts');

    expect(speakTextSafe).toHaveBeenCalledWith(
      'What happened next?',
      expect.objectContaining({ telemetrySource: 'replay' }),
    );
  });

  it('rebuilds welcome with S2 repair prompt when cached welcome still embeds James-differently', async () => {
    const speakTextSafe = jest.fn(async () => undefined);
    const staleWelcome = buildResumeWelcomeMessage({
      mode: 'replay_incomplete',
      resumeScenario: 2,
      lastQuestionText: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
    });
    const expectedWelcome = buildResumeWelcomeMessage({
      mode: 'replay_incomplete',
      resumeScenario: 2,
      lastQuestionText: SCENARIO_B_JAMES_REPAIR_CANONICAL,
    });
    const deps = baseDeps({
      speakTextSafe,
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      resumeLastAssistantTextRef: { current: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
      resumeWelcomeMessageRef: { current: staleWelcome },
      currentMessagesRef: {
        current: [
          {
            role: 'assistant',
            content: `I'm with you. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`,
            scenarioNumber: 2,
          },
        ],
      },
    });

    await runReplayLastQuestionAfterBackgroundInterrupt(deps, 'recording');

    expect(speakTextSafe).toHaveBeenCalledWith(
      expectedWelcome,
      expect.objectContaining({ telemetrySource: 'greeting' }),
    );
    expect(speakTextSafe).not.toHaveBeenCalledWith(
      expect.stringMatching(/differently/i),
      expect.objectContaining({ telemetrySource: 'greeting' }),
    );
    expect(deps.resumeWelcomeMessageRef.current).toBe(expectedWelcome);
    expect(deps.resumeLastAssistantTextRef.current).toBe(SCENARIO_B_JAMES_REPAIR_CANONICAL);
  });

  it('releases stale resume playback lock and flushes deferred user speech after foreground replay', async () => {
    acquireResumeWelcomePlaybackLock('attempt-1');
    queueResumeDeferredUserSpeech(
      "I would ask Sarah how she'd like to be celebrated and celebrate her in that way and commit to it.",
    );
    const processUserSpeech = jest.fn(async () => undefined);
    const deps = baseDeps({
      processUserSpeech,
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: SCENARIO_B_JAMES_REPAIR_CANONICAL },
    });

    await runReplayLastQuestionAfterBackgroundInterrupt(deps, 'recording');

    expect(isResumeWelcomePlaybackLocked('attempt-1')).toBe(false);
    expect(processUserSpeech).toHaveBeenCalledWith(
      "I would ask Sarah how she'd like to be celebrated and celebrate her in that way and commit to it.",
    );
    expect(peekResumeDeferredUserSpeech()).toBeNull();
  });
});
