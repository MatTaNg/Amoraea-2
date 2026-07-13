import { describe, expect, it, jest } from '@jest/globals';

import { runPostClaudeClosingQuestionFailsafeGates } from '@features/aria/runPostClaudeClosingQuestionFailsafeGates';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
  createMockSpeakAssistantTurn,
  mockRef,
} from './postClaudeGateTestHelpers';

describe('runPostClaudeClosingQuestionFailsafeGates', () => {
  it('returns handled:false when no closing-ack or repeat-closing signals', async () => {
    const deps = createMockPostClaudeDeps();
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeClosingQuestionFailsafeGates(
      deps,
      params,
      'Thanks for sharing that.',
      speak,
    );

    expect(result).toEqual({ handled: false });
    expect(speak).not.toHaveBeenCalled();
  });

  it('defers to interview-complete gate when [INTERVIEW_COMPLETE] is present', async () => {
    const deps = createMockPostClaudeDeps({
      lastAnsweredClosingScenarioRef: mockRef(1),
      closingQuestionAskedRef: mockRef({ 1: true }),
      closingQuestionAnsweredRef: mockRef({ 1: true }),
    });
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeClosingQuestionFailsafeGates(
      deps,
      params,
      "Got it, let's move on. [INTERVIEW_COMPLETE]",
      speak,
    );

    expect(result).toEqual({ handled: false });
    expect(speak).not.toHaveBeenCalled();
  });

  it('advances scenario 1→2 on closing-ack when closing was answered', async () => {
    const scoreScenario = jest.fn();
    const resetScenarioCClientGatesOnly = jest.fn();
    const setMessages = jest.fn();
    const deps = createMockPostClaudeDeps({
      scoreScenario,
      resetScenarioCClientGatesOnly,
      setMessages,
      lastAnsweredClosingScenarioRef: mockRef(1),
      closingQuestionAskedRef: mockRef({ 1: true }),
      closingQuestionAnsweredRef: mockRef({ 1: true }),
      currentScenarioRef: mockRef(1),
      interviewMomentsCompleteRef: mockRef({}),
      currentInterviewMomentRef: mockRef(1),
    });
    const params = createMockPostClaudeParams({
      messagesToUse: [{ role: 'user', content: 'no' }],
      participantFirstNameForSpoken: 'Alex',
    });
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeClosingQuestionFailsafeGates(
      deps,
      params,
      "Okay, got it — let's move on to the next one.",
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(scoreScenario).toHaveBeenCalledWith(1, expect.any(Array));
    expect(resetScenarioCClientGatesOnly).not.toHaveBeenCalled();
    expect(setMessages).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
    expect(deps.setVoiceState).toHaveBeenCalledWith('idle');
    expect(deps.lastAnsweredClosingScenarioRef.current).toBeNull();
  });

  it('advances without scoring when closing refs are not both satisfied (closing-ack)', async () => {
    const scoreScenario = jest.fn();
    const deps = createMockPostClaudeDeps({
      scoreScenario,
      lastAnsweredClosingScenarioRef: mockRef(1),
      closingQuestionAskedRef: mockRef({ 1: true }),
      closingQuestionAnsweredRef: mockRef({ 1: false }),
      currentScenarioRef: mockRef(1),
      interviewMomentsCompleteRef: mockRef({}),
      currentInterviewMomentRef: mockRef(1),
    });
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeClosingQuestionFailsafeGates(
      deps,
      params,
      "Alright, let's move on to the next one.",
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(scoreScenario).not.toHaveBeenCalled();
  });

  it('advances when model repeats [CLOSING_QUESTION:N] after user already answered', async () => {
    const scoreScenario = jest.fn();
    const deps = createMockPostClaudeDeps({
      scoreScenario,
      closingQuestionAnsweredRef: mockRef({ 2: true }),
      currentScenarioRef: mockRef(2),
      interviewMomentsCompleteRef: mockRef({}),
      currentInterviewMomentRef: mockRef(2),
    });
    const params = createMockPostClaudeParams();
    const speak = createMockSpeakAssistantTurn();

    const result = await runPostClaudeClosingQuestionFailsafeGates(
      deps,
      params,
      '[CLOSING_QUESTION:2] Is there anything else you want to add?',
      speak,
    );

    expect(result).toEqual({ handled: true });
    expect(deps.interviewMomentsCompleteRef.current[2]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(3);
    expect(deps.resetScenarioCClientGatesOnly).toHaveBeenCalled();
    expect(scoreScenario).toHaveBeenCalledWith(2, expect.any(Array));
  });
});
