import { describe, expect, it, jest } from '@jest/globals';

import { GO_BACK_REQUEST_DECLINE_LINE } from '@features/aria/interviewPromptInstructions';
import { runPreClaudeGoBackRequestInjectGate } from '@features/aria/runPreClaudeGoBackRequestInjectGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const baseMessages = [
  { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
  { role: 'user', content: 'Can we go back to the first scenario?', scenarioNumber: 2 },
];

describe('runPreClaudeGoBackRequestInjectGate', () => {
  it('returns null outside the interview inject route', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });
    const result = await runPreClaudeGoBackRequestInjectGate(
      deps,
      'Can we go back?',
      baseMessages,
    );
    expect(result).toBeNull();
  });

  it('returns null for non-go-back utterances', async () => {
    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeGoBackRequestInjectGate(
      deps,
      'Sarah seems upset',
      baseMessages,
    );
    expect(result).toBeNull();
  });

  it('speaks the fixed decline line and halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeGoBackRequestInjectGate(
      deps,
      'I want to go back to the previous scenario',
      baseMessages,
    );

    expect(result).toEqual({ haltTurn: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      GO_BACK_REQUEST_DECLINE_LINE,
      expect.objectContaining({
        allowDuplicateConsecutiveTts: true,
        skipLastQuestionRef: true,
      }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: GO_BACK_REQUEST_DECLINE_LINE,
        }),
      ]),
    );
  });
});
