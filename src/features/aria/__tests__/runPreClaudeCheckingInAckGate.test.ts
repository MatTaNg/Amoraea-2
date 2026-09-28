import { describe, expect, it, jest, beforeEach } from '@jest/globals';

import { runPreClaudeCheckingInAckGate } from '@features/aria/runPreClaudeCheckingInAckGate';
import { SCENARIO_B_JAMES_REPAIR_CANONICAL } from '@features/aria/scenarioBProbeLogic';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/interviewCheckingInAck', () => {
  const actual = jest.requireActual<typeof import('@features/aria/interviewCheckingInAck')>(
    '@features/aria/interviewCheckingInAck',
  );
  return {
    ...actual,
    resolveCheckingInBriefAckForInterview: jest.fn(),
  };
});

jest.mock('@features/aria/deliverInterviewCanonicalProbe', () => ({
  deliverInterviewCanonicalProbe: jest.fn(),
}));

jest.mock('@features/aria/evaluateInterviewTurnOrchestratorDecision', () => ({
  resolvePendingCanonicalProbeForTurn: jest.fn(),
}));

jest.mock('@features/aria/resolvePreClaudeScenarioConstructProbeFlags', () => ({
  resolvePreClaudeScenarioConstructProbeFlags: jest.fn(),
}));

import { resolveCheckingInBriefAckForInterview } from '@features/aria/interviewCheckingInAck';
import { deliverInterviewCanonicalProbe } from '@features/aria/deliverInterviewCanonicalProbe';
import { resolvePendingCanonicalProbeForTurn } from '@features/aria/evaluateInterviewTurnOrchestratorDecision';
import { resolvePreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

const mockResolveAck = jest.mocked(resolveCheckingInBriefAckForInterview);
const mockDeliverProbe = jest.mocked(deliverInterviewCanonicalProbe);
const mockResolvePendingProbe = jest.mocked(resolvePendingCanonicalProbeForTurn);
const mockConstructFlags = jest.mocked(resolvePreClaudeScenarioConstructProbeFlags);

describe('runPreClaudeCheckingInAckGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveAck.mockResolvedValue({ ack: "Yes — I heard you.", source: 'static' });
    mockResolvePendingProbe.mockReturnValue(null);
    mockConstructFlags.mockReturnValue({
      shouldForceScenarioBJamesRepairProbe: false,
    } as ReturnType<typeof resolvePreClaudeScenarioConstructProbeFlags>);
    mockDeliverProbe.mockResolvedValue(undefined);
  });

  it('returns handled false for non-checking-in turns', async () => {
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeCheckingInAckGate(
      deps,
      'I would apologize first.',
      [],
      { type: 'substantive' } as never,
      false,
    );

    expect(result).toEqual({ handled: false });
  });

  it('speaks ack-only with reflection and looking-for when the active question was already asked', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const finalizeMetaAck = jest.fn();
    const repairQuestion = SCENARIO_B_JAMES_REPAIR_CANONICAL;
    const priorAnswer =
      'James could handle this differently by slowing down and asking Sarah what she needed instead of jumping straight to solutions.';
    const messages = [
      { role: 'assistant', content: repairQuestion, scenarioNumber: 2 },
      { role: 'user', content: priorAnswer, scenarioNumber: 2 },
      {
        role: 'assistant',
        content: `Yes — that's enough. That makes a lot of sense. ${repairQuestion}`,
        scenarioNumber: 2,
      },
      { role: 'user', content: 'Was that enough?', scenarioNumber: 2 },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: repairQuestion },
      messages: messages as never,
      speakTextSafe,
      finalizePendingMetaAckBaselineAfterAssistantTextRef: { current: finalizeMetaAck },
    });

    const result = await runPreClaudeCheckingInAckGate(
      deps,
      'Was that enough?',
      messages,
      { type: 'checking_in' },
      true,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/You said/i),
      expect.objectContaining({
        skipLastQuestionRef: true,
        skipQuestionDeliveredTelemetry: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
    expect(speakTextSafe.mock.calls[0]?.[0]).toMatch(/what i'm looking for here is/i);
    expect(speakTextSafe.mock.calls[0]?.[0]).toMatch(
      /not quite|not quite what i need yet|not quite yet/i,
    );
    expect(speakTextSafe.mock.calls[0]?.[0]).toMatch(/you said/i);
    expect(speakTextSafe.mock.calls[0]?.[0]).not.toMatch(/^got it\b/i);
    expect(finalizeMetaAck).toHaveBeenCalled();
    expect(deps.metaClassificationForPendingAssistantRef.current).toEqual({ type: 'checking_in' });
    expect(mockDeliverProbe).not.toHaveBeenCalled();
  });

  it('handles sufficiency challenge phrasing classified as frustration', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const repairQuestion = SCENARIO_B_JAMES_REPAIR_CANONICAL;
    const differentlyQuestion =
      'Makes sense. What do you think James could have done differently to help Sarah feel appreciated?';
    const priorAnswer =
      'I think James should listen more and acknowledge how Sarah felt before trying to fix anything.';
    const messages = [
      { role: 'assistant', content: differentlyQuestion, scenarioNumber: 2 },
      { role: 'user', content: priorAnswer, scenarioNumber: 2 },
      { role: 'user', content: "Wasn't that enough?", scenarioNumber: 2 },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: differentlyQuestion },
      messages: messages as never,
      speakTextSafe,
    });

    const result = await runPreClaudeCheckingInAckGate(
      deps,
      "Wasn't that enough?",
      messages,
      { type: 'frustration', confidence: 0.67 },
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/you said/i),
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(speakTextSafe.mock.calls[0]?.[0]).toMatch(
      /not quite|not quite what i need yet|not quite yet/i,
    );
    expect(mockDeliverProbe).not.toHaveBeenCalled();
  });

  it('uses ack-only with looking-for when the assessable question is already in transcript', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const repairQuestion = SCENARIO_B_JAMES_REPAIR_CANONICAL;
    const differentlyQuestion = 'How would James handle this differently?';
    const messages = [
      { role: 'assistant', content: differentlyQuestion, scenarioNumber: 2 },
      { role: 'user', content: 'Was that enough?', scenarioNumber: 2 },
    ];
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: repairQuestion },
      messages: messages as never,
      speakTextSafe,
    });

    const result = await runPreClaudeCheckingInAckGate(
      deps,
      'Was that enough?',
      messages,
      { type: 'checking_in' },
      true,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/what i'm looking for here is/i),
      expect.objectContaining({ skipLastQuestionRef: true, allowDuplicateConsecutiveTts: true }),
    );
  });
});
