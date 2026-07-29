import { describe, expect, it } from '@jest/globals';

import { resolveResumeWelcomeQuestionText } from '@features/aria/applyResumeWelcomeMessagesAndPlayback';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';
import {
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';

describe('resolveResumeWelcomeQuestionText', () => {
  it('uses Moment 4 grudge on personal-part resume when M4 was not persisted to transcript', () => {
    const messages = [
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL, scenarioNumber: 3 },
      {
        role: 'user',
        content:
          'Daniel needs to acknowledge how Sophie feels and they should talk it through honestly.',
        scenarioNumber: 3,
      },
    ];

    const withoutPersonalPart = resolveResumeWelcomeQuestionText(
      messages,
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
      { activeScenario: 3, firstName: 'Matt' },
    );
    expect(withoutPersonalPart.toLowerCase()).toContain('repaired');

    const withPersonalPart = resolveResumeWelcomeQuestionText(
      messages,
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
      { activeScenario: 3, firstName: 'Matt', inPersonalPart: true },
    );
    expect(withPersonalPart).toContain('hard time with');
    expect(withPersonalPart).not.toContain('repaired');
    expect(MOMENT_4_GRUDGE_QUESTION_TEXT.toLowerCase()).toContain(
      withPersonalPart.toLowerCase().slice(0, 20),
    );
  });

  it('prefers Moment 5 conflict question over commitment threshold on personal-part resume', () => {
    const m5Bundle = buildMoment4ThresholdAnswerToMoment5Bundle(
      'Matt',
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      'I would work through it unless trust is gone.',
    );
    const messages = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: 'My friend betrayed me.', interviewMoment: 4 },
      { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT, interviewMoment: 4 },
      {
        role: 'user',
        content: 'I think it depends on the person but if you love each other you should try to make it work.',
        interviewMoment: 4,
      },
      { role: 'assistant', content: m5Bundle, interviewMoment: 5 },
    ];

    const resolved = resolveResumeWelcomeQuestionText(messages, MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT, {
      activeScenario: 3,
      firstName: 'Matt',
      inPersonalPart: true,
    });

    expect(resolved).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(resolved).not.toContain('work through versus');
  });
});
