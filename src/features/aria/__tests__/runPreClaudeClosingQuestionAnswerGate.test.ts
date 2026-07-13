import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeClosingQuestionAnswerGate } from '@features/aria/runPreClaudeClosingQuestionAnswerGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('runPreClaudeClosingQuestionAnswerGate', () => {
  it('returns handled:false when no closing question is pending', async () => {
    const deps = createMockPreClaudeDeps({
      closingQuestionPending: false,
      lastClosingQuestionScenarioRef: { current: null },
    });

    const result = await runPreClaudeClosingQuestionAnswerGate(deps, 'no', 'Alex');

    expect(result).toEqual({ handled: false });
    expect(deps.setMessages).not.toHaveBeenCalled();
  });

  it('asks for a closing addition when user gives a short affirmative', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const setClosingQuestionPending = jest.fn();
    const setClosingQuestionScenario = jest.fn();
    const deps = createMockPreClaudeDeps({
      closingQuestionPending: true,
      closingQuestionScenario: 1,
      lastClosingQuestionScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
      setClosingQuestionPending,
      setClosingQuestionScenario,
    });

    const result = await runPreClaudeClosingQuestionAnswerGate(deps, 'yeah', 'Alex');

    expect(result).toEqual({ handled: true });
    expect(setClosingQuestionPending).toHaveBeenCalledWith(false);
    expect(setClosingQuestionScenario).toHaveBeenCalledWith(null);
    expect(deps.waitingForClosingAdditionRef.current).toBe(1);
    expect(deps.lastClosingQuestionScenarioRef.current).toBeNull();
    expect(speakTextSafe).toHaveBeenCalledWith(
      'What would you want to add?',
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: 'yeah', scenarioNumber: 1 }),
        expect.objectContaining({
          role: 'assistant',
          content: 'What would you want to add?',
          scenarioNumber: 1,
        }),
      ]),
    );
  });

  it('advances scenario 1→2 when user declines the closing question', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const scoreScenario = jest.fn();
    const markClosingQuestionAnswered = jest.fn();
    const notifyScenarioStarted = jest.fn().mockResolvedValue(undefined);
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      closingQuestionPending: true,
      closingQuestionScenario: 1,
      lastClosingQuestionScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
      setMessages,
      scoreScenario,
      markClosingQuestionAnswered,
      notifyScenarioStarted,
      runEmotionModalAfterScenarioTransition,
    });

    const result = await runPreClaudeClosingQuestionAnswerGate(deps, 'no', 'Alex');

    expect(result).toEqual({ handled: true });
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(markClosingQuestionAnswered).toHaveBeenCalledWith(1);
    expect(deps.scoredScenariosRef.current.has(1)).toBe(true);
    expect(scoreScenario).toHaveBeenCalledWith(1, expect.any(Array));
    expect(notifyScenarioStarted).toHaveBeenCalledWith(2, expect.any(Array));
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ priorScenario: 1 }),
    );
    expect(speakTextSafe).toHaveBeenCalled();
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          scenarioNumber: 2,
          content: expect.stringMatching(/What do you think is going on here/i),
        }),
      ]),
    );
  });

  it('injects Moment 4 handoff when user declines closing on scenario 3', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const scoreScenario = jest.fn();
    const runEmotionModalAfterScenarioTransition = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      closingQuestionPending: true,
      closingQuestionScenario: 3,
      lastClosingQuestionScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      personalHandoffInjectedRef: { current: false },
      speakTextSafe,
      setMessages,
      scoreScenario,
      runEmotionModalAfterScenarioTransition,
    });

    const result = await runPreClaudeClosingQuestionAnswerGate(deps, 'nothing else', 'Alex');

    expect(result).toEqual({ handled: true });
    expect(deps.personalHandoffInjectedRef.current).toBe(true);
    expect(deps.interviewMomentsCompleteRef.current[3]).toBe(true);
    expect(deps.currentInterviewMomentRef.current).toBe(4);
    expect(deps.scoredScenariosRef.current.has(3)).toBe(true);
    expect(scoreScenario).toHaveBeenCalledWith(3, expect.any(Array));
    expect(runEmotionModalAfterScenarioTransition).toHaveBeenCalledWith(
      3,
      expect.objectContaining({ transitionText: expect.stringMatching(/grudge/i) }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          scenarioNumber: 3,
          content: expect.stringMatching(/grudge/i),
        }),
      ]),
    );
  });
});
