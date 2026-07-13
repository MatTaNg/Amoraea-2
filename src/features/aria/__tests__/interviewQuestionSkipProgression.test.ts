import { describe, expect, it } from '@jest/globals';

import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';
import { SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/interviewPromptInstructions';
import {
  buildSkipAcceptedSystemSuffix,
  resolveQuestionSkipProgression,
} from '@features/aria/interviewQuestionSkipProgression';

const S3_Q1_ANSWER =
  "Yeah, I'll make of it that he needs some time and knowing some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's just really avoiding it.";

describe('resolveQuestionSkipProgression', () => {
  it('advances to Scenario C repair Q2 after skipping Sophie/elongating beat when Q1 was answered', () => {
    const messages = [
      { role: 'assistant', content: SCENARIO_3_OPENING, scenarioNumber: 3 },
      { role: 'user', content: S3_Q1_ANSWER, scenarioNumber: 3 },
      {
        role: 'assistant',
        content: "I'm with you. And what do you think Sophie should do when Daniel comes back?",
        scenarioNumber: 3,
      },
      { role: 'assistant', content: "I didn't quite catch that — could you say it again?", scenarioNumber: 3 },
      { role: 'user', content: '. .', scenarioNumber: 3 },
      { role: 'assistant', content: 'Makes sense. Just say whatever comes to mind.', scenarioNumber: 3 },
      { role: 'user', content: 'I would like to skip this question.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE, scenarioNumber: 3 },
      { role: 'user', content: 'Yes.', scenarioNumber: 3 },
    ];

    const result = resolveQuestionSkipProgression(messages, 3, 3);

    expect(result.scenarioMomentComplete).toBe(false);
    expect(result.nextPrompt).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('marks Scenario C complete only after repair Q2 was already delivered', () => {
    const messages = [
      { role: 'assistant', content: SCENARIO_3_OPENING, scenarioNumber: 3 },
      { role: 'user', content: S3_Q1_ANSWER, scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioNumber: 3 },
      { role: 'user', content: 'I would like to skip this question.', scenarioNumber: 3 },
      { role: 'assistant', content: SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE, scenarioNumber: 3 },
      { role: 'user', content: 'Yes.', scenarioNumber: 3 },
    ];

    expect(resolveQuestionSkipProgression(messages, 3, 3).scenarioMomentComplete).toBe(true);
  });

  it('buildSkipAcceptedSystemSuffix forbids scenario-complete language for in-scenario skip', () => {
    const suffix = buildSkipAcceptedSystemSuffix(
      { nextPrompt: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioMomentComplete: false },
      3,
    );
    expect(suffix).toContain('NEXT QUESTION IN SAME SCENARIO');
    expect(suffix).toContain(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
    expect(suffix).not.toMatch(/emit \*\*\[SCENARIO_COMPLETE:3\]\*\*/);
    expect(suffix).not.toMatch(/SCENARIO 3 COMPLETE/);
  });

  it('does not use personal or M5 copy for scenario skip suffix', () => {
    const suffix = buildSkipAcceptedSystemSuffix(
      { nextPrompt: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioMomentComplete: false },
      3,
    );
    expect(suffix).not.toContain(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });
});
