import { describe, expect, it, jest } from '@jest/globals';

import { INABILITY_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/metaCommentClassification';
import { runPreClaudeInabilityEscalationSkipGate } from '@features/aria/runPreClaudeInabilityEscalationSkipGate';
import { runPreClaudeInabilityInvitationInjectGate } from '@features/aria/runPreClaudeInabilityInvitationInjectGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: "I don't know", scenarioNumber: 1 },
];

describe('runPreClaudeInabilityInvitationInjectGate', () => {
  it('returns null outside the interview skip-injection route', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });

    const result = await runPreClaudeInabilityInvitationInjectGate(deps, baseMessages);

    expect(result).toBeNull();
  });

  it('injects a rotating inability invitation and halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeInabilityInvitationInjectGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: true });
    expect(deps.inabilityCountByMomentRef.current[2]).toBe(1);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/no pressure|no right answer/i),
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(setMessages).toHaveBeenCalled();
  });
});

describe('runPreClaudeInabilityEscalationSkipGate', () => {
  it('offers skip confirmation on inability (same path as skip_request)', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      speakTextSafe,
    });

    const result = await runPreClaudeInabilityEscalationSkipGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipOfferSourceRef.current).toBe('inability_escalation');
    expect(deps.frustrationSkipAwaitingConfirmationRef.current).toBe(true);
    expect(deps.inabilityCountByMomentRef.current[3]).toBe(1);
    expect(speakTextSafe).toHaveBeenCalledWith(
      INABILITY_SKIP_CONFIRMATION_PROMPT_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });
});
