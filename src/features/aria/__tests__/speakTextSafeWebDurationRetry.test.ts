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

/** Keep this unit suite off Expo/Supabase graphs pulled by probe helpers. */
jest.mock('@features/aria/moment5TranscriptHelpers', () => ({
  transcriptAssistantContainsMoment5PrimaryConflictQuestion: (text: string) =>
    /biggest conflict|accountability|primary conflict/i.test(text),
}));

jest.mock('@features/aria/interviewLanguageGate', () => ({
  isInterviewPreambleBriefingMoment: (text: string) =>
    /five parts together/i.test(text) && /are you ready/i.test(text),
}));

jest.mock('@features/aria/interviewNameValidation', () => ({
  isInterviewRecordingRetryLine: (text: string) =>
    /didn't catch that|try again|speak a bit louder/i.test(text),
  INTERVIEW_NAME_AMBIENT_REASK_LINE:
    "I didn't catch that — could you try again and speak a bit louder?",
}));

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

const moment4CommitmentThreshold =
  'Thanks for sharing that. At what point do you decide when a relationship is something to work through versus something you need to walk away from?';

const scenarioAContemptProbe =
  "What about when Emma says 'you've made that very clear' — what do you make of that?";

const moment5PrimaryConflictPrompt =
  'Thanks for that. Thinking about accountability — what was the biggest conflict you were part of recently?';

const recordingRetryLine =
  "I didn't catch that — could you try again and speak a bit louder?";

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
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: true,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 5,
        currentScenario: 1,
        text: moment5PrimaryConflictPrompt,
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

  it('bypasses Moment 4 commitment threshold so duration overshoot cannot replay 3x', () => {
    expect(
      evaluateTtsDurationVerificationBypass({
        attemptIx: 0,
        wouldBePremature: true,
        premature: true,
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
        currentInterviewMoment: 4,
        currentScenario: 3,
        text: moment4CommitmentThreshold,
        skipLastQuestionRef: false,
        ratioActualToExpected: 0.58,
        actualTtsMs: 9_000,
      }),
    ).toEqual({
      accept: true,
      acceptStableTruncation: true,
      reason: 'avoid_replaying_moment4_commitment_threshold',
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
        text: scenarioAContemptProbe,
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
        text: scenarioAContemptProbe,
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
        text: recordingRetryLine,
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

  it('accepts near-stable ~0.55–0.58 ratios that used to restart mobile M4 TTS thrice', () => {
    expect(
      shouldAcceptStablePrematureRatioOnSecondAttempt({
        attemptIx: 1,
        ratioActualToExpected: 0.555,
        firstPrematureActualToExpectedRatio: 0.58,
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
