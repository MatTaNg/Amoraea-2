import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
  markQuestionDelivered: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

jest.mock('@utilities/sessionLogging/audioSessionLogEnvelope', () => ({
  writeAudioSessionLog: jest.fn(),
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

jest.mock('@features/aria/utils/webTtsGestureErrors', () => ({
  WebInterviewTtsTabHiddenAbortError: class WebInterviewTtsTabHiddenAbortError extends Error {},
}));

jest.mock('@features/aria/utils/interviewTtsDurationMatch', () => ({
  isTtsPlaybackPrematureCutoff: jest.fn(),
}));

import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import { runSpeakTextSafeWebDurationVerificationLoop } from '@features/aria/runSpeakTextSafeWebDurationVerificationLoop';
import { isTtsPlaybackPrematureCutoff } from '@features/aria/utils/interviewTtsDurationMatch';

const prematureCutoff = jest.mocked(isTtsPlaybackPrematureCutoff);

function baseArgs(
  overrides: Partial<Parameters<typeof runSpeakTextSafeWebDurationVerificationLoop>[0]> = {},
) {
  const speak = jest.fn().mockResolvedValue(undefined);
  const stopElevenLabsPlayback = jest.fn().mockResolvedValue(undefined);
  const setTtsPlaybackReliabilityNotice = jest.fn();
  const s2RepairProbeDeliveredRef = { current: false };
  const s3RepairProbeDeliveredRef = { current: false };
  const ttsSessionHardFailureCountRef = { current: 0 };
  const timingRef = {
    current: {
      questionEndTime: null as number | null,
      recordingStartTime: null as number | null,
      recordingEndTime: null as number | null,
    },
  };

  return {
    speak,
    textForAudio: 'audio text',
    text: 'What is happening between them?',
    charCount: 80,
    telemetrySource: 'turn' as const,
    interviewSpeechRole: 'assistant_response' as const,
    skipLastQuestionRef: false,
    skipPcmStream: false,
    effectiveTtsTriggerSource: 'gesture_handler' as const,
    priorRec: false,
    userId: 'user-test',
    interviewSessionId: 'session-test',
    stopElevenLabsPlayback,
    shouldYieldInFlightSpeakToTabRestore: () => false,
    tabHiddenDuringActiveTtsLine: false,
    currentInterviewMoment: 2,
    currentScenario: 1 as const,
    s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef,
    ttsSessionHardFailureCountRef,
    setTtsPlaybackReliabilityNotice,
    skipQuestionTiming: true,
    timingRef,
    ...overrides,
  };
}

describe('runSpeakTextSafeWebDurationVerificationLoop', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prematureCutoff.mockReturnValue(false);
  });

  it('accepts the first speak attempt when playback is not premature', async () => {
    const args = baseArgs();
    const result = await runSpeakTextSafeWebDurationVerificationLoop(args);

    expect(args.speak).toHaveBeenCalledTimes(1);
    expect(result.verificationOk).toBe(true);
    expect(result.acceptedStableTruncationAsEstimationError).toBe(false);
    expect(args.setTtsPlaybackReliabilityNotice).toHaveBeenCalledWith(null);
    expect(args.ttsSessionHardFailureCountRef.current).toBe(0);
  });

  it('bypasses retry for moment 5 primary conflict prompts on estimation overshoot', async () => {
    const text = buildMoment4ThresholdAnswerToMoment5Bundle('Sam', MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    prematureCutoff.mockReturnValue(true);
    const args = baseArgs({
      text,
      textForAudio: text,
      charCount: text.length,
      currentInterviewMoment: 5,
    });

    const result = await runSpeakTextSafeWebDurationVerificationLoop(args);

    expect(args.speak).toHaveBeenCalledTimes(1);
    expect(result.verificationOk).toBe(true);
    expect(result.acceptedStableTruncationAsEstimationError).toBe(true);
    expect(args.stopElevenLabsPlayback).not.toHaveBeenCalled();
  });

  it('surfaces a reliability notice after repeated hard verification failures', async () => {
    jest.useFakeTimers();
    prematureCutoff.mockReturnValue(true);
    const durationsMs = [400, 800, 400];
    let speakCall = 0;
    const args = baseArgs({
      text: 'Short generic turn line.',
      charCount: 24,
      ttsSessionHardFailureCountRef: { current: 2 },
      speak: jest.fn().mockImplementation(async () => {
        const delay = durationsMs[speakCall++] ?? 500;
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }),
    });

    const resultPromise = runSpeakTextSafeWebDurationVerificationLoop(args);
    await jest.runAllTimersAsync();
    const result = await resultPromise;
    jest.useRealTimers();

    expect(result.verificationOk).toBe(false);
    expect(args.speak).toHaveBeenCalledTimes(3);
    expect(args.ttsSessionHardFailureCountRef.current).toBe(3);
    expect(args.setTtsPlaybackReliabilityNotice).toHaveBeenCalledWith(
      'Playback keeps stopping early. Try a wired connection or reload this page.',
    );
  });
});
