import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeTurnOpeningPipeline } from '@features/aria/runPreClaudeTurnOpeningPipeline';
import { fetchInterviewMetaCommentFromLlm } from '@features/aria/fetchInterviewMetaCommentFromLlm';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/fetchInterviewMetaCommentFromLlm', () => ({
  ...jest.requireActual<typeof import('@features/aria/fetchInterviewMetaCommentFromLlm')>(
    '@features/aria/fetchInterviewMetaCommentFromLlm',
  ),
  fetchInterviewMetaCommentFromLlm: jest.fn(),
}));

const mockedMetaCommentLlmFetch = jest.mocked(fetchInterviewMetaCommentFromLlm);

describe('runPreClaudeTurnOpeningPipeline', () => {
  beforeEach(() => {
    mockedMetaCommentLlmFetch.mockReset();
    mockedMetaCommentLlmFetch.mockResolvedValue(null);
  });

  it('returns continue:true with participant name and skip meta for a normal turn', async () => {
    const deps = createMockPreClaudeDeps({
      interviewNameRef: { current: 'Alex' },
      routeChangedDuringRecordingRef: { current: true },
      resumeRepeatChoicePendingRef: { current: false },
      isInterviewAppRoute: true,
      isAdmin: false,
      status: 'active',
    });

    const result = await runPreClaudeTurnOpeningPipeline(deps, {
      trimmed: 'I think Ryan should apologize first.',
      spokenText: 'I think Ryan should apologize first.',
      resumeGatePendingEarly: false,
    });

    expect(result).toEqual({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: expect.objectContaining({
        frustrationSkipAcceptancePipeline: expect.any(Boolean),
        frustrationSkipDeclinePipeline: expect.any(Boolean),
        metaCommentClassification: expect.anything(),
        skipRequestConfirmationSpeech: expect.any(String),
      }),
    });
    expect(deps.routeChangedDuringRecordingRef.current).toBe(false);
  });

  it('defers explicit repeat requests to meta verbatim replay while resume choice is pending', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      resumeRepeatChoicePendingRef: { current: true },
      resumeLastAssistantTextRef: { current: 'How would you repair this as Ryan?' },
      lastQuestionTextRef: { current: 'How would you repair this as Ryan?' },
      messages: [
        { role: 'assistant', content: 'How would you repair this as Ryan?', scenarioNumber: 1 },
      ],
      speakTextSafe,
    });

    const result = await runPreClaudeTurnOpeningPipeline(deps, {
      trimmed: 'Repeat what you said.',
      spokenText: 'Repeat what you said.',
      resumeGatePendingEarly: true,
    });

    expect(result).toMatchObject({ continue: true });
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(deps.resumeRepeatChoicePendingRef.current).toBe(false);
  });

  it('returns continue:false when resume repeat gate halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setVoiceState = jest.fn();
    const deps = createMockPreClaudeDeps({
      resumeRepeatChoicePendingRef: { current: true },
      resumeLastAssistantTextRef: { current: 'How would you repair this as Ryan?' },
      lastQuestionTextRef: { current: 'How would you repair this as Ryan?' },
      messages: [
        { role: 'assistant', content: 'How would you repair this as Ryan?', scenarioNumber: 1 },
      ],
      speakTextSafe,
      setVoiceState,
    });

    const result = await runPreClaudeTurnOpeningPipeline(deps, {
      trimmed: 'repeat that',
      spokenText: 'repeat that',
      resumeGatePendingEarly: false,
    });

    expect(result).toEqual({ continue: false });
    expect(speakTextSafe).toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('uses empty participant name when interview name ref is unset', async () => {
    const deps = createMockPreClaudeDeps({
      interviewNameRef: { current: null },
      resumeRepeatChoicePendingRef: { current: false },
    });

    const result = await runPreClaudeTurnOpeningPipeline(deps, {
      trimmed: 'okay',
      spokenText: 'okay',
      resumeGatePendingEarly: false,
    });

    expect(result).toMatchObject({
      continue: true,
      participantFirstNameForSpoken: '',
    });
  });
});
