import { commitPreClaudeUserTurn } from '@features/aria/commitPreClaudeUserTurn';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

function createDeps(overrides: Partial<PreClaudeTurnGateDeps> = {}): PreClaudeTurnGateDeps {
  const currentMessagesRef = {
    current: [{ role: 'assistant', content: 'What do you think?', scenarioNumber: 3, interviewMoment: 3 }],
  };
  let committed: unknown = null;
  return {
    messages: currentMessagesRef.current,
    currentMessagesRef,
    currentInterviewMomentRef: { current: 3 },
    currentScenarioRef: { current: 3 },
    commitInterviewMessages: (next) => {
      committed = typeof next === 'function' ? next(currentMessagesRef.current) : next;
      // Simulate async React setState: ref is NOT updated here.
    },
    setCurrentTranscript: jest.fn(),
    transcriptAtReleaseRef: { current: '' },
    markAiProcessingTurnStarted: jest.fn(),
    setVoiceState: jest.fn(),
    setIsWaiting: jest.fn(),
    setExchangeCount: jest.fn(),
    userId: null,
    isAdmin: false,
    isInterviewAppRoute: true,
    status: 'active',
    interviewSessionAttemptIdRef: { current: 'attempt-1' },
    interviewAttemptCreationInFlightRef: { current: false },
    lastQuestionTextRef: { current: 'What do you think?' },
    responseTimingsRef: { current: [] },
    resetSessionLogRuntime: jest.fn(),
    assignAttemptIdForSessionLogs: jest.fn(),
    collectDeviceContext: jest.fn(),
    createInterviewAttemptOnFirstSubstantiveResponse: jest.fn(),
    ...overrides,
  } as unknown as PreClaudeTurnGateDeps;
}

describe('commitPreClaudeUserTurn', () => {
  it('returns messagesToUse including the new user turn before React commits state', async () => {
    const deps = createDeps();
    const { messagesToUse } = await commitPreClaudeUserTurn(deps, 'She felt dismissed.');

    expect(messagesToUse.at(-1)).toMatchObject({
      role: 'user',
      content: 'She felt dismissed.',
      scenarioNumber: 1,
      interviewMoment: 3,
    });
    expect(deps.currentMessagesRef.current).toBe(messagesToUse);
  });

  it('collapses back-to-back duplicate user rows already in transcript', async () => {
    const priorUser =
      'I think that was not an agreement and her tone sounded snide when she said it.';
    const duplicateUser =
      "I think that's not an agreement and her tone sounded sad when she said it.";
    const currentMessagesRef = {
      current: [
        { role: 'assistant', content: 'What do you think?', scenarioNumber: 1, interviewMoment: 1 },
        { role: 'user', content: priorUser, scenarioNumber: 1, interviewMoment: 1 },
        { role: 'user', content: duplicateUser, scenarioNumber: 1, interviewMoment: 1 },
      ],
    };
    const deps = createDeps({ currentMessagesRef, messages: currentMessagesRef.current });
    const { messagesToUse } = await commitPreClaudeUserTurn(deps, 'A brand new answer about Emma.');

    expect(messagesToUse.filter((m) => m.role === 'user')).toHaveLength(1);
    expect(messagesToUse.at(-1)?.content).toBe('A brand new answer about Emma.');
  });
});
