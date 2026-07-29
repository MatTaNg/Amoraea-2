import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeLateInterceptGates } from '@features/aria/runPreClaudeLateInterceptGates';
import { runPreClaudeClientDisengagementProbeGate } from '@features/aria/runPreClaudeClientDisengagementProbeGate';
import { runPreClaudeClientOwnedCanonicalConstructGate } from '@features/aria/runPreClaudeClientOwnedCanonicalConstructGate';
import { runPreClaudeConfusionRepeatReplayGates } from '@features/aria/runPreClaudeConfusionRepeatReplayGates';
import { runPreClaudeIrrelevantAnswerRetryGate } from '@features/aria/runPreClaudeIrrelevantAnswerRetryGate';
import { runPreClaudeGoBackRequestInjectGate } from '@features/aria/runPreClaudeGoBackRequestInjectGate';
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
jest.mock('@features/aria/runPreClaudeGoBackRequestInjectGate');
jest.mock('@features/aria/runPreClaudeScoreRequestInjectGate');
jest.mock('@features/aria/runPreClaudeClientOwnedCanonicalConstructGate');

import { runPreClaudeScoreRequestInjectGate } from '@features/aria/runPreClaudeScoreRequestInjectGate';

const mockMoment4 = jest.mocked(runPreClaudeMoment4SpecificityGate);
const mockGoBack = jest.mocked(runPreClaudeGoBackRequestInjectGate);
const mockScoreRequest = jest.mocked(runPreClaudeScoreRequestInjectGate);
const mockConfusionRepeat = jest.mocked(runPreClaudeConfusionRepeatReplayGates);
const mockMoment5Question = jest.mocked(runPreClaudeMoment5QuestionInjectGate);
const mockMoment5Accountability = jest.mocked(runPreClaudeMoment5AccountabilityInjectGates);
const mockS1Repair = jest.mocked(runPreClaudeScenario1RepairHardStopGate);
const mockDisengagement = jest.mocked(runPreClaudeClientDisengagementProbeGate);
const mockIrrelevantRetry = jest.mocked(runPreClaudeIrrelevantAnswerRetryGate);
const mockClientOwned = jest.mocked(runPreClaudeClientOwnedCanonicalConstructGate);

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
    mockGoBack.mockResolvedValue(null);
    mockScoreRequest.mockResolvedValue(null);
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
    );

    expect(result.handled).toBe(false);
    if (!result.handled) {
      expect(result.lastAssistantContent).toContain('James and Emma');
      expect(result.moment5CombinedUserText).toBe('');
      expect(result.constructProbeFlags).toBeDefined();
    }
    expect(mockMoment4).toHaveBeenCalled();
    expect(mockConfusionRepeat).toHaveBeenCalled();
    expect(mockMoment5Question).toHaveBeenCalled();
    expect(mockMoment5Accountability).toHaveBeenCalled();
    expect(mockS1Repair).toHaveBeenCalled();
    expect(mockDisengagement).toHaveBeenCalled();
    expect(mockIrrelevantRetry).toHaveBeenCalled();
    expect(mockClientOwned).toHaveBeenCalled();
  });

  it('short-circuits on go-back request before moment 4 specificity gate', async () => {
    mockGoBack.mockResolvedValue({ haltTurn: true });
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
    );

    expect(result).toEqual({ handled: true });
    expect(mockGoBack).toHaveBeenCalled();
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
    );

    expect(result).toEqual({ handled: true });
    expect(mockConfusionRepeat).not.toHaveBeenCalled();
    expect(mockMoment5Question).not.toHaveBeenCalled();
  });

  it('short-circuits on score request before irrelevant-answer retry', async () => {
    mockScoreRequest.mockResolvedValue({ haltTurn: true });
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
    );

    expect(result).toEqual({ handled: true });
    expect(mockScoreRequest).toHaveBeenCalled();
    expect(mockIrrelevantRetry).not.toHaveBeenCalled();
  });

  it('short-circuits when irrelevant-answer retry handles after other intercepts', async () => {
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
    );

    expect(result).toEqual({ handled: true });
    expect(mockDisengagement).toHaveBeenCalled();
    expect(mockClientOwned).toHaveBeenCalled();
    expect(mockIrrelevantRetry).toHaveBeenCalled();
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
    );

    expect(result).toEqual({ handled: true });
    expect(mockS1Repair).toHaveBeenCalled();
    expect(mockMoment5Accountability).toHaveBeenCalled();
  });
});
