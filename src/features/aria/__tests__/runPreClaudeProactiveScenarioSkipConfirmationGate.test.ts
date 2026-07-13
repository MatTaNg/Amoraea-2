import { describe, expect, it, jest } from '@jest/globals';

import { SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/interviewPromptInstructions';
import { runPreClaudeProactiveScenarioSkipConfirmationGate } from '@features/aria/runPreClaudeProactiveScenarioSkipConfirmationGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
  writeSessionLog: jest.fn(),
}));

import { writeSessionLog } from '@utilities/sessionLogging';

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: "Let's skip this question", scenarioNumber: 1 },
];

describe('runPreClaudeProactiveScenarioSkipConfirmationGate', () => {
  it('returns null outside the interview skip-injection route', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });

    const result = await runPreClaudeProactiveScenarioSkipConfirmationGate(
      deps,
      "Let's skip this question",
      baseMessages,
    );

    expect(result).toBeNull();
  });

  it('prompts proactive skip confirmation and logs telemetry', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeProactiveScenarioSkipConfirmationGate(
      deps,
      "Let's skip this question",
      baseMessages,
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipOfferSourceRef.current).toBe('proactive_utterance');
    expect(deps.frustrationSkipAwaitingConfirmationRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(writeSessionLog).toHaveBeenCalledWith(
      expect.objectContaining({ eventType: 'proactive_skip_confirmation_prompted' }),
    );
    expect(setMessages).toHaveBeenCalled();
  });
});
