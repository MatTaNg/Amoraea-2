import { describe, expect, it } from '@jest/globals';

import {
  countConfirmedScenarioSkipsFromTranscript,
  resolveScenarioSkipConfirmedCount,
} from '@features/aria/scenarioSkipCountHydration';
import { SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/interviewPromptInstructions';
import { INABILITY_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/metaCommentSkipFrustration';

describe('scenarioSkipCountHydration', () => {
  it('counts confirmed scenario and M5 skip confirmations on the shared ladder', () => {
    const messages = [
      {
        role: 'assistant',
        content: SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
        scenarioNumber: 1,
        interviewMoment: 1,
      },
      { role: 'user', content: 'Yes.', scenarioNumber: 1, interviewMoment: 1 },
      {
        role: 'assistant',
        content: INABILITY_SKIP_CONFIRMATION_PROMPT_LINE,
        scenarioNumber: 2,
        interviewMoment: 2,
      },
      { role: 'user', content: 'No', scenarioNumber: 2, interviewMoment: 2 },
      {
        role: 'assistant',
        content: 'Are you sure you want to skip this one? We can, but it may affect your score.',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
      { role: 'user', content: 'Yes.', scenarioNumber: 3, interviewMoment: 5 },
    ];
    expect(countConfirmedScenarioSkipsFromTranscript(messages)).toBe(2);
  });

  it('still ignores Moment 4 skip confirmations', () => {
    const messages = [
      {
        role: 'assistant',
        content: SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
        interviewMoment: 4,
      },
      { role: 'user', content: 'Yes.', interviewMoment: 4 },
    ];
    expect(countConfirmedScenarioSkipsFromTranscript(messages)).toBe(0);
  });

  it('resolveScenarioSkipConfirmedCount prefers transcript/db over zero ref', () => {
    expect(
      resolveScenarioSkipConfirmedCount({
        refCount: 0,
        storedCount: 0,
        dbSkipCount: 0,
        transcriptMessages: [
          {
            role: 'assistant',
            content: SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
            interviewMoment: 1,
          },
          { role: 'user', content: 'Yes.', interviewMoment: 1 },
        ],
      }),
    ).toBe(1);
  });

  it('resolveScenarioSkipConfirmedCount keeps highest skip count across sources', () => {
    expect(
      resolveScenarioSkipConfirmedCount({
        refCount: 1,
        storedCount: 2,
        dbSkipCount: 0,
        transcriptMessages: [],
      }),
    ).toBe(2);
  });
});
