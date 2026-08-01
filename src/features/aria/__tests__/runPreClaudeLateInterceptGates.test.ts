import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeLateInterceptGates } from '@features/aria/runPreClaudeLateInterceptGates';
import { runPreClaudeClientDisengagementProbeGate } from '@features/aria/runPreClaudeClientDisengagementProbeGate';
import { runPreClaudeClientOwnedCanonicalConstructGate } from '@features/aria/runPreClaudeClientOwnedCanonicalConstructGate';
import { runPreClaudeConfusionRepeatReplayGates } from '@features/aria/runPreClaudeConfusionRepeatReplayGates';
import { runPreClaudeIrrelevantAnswerRetryGate } from '@features/aria/runPreClaudeIrrelevantAnswerRetryGate';
import { runPreClaudeMoment4SpecificityGate } from '@features/aria/runPreClaudeMoment4SpecificityGate';
import { runPreClaudeMoment5AccountabilityInjectGates } from '@features/aria/runPreClaudeMoment5AccountabilityInjectGates';
import { runPreClaudeMoment5QuestionInjectGate } from '@features/aria/runPreClaudeMoment5QuestionInjectGate';
import { runPreClaudeScenario1RepairHardStopGate } from '@features/aria/runPreClaudeScenario1RepairHardStopGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/runPreClaudeMoment4SpecificityGate');
jest.mock('@features/aria/runPreClaudeConfusionRepeatReplayGates');
jest.mock('@features/aria/runPreClaudeMoment5QuestionInjectGate');
jest.mock('@features/aria/runPreClaudeMoment5AccountabilityInjectGates');
jest.mock('@features/aria/runPreClaudeScenario1RepairHardStopGate');
jest.mock('@features/aria/runPreClaudeClientDisengagementProbeGate');
jest.mock('@features/aria/runPreClaudeIrrelevantAnswerRetryGate');
jest.mock('@features/aria/runPreClaudeOrchestratorEarlyScoreGoBackGate');
jest.mock('@features/aria/runPreClaudeClientOwnedCanonicalConstructGate');
jest.mock('@features/aria/runPreClaudeCheckingInAckGate');
jest.mock('@features/aria/prefetchConstructSatisfactionLlmForPendingProbe', () => ({
  prefetchConstructSatisfactionLlmForPendingProbe: jest.fn().mockResolvedValue({}),
}));
jest.mock('@features/aria/prefetchInterviewTurnOrchestratorLlmForTurn', () => ({
  resolveInterviewTurnOrchestratorDecisionForTurn: jest.fn(),
}));
jest.mock('@features/aria/runPreClaudeOrchestratorExecuteGate', () => ({
  runPreClaudeOrchestratorExecuteGate: jest.fn(),
}));
jest.mock('@features/aria/deliverMoment4CommitmentThresholdProbe', () => ({
  deliverMoment4CommitmentThresholdProbe: jest.fn(),
}));

import { prefetchConstructSatisfactionLlmForPendingProbe } from '@features/aria/prefetchConstructSatisfactionLlmForPendingProbe';
import { resolveInterviewTurnOrchestratorDecisionForTurn } from '@features/aria/prefetchInterviewTurnOrchestratorLlmForTurn';
import { runPreClaudeOrchestratorExecuteGate } from '@features/aria/runPreClaudeOrchestratorExecuteGate';
import { runPreClaudeOrchestratorEarlyScoreGoBackGate } from '@features/aria/runPreClaudeOrchestratorEarlyScoreGoBackGate';
import { runPreClaudeCheckingInAckGate } from '@features/aria/runPreClaudeCheckingInAckGate';
import { deliverMoment4CommitmentThresholdProbe } from '@features/aria/deliverMoment4CommitmentThresholdProbe';

const mockMoment4 = jest.mocked(runPreClaudeMoment4SpecificityGate);
const mockEarlyScoreGoBack = jest.mocked(runPreClaudeOrchestratorEarlyScoreGoBackGate);
const mockConfusionRepeat = jest.mocked(runPreClaudeConfusionRepeatReplayGates);
const mockMoment5Question = jest.mocked(runPreClaudeMoment5QuestionInjectGate);
const mockMoment5Accountability = jest.mocked(runPreClaudeMoment5AccountabilityInjectGates);
const mockS1Repair = jest.mocked(runPreClaudeScenario1RepairHardStopGate);
const mockDisengagement = jest.mocked(runPreClaudeClientDisengagementProbeGate);
const mockIrrelevantRetry = jest.mocked(runPreClaudeIrrelevantAnswerRetryGate);
const mockClientOwned = jest.mocked(runPreClaudeClientOwnedCanonicalConstructGate);
const mockCheckingInAck = jest.mocked(runPreClaudeCheckingInAckGate);
const mockPrefetchConstructSatisfaction = jest.mocked(prefetchConstructSatisfactionLlmForPendingProbe);
const mockResolveOrchestrator = jest.mocked(resolveInterviewTurnOrchestratorDecisionForTurn);
const mockOrchestratorExecute = jest.mocked(runPreClaudeOrchestratorExecuteGate);
const mockDeliverMoment4Threshold = jest.mocked(deliverMoment4CommitmentThresholdProbe);

const orchestratorDecision = {
  source: 'heuristic_v1' as const,
  userIntent: 'substantive_answer' as const,
  activeQuestionPreview: 'preview',
  satisfiedProbeIds: [] as const,
  pendingProbeId: null,
  activeConstructEngaged: true,
  action: { kind: 'delegate_claude' as const },
  reason: 'test',
};

function resolvedOrchestratorPass() {
  return {
    decision: orchestratorDecision,
    heuristic: orchestratorDecision,
    resolution: 'heuristic' as const,
  };
}

