import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

jest.mock('@features/aria/utils/webInterviewPlaybackSurface', () => ({
  isWebInterviewPlaybackSurfaceActive: jest.fn(() => true),
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
}));

jest.mock('@utilities/sessionLogging/writeSessionLog', () => ({
  writeSessionLog: jest.fn(),
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';
import { INTERVIEW_NAME_AMBIENT_REASK_LINE } from '@features/aria/interviewNameValidation';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/scenarioAContemptProbeLogic';
import { TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO } from '@features/aria/interviewTtsExpectedDuration';
import {
  evaluateTtsDurationVerificationBypass,
  shouldAcceptStablePrematureRatioOnSecondAttempt,
  shouldUseWebTtsDurationVerification,
} from '@features/aria/speakTextSafeWebDurationRetry';
import { isWebInterviewPlaybackSurfaceActive } from '@features/aria/utils/webInterviewPlaybackSurface';

const playbackSurfaceActive = jest.mocked(isWebInterviewPlaybackSurfaceActive);

const preambleBriefing =
  'Good to meet you, Maya. The way this works is we will go through five parts together. Are you ready?';

describe('shouldUseWebTtsDurationVerification', () => {
  it('enables verification for normal web turn playback', () => {
    expect(
      shouldUseWebTtsDurationVerification({
        silent: false,
        charCount: 120,
        telemetrySource: 'turn',
      }),
    ).toBe(true);
  });

  it('skips greeting and replay telemetry sources', () => {
    expect(
      shouldUseWebTtsDurationVerification({
        silent: false,
        charCount: 120,
        telemetrySource: 'greeting',
      }),
    ).toBe(false);
    expect(
      shouldUseWebTtsDurationVerification({
        silent: false,
        charCount: 120,
        telemetrySource: 'replay',
      }),
    ).toBe(false);
  });
});

describe('evaluateTtsDurationVerificationBypass', () => {
  beforeEach(() => {
    playbackSurfaceActive.mockReturnValue(true);
  });

  it('bypasses moment 5 primary conflict prompts on the first attempt', () => {
    const text = buildMoment4ThresholdAnswerToMoment5Bundle('Sam', MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: true,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 5,
        currentScenario: 1,
        text,
        skipLastQuestionRef: false,
        ratioActualToExpected: 0.4,
        actualTtsMs: 4_000,
      }),
    ).toEqual({
      accept: true,
      acceptStableTruncation: true,
      reason: 'avoid_replaying_long_moment5_primary_prompt',
    });
  });

  it('bypasses scenario A contempt probe when playback was not likely silent', () => {
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: true,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 1,
        currentScenario: 1,
        text: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        skipLastQuestionRef: false,
        ratioActualToExpected: 0.5,
        actualTtsMs: 2_000,
      })?.reason,
    ).toBe('avoid_replaying_contempt_probe_on_duration_estimation_overshoot');
  });

  it('does not bypass contempt probe when playback was likely silent', () => {
    playbackSurfaceActive.mockReturnValue(false);
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: true,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 1,
        currentScenario: 1,
        text: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        skipLastQuestionRef: false,
        ratioActualToExpected: 0.5,
        actualTtsMs: 100,
      }),
    ).toBeNull();
  });

  it('accepts substantially complete replay playback without retrying', () => {
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: true,
        telemetrySource: 'replay',
        currentInterviewMoment: 2,
        currentScenario: 1,
        text: 'Can you walk me through that again?',
        skipLastQuestionRef: false,
        ratioActualToExpected: TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO,
        actualTtsMs: 3_000,
      }),
    ).toEqual({
      accept: true,
      acceptStableTruncation: true,
      reason: 'replay_substantially_complete',
    });
  });

  it('does not accept replay bypass when tab throttling suppresses premature', () => {
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: false,
        telemetrySource: 'replay',
        currentInterviewMoment: 2,
        currentScenario: 1,
        text: 'Can you walk me through that again?',
        skipLastQuestionRef: false,
        ratioActualToExpected: TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO,
        actualTtsMs: 3_000,
      }),
    ).toBeNull();
  });

  it('bypasses preamble briefing and recording retry lines on estimation overshoot', () => {
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: false,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 1,
        currentScenario: 1,
        text: preambleBriefing,
        skipLastQuestionRef: false,
        ratioActualToExpected: 0.5,
        actualTtsMs: 2_000,
      })?.reason,
    ).toBe('avoid_replaying_intro_briefing_on_duration_estimation_overshoot');

    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: false,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 1,
        currentScenario: 1,
        text: INTERVIEW_NAME_AMBIENT_REASK_LINE,
        skipLastQuestionRef: true,
        ratioActualToExpected: 0.5,
        actualTtsMs: 800,
      })?.reason,
    ).toBe('avoid_replaying_mic_retry_prompt_on_duration_estimation_overshoot');
  });
});

describe('shouldAcceptStablePrematureRatioOnSecondAttempt', () => {
  it('accepts a stable premature ratio on the second attempt', () => {
    expect(
      shouldAcceptStablePrematureRatioOnSecondAttempt({
        attemptIx: 1,
        ratioActualToExpected: 0.71,
        firstPrematureActualToExpectedRatio: 0.72,
      }),
    ).toBe(true);
  });

  it('rejects unstable ratios on the second attempt', () => {
    expect(
      shouldAcceptStablePrematureRatioOnSecondAttempt({
        attemptIx: 1,
        ratioActualToExpected: 0.71,
        firstPrematureActualToExpectedRatio: 0.5,
      }),
    ).toBe(false);
  });
});
