import { describe, expect, it, jest } from '@jest/globals';

import { SKIP_CONFIRMATION_GREETING_REOPEN_LINE } from '@features/aria/metaCommentClassification';
import { runPreClaudeSkipConfirmationGreetingReconnectGate } from '@features/aria/runPreClaudeSkipConfirmationGreetingReconnectGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const baseMessages = [
  { role: 'assistant', content: 'Do you still want to skip?', scenarioNumber: 1 },
  { role: 'user', content: 'hi', scenarioNumber: 1 },
];

describe('runPreClaudeSkipConfirmationGreetingReconnectGate', () => {
  it('returns null outside the interview skip-injection route', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });

    const result = await runPreClaudeSkipConfirmationGreetingReconnectGate(deps, baseMessages);

    expect(result).toBeNull();
  });

  it('reopens skip confirmation after a greeting during skip confirmation', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({ speakTextSafe, setMessages });

    const result = await runPreClaudeSkipConfirmationGreetingReconnectGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      SKIP_CONFIRMATION_GREETING_REOPEN_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(setMessages).toHaveBeenCalled();
  });
});
