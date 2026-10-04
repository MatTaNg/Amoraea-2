import { describe, expect, it } from '@jest/globals';

import { resolveResumeWelcomeQuestionText } from '@features/aria/applyResumeWelcomeMessagesAndPlayback';
import { findLastMoment4RepeatableQuestionText } from '@features/aria/interviewDisengagementTranscriptHelpers';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
  MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT,
  MOMENT_SUPPORT_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import {
  MOMENT_5_ACCOUNTABILITY_PROBE_TEXT,
  MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
} from '@features/aria/moment5ProbeCopy';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
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
    expect(withoutPersonalPart).toBe(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE);
    expect(withoutPersonalPart.toLowerCase()).not.toContain('repaired');

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

  it('replays the saved support question when the transcript still ends on commitment', () => {
    const messages = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: 'My friend and I stopped talking after a bad argument.', interviewMoment: 4 },
      {
        role: 'assistant',
        content: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
        interviewMoment: 4,
      },
    ];

    const resolved = resolveResumeWelcomeQuestionText(messages, MOMENT_SUPPORT_QUESTION_TEXT, {
      activeScenario: 3,
      firstName: 'Matt',
      inPersonalPart: true,
    });

    expect(resolved).toBe(MOMENT_SUPPORT_QUESTION_TEXT);
    expect(resolved).not.toContain('keep investing');
  });

  it('keeps the later support question in the transcript when the saved question is still commitment', () => {
    const messages = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: 'My friend and I stopped talking after a bad argument.', interviewMoment: 4 },
      {
        role: 'assistant',
        content: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
        interviewMoment: 4,
      },
      {
        role: 'user',
        content: 'I stayed because we had been close for years and I did not want to lose that.',
        interviewMoment: 4,
      },
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
    ];

    const resolved = resolveResumeWelcomeQuestionText(
      messages,
      MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
      { activeScenario: 3, firstName: 'Matt', inPersonalPart: true },
    );

    expect(resolved).toBe(MOMENT_SUPPORT_QUESTION_TEXT);
  });

  it('replays support follow-ups and the conflict question instead of commitment', () => {
    const hypothetical = resolveResumeWelcomeQuestionText(
      [
        { role: 'assistant', content: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT, interviewMoment: 4 },
        { role: 'assistant', content: MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT, interviewMoment: 4 },
      ],
      MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
      { activeScenario: 3, firstName: 'Matt', inPersonalPart: true },
    );
    expect(hypothetical).toBe(MOMENT_SUPPORT_NO_SITUATION_HYPOTHETICAL_TEXT);

    const need = resolveResumeWelcomeQuestionText(
      [
        { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
        { role: 'assistant', content: MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT, interviewMoment: 4 },
      ],
      MOMENT_SUPPORT_QUESTION_TEXT,
      { activeScenario: 3, firstName: 'Matt', inPersonalPart: true },
    );
    expect(need).toBe(MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT);

    const conflictFollowUp = resolveResumeWelcomeQuestionText(
      [
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT, interviewMoment: 5 },
        { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_PROBE_TEXT, interviewMoment: 5 },
      ],
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      { activeScenario: 3, firstName: 'Matt', inPersonalPart: true },
    );
    expect(conflictFollowUp).toBe(MOMENT_5_ACCOUNTABILITY_PROBE_TEXT);
  });

  it('replays the full personal scenario instead of a trailing What did you do fragment', () => {
    const paraphrase =
      'Think of a friend who was stressed and needed you. What did you do?';
    const afterFragment = [
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: 'I sat with them.', interviewMoment: 4 },
      { role: 'assistant', content: 'What did you do?', interviewMoment: 4 },
    ];

    expect(findLastMoment4RepeatableQuestionText(afterFragment)).toBe(MOMENT_SUPPORT_QUESTION_TEXT);
    expect(
      resolveResumeWelcomeQuestionText(afterFragment, 'What did you do?', {
        activeScenario: 3,
        firstName: 'Matt',
        inPersonalPart: true,
      }),
    ).toBe(MOMENT_SUPPORT_QUESTION_TEXT);

    const paraphraseOnly = [
      { role: 'assistant', content: paraphrase, interviewMoment: 4 },
    ];
    expect(findLastMoment4RepeatableQuestionText(paraphraseOnly)).toBe(paraphrase);
    expect(
      resolveResumeWelcomeQuestionText(paraphraseOnly, 'What did you do?', {
        activeScenario: 3,
        firstName: 'Matt',
        inPersonalPart: true,
      }),
    ).toBe(paraphrase);
  });

  it('keeps a Good work personal prompt whole on resume', () => {
    const spoken =
      'Good work. Think of a time when someone close to you was really stressed or going through something hard. What did you do?';
    const prompt =
      'Think of a time when someone close to you was really stressed or going through something hard. What did you do?';
    const messages = [
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: 'I listened.', interviewMoment: 4 },
      { role: 'assistant', content: spoken, interviewMoment: 4 },
    ];
    expect(findLastMoment4RepeatableQuestionText(messages)).toBe(prompt);
    expect(
      resolveResumeWelcomeQuestionText(messages, 'What did you do?', {
        activeScenario: 3,
        firstName: 'Matt',
        inPersonalPart: true,
      }),
    ).toBe(prompt);
  });

  it('replays the full conflict question instead of the resolution follow-up tail', () => {
    const paraphrase =
      "That makes a lot of sense. Last one, and then we'll wrap up. Think of a time when you and someone close to you had a real conflict — something that actually got tense between you. What happened, and how did it get resolved?";
    const messages = [
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: 'I asked her how I could support her.', interviewMoment: 4 },
      { role: 'assistant', content: paraphrase, interviewMoment: 4 },
    ];
    expect(findLastMoment4RepeatableQuestionText(messages)).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
    expect(
      resolveResumeWelcomeQuestionText(messages, MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, {
        activeScenario: 3,
        firstName: 'Mad',
        inPersonalPart: true,
      }),
    ).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT);
  });
});
