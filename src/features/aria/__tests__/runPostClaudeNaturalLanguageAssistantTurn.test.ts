import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeNaturalLanguageAssistantTurn } from '@features/aria/runPostClaudeNaturalLanguageAssistantTurn';
import type { PostClaudeNaturalLanguageTurnContext } from '@features/aria/runPostClaudeNaturalLanguageAssistantTurn';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
} from './postClaudeGateTestHelpers';

const baseCtx = (
  overrides: Partial<PostClaudeNaturalLanguageTurnContext> = {},
): PostClaudeNaturalLanguageTurnContext => ({
  strippedText: 'Thanks Alex, that makes sense.',
  recentAsstForAck: [],
  shouldInjectScenarioARepairAfterContemptAnswer: false,
  assistantIssuedScenarioAContemptProbe: false,
  assistantIssuedScenarioBFullProbe: false,
  needsScenarioBJamesDifferentlyInsert: false,
  assistantTurnIsElongatingProbeOnly: false,
  parallelStreamingPlaybackUsed: false,
  streamFullTrimmed: '',
  rawApiHadInterviewComplete: false,
  ...overrides,
});

describe('runPostClaudeNaturalLanguageAssistantTurn', () => {
  it('marks closing question state when [CLOSING_QUESTION:N] appears in raw text', async () => {
    const markClosingQuestionAsked = jest.fn();
    const setClosingQuestionPending = jest.fn();
    const setClosingQuestionScenario = jest.fn();
    const deps = createMockPostClaudeDeps({
      markClosingQuestionAsked,
      setClosingQuestionPending,
      setClosingQuestionScenario,
      currentMessagesRef: { current: [] },
    });
    const params = createMockPostClaudeParams({ messagesToUse: [] });
    const speak = createMockSpeakAssistantTurn();

    await runPostClaudeNaturalLanguageAssistantTurn(
      deps,
      params,
      baseCtx(),
      'Before we wrap up. [CLOSING_QUESTION:2] How did that land for you?',
      speak,
    );

    expect(markClosingQuestionAsked).toHaveBeenCalledWith(2);
    expect(setClosingQuestionPending).toHaveBeenCalledWith(true);
    expect(setClosingQuestionScenario).toHaveBeenCalledWith(2);
  });

  it('commits assistant turn and speaks display text on a normal turn', async () => {
    const commitInterviewMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      commitInterviewMessages,
      currentMessagesRef: { current: [{ role: 'user', content: 'I sided with Emma.' }] },
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [{ role: 'user', content: 'I sided with Emma.' }],
    });
    const speak = createMockSpeakAssistantTurn();

    await runPostClaudeNaturalLanguageAssistantTurn(
      deps,
      params,
      baseCtx({ strippedText: 'Thanks Alex, that makes sense.' }),
      'Thanks Alex, that makes sense.',
      speak,
    );

    expect(commitInterviewMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'assistant', content: expect.stringMatching(/makes sense/i) }),
      ]),
    );
    expect(speak).toHaveBeenCalledWith(
      expect.stringMatching(/makes sense/i),
      expect.any(Object),
    );
  });

  it('returns early without speaking when empty transcript fallback handles the turn', async () => {
    const commitInterviewMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      commitInterviewMessages,
      currentMessagesRef: { current: [] },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: false,
      messagesToUse: [],
    });
    const speak = createMockSpeakAssistantTurn();

    await runPostClaudeNaturalLanguageAssistantTurn(
      deps,
      params,
      baseCtx({ strippedText: '', assistantTurnIsElongatingProbeOnly: false }),
      '   ',
      speak,
    );

    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(commitInterviewMessages).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });
});
