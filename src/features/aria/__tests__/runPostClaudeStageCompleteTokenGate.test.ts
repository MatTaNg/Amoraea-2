import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeStageCompleteTokenGate } from '@features/aria/runPostClaudeStageCompleteTokenGate';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
} from './postClaudeGateTestHelpers';

describe('runPostClaudeStageCompleteTokenGate', () => {
  it('returns handled:false when token is absent', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeStageCompleteTokenGate(
      deps,
      params,
      'Continuing the interview.',
      speak,
    );

    expect(result).toEqual({ handled: false });
    expect(deps.fetchStageScore).not.toHaveBeenCalled();
  });

  it('stages display, speaks, and fetches stage score on [STAGE_2_COMPLETE]', async () => {
    const fetchStageScore = jest.fn().mockResolvedValue({
      pillarScores: { repair: 6 },
      keyEvidence: {},
      narrativeCoherence: 'high',
      behavioralSpecificity: 'moderate',
      notableInconsistencies: [],
      interviewSummary: 'Stage 2 scored.',
    });
    const setStageResults = jest.fn();
    const setMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      userId: '',
      fetchStageScore,
      setStageResults,
      setMessages,
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [{ role: 'user', content: 'I would listen first.' }],
      participantFirstNameForSpoken: 'Alex',
      trimmed: 'I would listen first.',
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeStageCompleteTokenGate(
      deps,
      params,
      "[STAGE_2_COMPLETE] Good, that's helpful.",
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(setMessages).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
    expect(fetchStageScore).toHaveBeenCalled();
    expect(setStageResults).toHaveBeenCalled();
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
  });
});
