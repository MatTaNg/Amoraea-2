import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeScenarioAMisplacedAnswerGate } from '@features/aria/runPreClaudeScenarioAMisplacedAnswerGate';
import { SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT } from '@features/aria/misplacedScenarioAnswerLogic';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('runPreClaudeScenarioAMisplacedAnswerGate', () => {
  it('redirects Sarah/James answer while still in Situation 1 without Claude', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      speakTextSafe,
      setMessages,
    });
    const answer =
      'James sounds like every typical clueless guy. Sarah should know better than to expect emotional presence from someone like him.';
    const result = await runPreClaudeScenarioAMisplacedAnswerGate(deps, answer);
    expect(result.handled).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT,
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith([
      ...deps.messages,
      { role: 'user', content: answer, scenarioNumber: 1 },
      { role: 'assistant', content: SCENARIO_A_MISPLACED_S2_ANSWER_REDIRECT, scenarioNumber: 1 },
    ]);
  });

  it('does not redirect Emma/Ryan answers in Situation 1', async () => {
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
    });
    const result = await runPreClaudeScenarioAMisplacedAnswerGate(
      deps,
      'Emma feels dismissed because Ryan took a call during dinner.',
    );
    expect(result.handled).toBe(false);
  });

  it('accepts Sarah/James answer when Situation 2 vignette was already spoken', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      speakTextSafe,
      lastQuestionTextRef: {
        current:
          "Sarah has been job hunting for four months. She gets an offer and calls James from the street. What do you think is going on here?",
      },
    });
    const answer =
      "I think she wanted a different type of celebration and James thought he was celebrating with her.";
    const result = await runPreClaudeScenarioAMisplacedAnswerGate(deps, answer);
    expect(result.handled).toBe(false);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(speakTextSafe).not.toHaveBeenCalled();
  });
});