const messagesToUse = [
  { role: 'assistant', content: 'What is going on between James and Emma?' },
  { role: 'user', content: 'Emma feels hurt and James is being dismissive.' },
];

function moment4Pass() {
  return {
    handled: false as const,
    answeringAfterMoment4SpecificityProbe: false,
    shouldForceMoment4ThresholdProbe: false,
    moment4ThresholdHintInAnswer: false,
  };
}

describe('runPreClaudeLateInterceptGates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEarlyScoreGoBack.mockResolvedValue({ handled: false });
    mockMoment4.mockResolvedValue(moment4Pass());
    mockConfusionRepeat.mockResolvedValue({ handled: false });
    mockMoment5Question.mockResolvedValue({ handled: false });
    mockMoment5Accountability.mockResolvedValue({
      handled: false,
      moment5CombinedUserText: '',
    });
    mockS1Repair.mockResolvedValue({ handled: false });
    mockDisengagement.mockResolvedValue({ handled: false });
    mockIrrelevantRetry.mockResolvedValue({ handled: false });
    mockClientOwned.mockResolvedValue({ handled: false });
    mockCheckingInAck.mockResolvedValue({ handled: false });
    mockPrefetchConstructSatisfaction.mockResolvedValue({});
    mockResolveOrchestrator.mockResolvedValue(resolvedOrchestratorPass());
    mockOrchestratorExecute.mockResolvedValue({ handled: false });
    mockDeliverMoment4Threshold.mockResolvedValue(false);
  });

  it('returns pass-through context when no intercept handles', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
    });

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'Emma feels hurt and James is being dismissive.',
      messagesToUse,
      1,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result.handled).toBe(false);
    if (!result.handled) {
      expect(result.lastAssistantContent).toContain('James and Emma');
      expect(result.moment5CombinedUserText).toBe('');
      expect(result.constructProbeFlags).toBeDefined();
      expect(result.constructSatisfactionResolvedByProbe).toEqual({});
      expect(result.resolvedOrchestrator).toBeDefined();
    }
    expect(mockPrefetchConstructSatisfaction).toHaveBeenCalled();
    expect(mockMoment4).toHaveBeenCalledWith(
      deps,
      'Emma feels hurt and James is being dismissive.',
      messagesToUse,
      expect.any(String),
      true,
    );
    expect(mockConfusionRepeat).toHaveBeenCalled();
    expect(mockMoment5Question).not.toHaveBeenCalled();
    expect(mockMoment5Accountability).toHaveBeenCalled();
    expect(mockS1Repair).toHaveBeenCalled();
    expect(mockDisengagement).toHaveBeenCalled();
    expect(mockIrrelevantRetry).toHaveBeenCalled();
    expect(mockClientOwned).toHaveBeenCalled();
  });

  it('short-circuits on go-back request before moment 4 specificity gate', async () => {
    mockEarlyScoreGoBack.mockResolvedValue({ handled: true });
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'Can we go back?',
      messagesToUse,
      3,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(mockEarlyScoreGoBack).toHaveBeenCalled();
    expect(mockMoment4).not.toHaveBeenCalled();
  });

  it('short-circuits when moment 4 specificity gate handles', async () => {
    mockMoment4.mockResolvedValue({
      handled: true,
      answeringAfterMoment4SpecificityProbe: false,
      shouldForceMoment4ThresholdProbe: false,
      moment4ThresholdHintInAnswer: false,
    });
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'short answer',
      messagesToUse,
      1,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(mockConfusionRepeat).not.toHaveBeenCalled();
    expect(mockMoment5Question).not.toHaveBeenCalled();
  });

  it('short-circuits on score request before irrelevant-answer retry', async () => {
    mockEarlyScoreGoBack.mockResolvedValue({ handled: true });
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'Can I see my school',
      messagesToUse,
      1,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(mockEarlyScoreGoBack).toHaveBeenCalled();
    expect(mockIrrelevantRetry).not.toHaveBeenCalled();
  });

  it('short-circuits when cut-off retry handles before orchestrator and later intercepts', async () => {
    mockIrrelevantRetry.mockResolvedValue({ handled: true });
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'Are you an alien?',
      messagesToUse,
      1,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(mockIrrelevantRetry).toHaveBeenCalled();
    expect(mockDisengagement).not.toHaveBeenCalled();
    expect(mockClientOwned).not.toHaveBeenCalled();
  });

  it('falls back to client M4 threshold delivery when orchestrator execute does not handle', async () => {
    mockMoment4.mockResolvedValue({
      handled: false,
      answeringAfterMoment4SpecificityProbe: false,
      shouldForceMoment4ThresholdProbe: true,
      moment4ThresholdHintInAnswer: false,
    });
    mockOrchestratorExecute.mockResolvedValue({ handled: false });
    mockDeliverMoment4Threshold.mockResolvedValue(true);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
    });

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'I had a fight with my friend and never spoke to him again.',
      messagesToUse,
      3,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(mockDeliverMoment4Threshold).toHaveBeenCalledWith(
      expect.objectContaining({
        logTag: '[M4_COMMITMENT_THRESHOLD_ORCHESTRATOR_FALLBACK]',
      }),
    );
  });

  it('short-circuits when client disengagement probe handles', async () => {
    mockDisengagement.mockResolvedValue({ handled: true });
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeLateInterceptGates(
      deps,
      'hello?',
      messagesToUse,
      1,
      'Maya',
      null,
      false,
      false,
      false,
    );

    expect(result).toEqual({ handled: true });
    expect(mockS1Repair).toHaveBeenCalled();
    expect(mockMoment5Accountability).toHaveBeenCalled();
  });
});
