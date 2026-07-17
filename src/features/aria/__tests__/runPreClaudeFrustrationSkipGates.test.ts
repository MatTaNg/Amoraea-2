import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeFrustrationSkipAcceptanceGate } from '@features/aria/runPreClaudeFrustrationSkipAcceptanceGate';
import { runPreClaudeFrustrationSkipDeclineGate } from '@features/aria/runPreClaudeFrustrationSkipDeclineGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({ attemptId: 'attempt-test', platform: 'web' })),
  writeSessionLog: jest.fn(),
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: 'skip it', scenarioNumber: 1 },
];

describe('runPreClaudeFrustrationSkipAcceptanceGate', () => {
  it('returns null when skip injection route is inactive', async () => {
    const deps = createMockPreClaudeDeps({ isAdmin: true });

    const result = await runPreClaudeFrustrationSkipAcceptanceGate(deps, baseMessages);

    expect(result).toBeNull();
  });

  it('clears skip flags, keeps moment when more scripted questions remain, and falls through to the model', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      scenarioSkipOfferSourceRef: { current: 'frustration_first_signal' },
      frustrationSkipOfferPendingRef: { current: true },
      frustrationSkipAwaitingConfirmationRef: { current: true },
      frustrationSkipHadPriorAnswerRef: { current: true },
      scenarioSkipConfirmedCountRef: { current: 0 },
      scenarioSkipPenaltySumRef: { current: 0 },
      interviewSessionAttemptIdRef: { current: 'attempt-1' },
    });

    const result = await runPreClaudeFrustrationSkipAcceptanceGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: false });
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(false);
    expect(deps.frustrationSkipAwaitingConfirmationRef.current).toBe(false);
    expect(deps.frustrationSkipHadPriorAnswerRef.current).toBeNull();
    expect(deps.scenarioSkipOfferSourceRef.current).toBeNull();
    expect(deps.currentInterviewMomentRef.current).toBe(1);
    expect(deps.interviewMomentsCompleteRef.current[1]).toBeFalsy();
    expect(deps.scenarioFrustrationSkipNullMarkersRef.current[1]).toBeFalsy();
    expect(deps.scenarioSkipConfirmedCountRef.current).toBe(1);
    expect(deps.skipContinuationSystemSuffixRef.current).toContain('NEXT QUESTION IN SAME SCENARIO');
  });
});

describe('runPreClaudeFrustrationSkipDeclineGate', () => {
  it('returns null when skip injection route is inactive', async () => {
    const deps = createMockPreClaudeDeps({ status: 'results' });

    const result = await runPreClaudeFrustrationSkipDeclineGate(deps, baseMessages);

    expect(result).toBeNull();
  });

  it('delivers encouragement and halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      frustrationSkipOfferPendingRef: { current: true },
      scenarioSkipOfferSourceRef: { current: 'inability_escalation' },
      inabilityCountByMomentRef: { current: { 2: 2 } },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeFrustrationSkipDeclineGate(deps, baseMessages);

    expect(result).toEqual({ haltTurn: true });
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(false);
    expect(deps.inabilityCountByMomentRef.current[2]).toBe(0);
    const spoken = String(speakTextSafe.mock.calls[0]?.[0] ?? '');
    expect(spoken).toMatch(/stay on this one/i);
    expect(spoken).not.toMatch(/—|–|_/);
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          scenarioNumber: 1,
        }),
      ]),
    );
  });
});
