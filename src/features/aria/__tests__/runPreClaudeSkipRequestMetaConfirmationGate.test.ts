import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeSkipRequestMetaConfirmationGate } from '@features/aria/runPreClaudeSkipRequestMetaConfirmationGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: 'Can we skip this one?', scenarioNumber: 1 },
];

describe('runPreClaudeSkipRequestMetaConfirmationGate', () => {
  it('returns null outside the interview skip-injection route', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });

    const result = await runPreClaudeSkipRequestMetaConfirmationGate(
      deps,
      baseMessages,
      'Custom skip confirmation speech',
    );

    expect(result).toBeNull();
  });

  it('prompts with custom speech and records prior-answer context', async () => {
    const customSpeech = 'Just to confirm — do you want to skip this question?';
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
    });
    const messagesWithPriorAnswer = [
      ...baseMessages.slice(0, 1),
      {
        role: 'user',
        content:
          'They were being really dismissive about my feelings and would not listen when I tried to explain.',
        scenarioNumber: 1,
      },
      { role: 'user', content: 'Can we move on?', scenarioNumber: 1 },
      baseMessages[1],
    ];

    const result = await runPreClaudeSkipRequestMetaConfirmationGate(
      deps,
      messagesWithPriorAnswer,
      customSpeech,
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipOfferSourceRef.current).toBe('skip_request_meta');
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(true);
    expect(deps.frustrationSkipAwaitingConfirmationRef.current).toBe(true);
    expect(deps.frustrationSkipHadPriorAnswerRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      customSpeech,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: customSpeech,
          scenarioNumber: 1,
        }),
      ]),
    );
  });

  it('marks hadPriorAnswer false when the user has not answered substantively yet', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      speakTextSafe: jest.fn().mockResolvedValue(undefined),
    });

    await runPreClaudeSkipRequestMetaConfirmationGate(
      deps,
      baseMessages,
      'Skip this question?',
    );

    expect(deps.frustrationSkipHadPriorAnswerRef.current).toBe(false);
  });
});
