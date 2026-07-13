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

  it('allows duplicate consecutive TTS when explicitly opted in', () => {
    const text = 'Can you say that again?';
    const args = baseArgs({
      text,
      allowDuplicateConsecutiveTts: true,
      lastSuccessfulTtsTextNormalized: normalizeTtsTextForConsecutiveDedup(text),
    });

    const result = applySpeakTextSafePreDelivery(args);

    expect(result.suppressed).toBe(false);
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
});
