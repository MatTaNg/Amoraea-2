import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudePostClosingCompletionGate } from '@features/aria/runPreClaudePostClosingCompletionGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

jest.mock('@utilities/interviewAttemptLifecycle', () => ({
  persistInterviewAttemptSessionLifecycle: jest.fn(),
}));

jest.mock('@features/aria/interviewLocalPersistence', () => ({
  markPreparingResultsSession: jest.fn(),
  saveInterviewProgress: jest.fn().mockResolvedValue(undefined),
}));

const CLOSING_LINE =
  'Thanks for working through all of this with me — that shows real care. Thank you for being so open with me.';

describe('runPreClaudePostClosingCompletionGate', () => {
  it('returns handled:false when interview is already marked complete', async () => {
    const deps = createMockPreClaudeDeps({
      isInterviewCompleteRef: { current: true },
      messages: [{ role: 'assistant', content: CLOSING_LINE }],
    });

    const result = await runPreClaudePostClosingCompletionGate(
      deps,
      'One more thought.',
      [{ role: 'user', content: 'One more thought.' }],
    );

    expect(result).toEqual({ handled: false });
  });

  it('returns handled:false when transcript has no closing assistant message', async () => {
    const deps = createMockPreClaudeDeps({
      messages: [{ role: 'assistant', content: 'What is going on between these two?' }],
    });

    const result = await runPreClaudePostClosingCompletionGate(
      deps,
      'Still thinking.',
      [{ role: 'user', content: 'Still thinking.' }],
    );

    expect(result).toEqual({ handled: false });
  });

  it('returns handled:false when moment 5 close gate is not satisfied', async () => {
    const deps = createMockPreClaudeDeps({
      messages: [{ role: 'assistant', content: CLOSING_LINE }],
      moment5QuestionDeliveredRef: { current: false },
      moment5PrimaryAnchorDeliveredSessionRef: { current: false },
      moment5PostPromptUserTurnCountRef: { current: 0 },
      moment5AccountabilityProbeFiredRef: { current: false },
      currentInterviewMomentRef: { current: 3 },
    });

    const result = await runPreClaudePostClosingCompletionGate(
      deps,
      'Thanks for listening.',
      [
        { role: 'assistant', content: CLOSING_LINE },
        { role: 'user', content: 'Thanks for listening.' },
      ],
    );

    expect(result).toEqual({ handled: false });
  });
});
