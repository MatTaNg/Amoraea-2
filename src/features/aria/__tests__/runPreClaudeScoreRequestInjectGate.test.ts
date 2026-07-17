import { describe, expect, it, jest } from '@jest/globals';

import { SCORE_REQUEST_DECLINE_LINE } from '@features/aria/interviewPromptInstructions';
import { runPreClaudeScoreRequestInjectGate } from '@features/aria/runPreClaudeScoreRequestInjectGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: "What's my score?", scenarioNumber: 1 },
];

describe('runPreClaudeScoreRequestInjectGate', () => {
  it('returns null outside the interview inject route', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });
    const result = await runPreClaudeScoreRequestInjectGate(deps, "What's my score?", baseMessages);
    expect(result).toBeNull();
  });

  it('returns null for non-score utterances', async () => {
    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeScoreRequestInjectGate(
      deps,
      'Emma seems annoyed',
      baseMessages,
    );
    expect(result).toBeNull();
  });

  it('speaks the fixed decline line and halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeScoreRequestInjectGate(
      deps,
      'Am I passing so far?',
      baseMessages,
    );

    expect(result).toEqual({ haltTurn: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      SCORE_REQUEST_DECLINE_LINE,
      expect.objectContaining({
        allowDuplicateConsecutiveTts: true,
        skipLastQuestionRef: true,
      }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: SCORE_REQUEST_DECLINE_LINE,
        }),
      ]),
    );
  });
});
