import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { prefetchConstructSatisfactionLlmForPendingProbe } from '@features/aria/prefetchConstructSatisfactionLlmForPendingProbe';
import { fetchInterviewConstructSatisfactionFromLlm } from '@features/aria/fetchInterviewConstructSatisfactionFromLlm';
import * as constructSatisfaction from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/fetchInterviewConstructSatisfactionFromLlm');

const mockFetchLlm = jest.mocked(fetchInterviewConstructSatisfactionFromLlm);

const baseConstructFlags = (): PreClaudeScenarioConstructProbeFlags => ({
  replyingToScenarioAQ1: true,
  replyingToScenarioBQ1: false,
  replyingToScenarioCQ1: false,
  scenarioAContemptGateUserText: '',
  shouldForceScenarioAContemptProbe: true,
  shouldForceScenarioBFullAppreciationProbe: false,
  shouldForceScenarioBJamesRepairProbe: false,
  shouldForceScenarioCRepairProbe: false,
  shouldForceScenarioCSophiePerspectiveProbe: false,
  specificEmmaLineAlreadyAddressed: false,
  sidedEntirelyWithJames: false,
  scenarioBQ1Engaged: false,
  muteParallelTtsForScenarioAContemptProbeStream: false,
  muteParallelTtsForS3ToM4HandoffStream: false,
  allowScenarioARepairAfterContemptAnswer: false,
});

describe('prefetchConstructSatisfactionLlmForPendingProbe', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.spyOn(constructSatisfaction, 'evaluateInterviewProbeConstructSatisfaction').mockReturnValue({
      satisfied: false,
      source: 'none',
      reason: 'not_met',
    });
  });

  it('returns llm_live resolution when live LLM confidently marks construct satisfied', async () => {
    mockFetchLlm.mockResolvedValue({
      satisfied: true,
      confidence: 0.88,
      reason: 'Emma contempt addressed in Q1',
    });
    const q1 = "What's going on between these two?";
    const answer = 'I think Emma was being passive aggressive when she said that clearly.';
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      lastQuestionTextRef: { current: q1 },
    });

    const resolved = await prefetchConstructSatisfactionLlmForPendingProbe({
      deps,
      trimmed: answer,
      messagesToUse: [
        { role: 'assistant', content: q1, scenarioNumber: 1, interviewMoment: 1 },
        { role: 'user', content: answer, scenarioNumber: 1, interviewMoment: 1 },
      ],
      lastAssistantContent: q1,
      constructProbeFlags: baseConstructFlags(),
      suppressForcedConstructProbesForMetaFrustration: false,
    });

    expect(resolved.s1_contempt?.resolution).toBe('llm_live');
    expect(resolved.s1_contempt?.satisfied).toBe(true);
    expect(mockFetchLlm).toHaveBeenCalled();
  });

  it('skips live LLM when heuristic already satisfied', async () => {
    jest
      .spyOn(constructSatisfaction, 'evaluateInterviewProbeConstructSatisfaction')
      .mockReturnValue({
        satisfied: true,
        source: 'user_transcript',
        reason: 'coverage',
      });

    const q1 = "What's going on between these two?";
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
    });
    const resolved = await prefetchConstructSatisfactionLlmForPendingProbe({
      deps,
      trimmed: 'Emma was dismissive toward Ryan in that moment clearly.',
      messagesToUse: [{ role: 'assistant', content: q1, scenarioNumber: 1 }],
      lastAssistantContent: q1,
      constructProbeFlags: baseConstructFlags(),
      suppressForcedConstructProbesForMetaFrustration: false,
    });

    expect(resolved.s1_contempt?.satisfied).toBe(true);
    expect(resolved.s1_contempt?.resolution).toBe('heuristic');
  });
});
