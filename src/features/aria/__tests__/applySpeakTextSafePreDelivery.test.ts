import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { applySpeakTextSafePreDelivery } from '@features/aria/applySpeakTextSafePreDelivery';
import { normalizeTtsTextForConsecutiveDedup } from '@features/aria/interviewControlTokens';
import {
  markInterviewClosingTtsDelivered,
  resetInterviewClosingTtsSession,
  shouldSuppressDuplicateInterviewClosingTts,
} from '@features/aria/interviewClosingTtsSession';

jest.mock('@features/aria/interviewNameValidation', () => ({
  resolvePlausibleInterviewFirstName: (name: string | null) => name,
}));

jest.mock('@/constants/interviewCharacterNames', () => ({
  sanitizeAssistantInterviewerCharacterNames: (text: string) => text,
}));

jest.mock('@features/aria/interviewerFrameworkPrompt', () => ({
  dedupeAdjacentBoundaryValidationsBeforeParticipantName: (text: string) => text,
}));

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
  writeSessionLog: jest.fn(),
}));

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

function baseArgs(
  overrides: Partial<Parameters<typeof applySpeakTextSafePreDelivery>[0]> = {},
) {
  const setVoiceState = jest.fn();
  return {
    text: 'What is going on between these two?',
    silent: false,
    interviewSpeechRole: 'assistant_response' as const,
    allowDuplicateConsecutiveTts: false,
    skipClosingSessionDedup: false,
    skipScenarioAContemptProbeSessionDedup: false,
    userId: 'user-test',
    interviewName: 'Maya',
    currentInterviewMoment: 1,
    currentScenario: 1 as const,
    s2RepairProbeDelivered: false,
    lastSuccessfulTtsTextNormalized: null,
    lastSuccessfulTtsDeliveredPreview: '',
    lastQuestionText: '',
    closingTtsSessionKey: 'session-test',
    interviewSessionId: 'session-test',
    scenarioAContemptProbePlaybackConfirmed: false,
    setVoiceState,
    ...overrides,
  };
}

describe('applySpeakTextSafePreDelivery', () => {
  const closing =
    'Thanks for working through all of this with me — that shows real care. Thank you for being so open with me.';

  beforeEach(() => {
    jest.clearAllMocks();
    resetInterviewClosingTtsSession();
  });

  it('passes through assistant text when no dedup guards fire', () => {
    const args = baseArgs();
    const result = applySpeakTextSafePreDelivery(args);

    expect(result).toEqual({
      suppressed: false,
      text: args.text,
      textForAudio: args.text,
    });
    expect(args.setVoiceState).not.toHaveBeenCalled();
  });

  it('suppresses duplicate consecutive TTS for the same normalized copy', () => {
    const text = 'Can you say that again?';
    const args = baseArgs({
      text,
      lastSuccessfulTtsTextNormalized: normalizeTtsTextForConsecutiveDedup(text),
      lastSuccessfulTtsDeliveredPreview: 'Can you say that again?',
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result).toEqual({ suppressed: true, reason: 'duplicate_consecutive' });
    expect(args.setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('preserves Sure. before Scenario A contempt probe after canonical coerce', () => {
    const {
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    } = require('@features/aria/scenarioAContemptProbeTtsStrip') as {
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY: string;
    };
    const args = baseArgs({
      text: `Sure. ${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}`,
      allowDuplicateConsecutiveTts: true,
      currentInterviewMoment: 1,
      currentScenario: 1,
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result.suppressed).toBe(false);
    if (result.suppressed) return;
    expect(result.text).toMatch(/^Sure\.\s/);
    expect(result.text).toContain(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
    expect(result.textForAudio).toMatch(/^Sure\.\s/);
  });

  it('preserves Sure. before Scenario A repair after canonical coerce', () => {
    const repair = 'If you were Ryan, how would you repair this?';
    const args = baseArgs({
      text: `Sure. ${repair}`,
      allowDuplicateConsecutiveTts: true,
      currentInterviewMoment: 1,
      currentScenario: 1,
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result.suppressed).toBe(false);
    if (result.suppressed) return;
    expect(result.text).toMatch(/^Sure\.\s/);
    expect(result.text.toLowerCase()).toMatch(/if you were ryan/);
  });

  it('does not suppress Scenario A repair re-ask after the canonical first repair question was spoken', () => {
    const firstRepair = 'If you were Ryan, how would you repair this?';
    const reAsk =
      'Got it. How would you make that repair actually happen — what would you say to Emma?';
    const args = baseArgs({
      text: reAsk,
      lastSuccessfulTtsTextNormalized: normalizeTtsTextForConsecutiveDedup(firstRepair),
      lastSuccessfulTtsDeliveredPreview: firstRepair,
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result).toEqual({
      suppressed: false,
      text: reAsk,
      textForAudio: reAsk,
    });
  });

  it('suppresses duplicate closing-session TTS', () => {
    markInterviewClosingTtsDelivered('session-closing', closing);
    const args = baseArgs({
      text: closing,
      closingTtsSessionKey: 'session-closing',
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result).toEqual({ suppressed: true, reason: 'duplicate_closing_session' });
    expect(shouldSuppressDuplicateInterviewClosingTts('session-closing', closing)).toBe(true);
  });

  it('does not suppress resume welcome-back TTS that quotes the Scenario A contempt probe', () => {
    const {
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    } = require('@features/aria/scenarioAContemptProbeTtsStrip') as {
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY: string;
    };
    const welcomeBack = `Welcome back, we'll pick up where we left off, we were in Scenario one and I just said ${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}.`;
    const args = baseArgs({
      text: welcomeBack,
      interviewSpeechRole: undefined,
      telemetrySourceOpt: 'greeting',
      scenarioAContemptProbePlaybackConfirmed: true,
      skipScenarioAContemptProbeSessionDedup: true,
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result).toEqual({
      suppressed: false,
      text: welcomeBack,
      textForAudio: welcomeBack,
    });
  });

  it('does not suppress resume welcome-back via session dedup guard even without explicit skip flag', () => {
    const {
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    } = require('@features/aria/scenarioAContemptProbeTtsStrip') as {
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY: string;
    };
    const welcomeBack = `Welcome back, we'll pick up where we left off, we were in Scenario one and I just said ${SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY}.`;
    const args = baseArgs({
      text: welcomeBack,
      interviewSpeechRole: undefined,
      telemetrySourceOpt: 'greeting',
      scenarioAContemptProbePlaybackConfirmed: true,
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result.suppressed).toBe(false);
  });

  it('does not rewrite S3→M4 handoff into Sophie vignette when Situation 3 already played', () => {
    const m4 =
      "Good work — you just finished the three situations. There are only two questions left. Now I want to ask you about something a bit more personal.\n\nThink of someone you've had a really hard time with — maybe a falling out, a grudge, or just someone who got under your skin.";
    const args = baseArgs({
      text: m4,
      currentInterviewMoment: 3,
      currentScenario: 3,
      situation3CanonicalPlaybackConfirmed: true,
      s3RepairProbeDelivered: true,
      lastQuestionText: 'So what would the repair look like for Daniel?',
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result.suppressed).toBe(false);
    if (!result.suppressed) {
      expect(result.text).toMatch(/finished the three situations/i);
      expect(result.text).toMatch(/really hard time with/i);
      expect(result.text).not.toMatch(/That's the second one done/i);
      expect(result.text).not.toMatch(/Sophie and Daniel have had the same argument/i);
    }
  });
});
