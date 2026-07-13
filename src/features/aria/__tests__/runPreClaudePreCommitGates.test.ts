import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudePreCommitGates } from '@features/aria/runPreClaudePreCommitGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('runPreClaudePreCommitGates', () => {
  it('returns handled:false when no pre-commit gate fires', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      interviewNameRef: { current: 'Alex' },
    });

    const result = await runPreClaudePreCommitGates(deps, 'They were dismissive.', 'Alex');

    expect(result).toEqual({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
  });

  it('short-circuits on name-entry and returns the spoken first name', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      interviewNameRef: { current: null },
      lastQuestionTextRef: { current: "Hi, I'm Amoraea. What can I call you?" },
      speakTextSafe,
    });

    const result = await runPreClaudePreCommitGates(deps, 'Alex', '');

    expect(result.handled).toBe(true);
    expect(result.isNameEntryTurn).toBe(true);
    expect(result.participantFirstNameForSpoken).toBe('Alex');
    expect(speakTextSafe).toHaveBeenCalled();
  });
});
