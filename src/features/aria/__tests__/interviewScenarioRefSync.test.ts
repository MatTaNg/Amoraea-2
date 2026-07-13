import { describe, expect, it } from '@jest/globals';

import {
  inferActiveScenarioFromTranscriptMessages,
  syncInterviewScenarioRefsFromSpokenDelivery,
  syncInterviewScenarioRefsFromTranscript,
} from '@features/aria/interviewScenarioRefSync';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import {
  userAnswerLooksLikeMisplacedScenarioBInScenarioA,
  userAnswerReferencesScenarioBCharacters,
} from '@features/aria/misplacedScenarioAnswerLogic';

describe('interviewScenarioRefSync', () => {
  it('infers scenario 2 when Sarah/James vignette appears in assistant transcript', () => {
    const messages = [
      { role: 'assistant', content: 'What is going on between Emma and Ryan?', scenarioNumber: 1 },
      { role: 'user', content: 'They need clearer boundaries.', scenarioNumber: 1 },
      { role: 'assistant', content: SCENARIO_2_TEXT, scenarioNumber: 1 },
    ];
    expect(inferActiveScenarioFromTranscriptMessages(messages, 1, 1)).toBe(2);
  });

  it('advances refs when transcript shows S2 but refs still on S1', () => {
    const deps = {
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 as const },
      interviewMomentsCompleteRef: { current: { 1: false, 2: false, 3: false } },
      resumeActiveScenarioRef: { current: 1 },
      scoredScenariosRef: { current: new Set([1]) },
    };
    const messages = [
      { role: 'assistant', content: SCENARIO_2_TEXT, scenarioNumber: 1 },
    ];
    const result = syncInterviewScenarioRefsFromTranscript(deps, messages);
    expect(result.effectiveScenario).toBe(2);
    expect(result.advanced).toBe(true);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.interviewMomentsCompleteRef.current[1]).toBe(true);
  });

  it('advances refs from spoken delivery text when transcript was not persisted', () => {
    const deps = {
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 as const },
      interviewMomentsCompleteRef: { current: { 1: false, 2: false, 3: false } },
      resumeActiveScenarioRef: { current: 1 },
      interviewSessionIdRef: { current: 'session-1' },
    };
    const result = syncInterviewScenarioRefsFromSpokenDelivery(deps, {
      extraTexts: [SCENARIO_2_TEXT],
    });
    expect(result.effectiveScenario).toBe(2);
    expect(result.advanced).toBe(true);
    expect(deps.currentScenarioRef.current).toBe(2);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
  });
});

describe('misplacedScenarioAnswerLogic James-only', () => {
  it('detects James-only Scenario B answers', () => {
    const answer =
      "James thought that he was celebrating with her by engaging and showing up in the present moment and asking questions, but it sounds like she wanted something different.";
    expect(userAnswerReferencesScenarioBCharacters(answer)).toBe(true);
    expect(userAnswerLooksLikeMisplacedScenarioBInScenarioA(answer)).toBe(true);
  });
});
