import { describe, expect, it, jest } from '@jest/globals';

import { runApplyReferenceCardFromAssistantSpeech } from '@features/aria/runReferenceCardFromAssistantSpeech';
import {
  MOMENT_5_ACCOUNTABILITY_PROBE_TEXT,
  MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT,
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
} from '@features/aria/moment5ProbeCopy';
import { syncReferenceCardStateFromAssistantMessages } from '@features/aria/interviewReferenceCardResumeHelpers';
import type { ApplyReferenceCardFromAssistantSpeechDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';

function createDeps(
  overrides: Partial<ApplyReferenceCardFromAssistantSpeechDeps> = {},
): ApplyReferenceCardFromAssistantSpeechDeps {
  return {
    messages: [
      {
        role: 'assistant',
        content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      },
    ],
    committedScenarioRef: {
      current: {
        label: 'Personal reflection',
        text: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.trim(),
      },
    },
    setReferenceCardScenario: jest.fn(),
    setReferenceCardPrompt: jest.fn(),
    setInterviewUiPhase: jest.fn(),
    lastQuestionTextRef: { current: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
    ...overrides,
  } as ApplyReferenceCardFromAssistantSpeechDeps;
}

describe('Moment 5 show-scenario card updates', () => {
  it('updates the card to the accountability probe when that follow-up is spoken', () => {
    const deps = createDeps();
    runApplyReferenceCardFromAssistantSpeech(deps, MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Personal reflection',
      text: MOMENT_5_ACCOUNTABILITY_PROBE_TEXT.trim(),
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(null);
    expect(deps.lastQuestionTextRef?.current).toBe(MOMENT_5_ACCOUNTABILITY_PROBE_TEXT.trim());
  });

  it('restores the accountability probe on resume when it is the latest Moment 5 ask', () => {
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user', content: 'We argued about chores and then cooled off.' },
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_PROBE_WITH_GRIEF_ACK_TEXT },
    ]);

    expect(synced.scenario).toEqual({
      label: 'Personal reflection',
      text: MOMENT_5_ACCOUNTABILITY_PROBE_TEXT.trim(),
    });
    expect(synced.prompt).toBeNull();
  });

  it('updates the card for model paraphrase of M5 conflict (someone close / real conflict)', () => {
    const paraphrase =
      "Think of a time when you had a real conflict with someone close to you — maybe it got heated, or things were said that were hard to take back. What happened, and how did things get resolved?";
    const deps = createDeps({
      committedScenarioRef: {
        current: { label: 'Situation 3', text: 'Sophie and Daniel vignette' },
      },
      messages: [{ role: 'assistant', content: paraphrase }],
      lastQuestionTextRef: { current: 'At what point do you decide when a relationship is something to work through versus something you need to walk away from?' },
    });
    runApplyReferenceCardFromAssistantSpeech(deps, paraphrase);

    expect(deps.setReferenceCardScenario).toHaveBeenCalledWith({
      label: 'Personal reflection',
      text: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.trim(),
    });
    expect(deps.setReferenceCardPrompt).toHaveBeenCalledWith(null);
  });

  it('restores M5 conflict card on resume from close-to-you paraphrase', () => {
    const paraphrase =
      "Think of a time when you had a real conflict with someone close to you — maybe it got heated, or things were said that were hard to take back.";
    const synced = syncReferenceCardStateFromAssistantMessages([
      { role: 'assistant', content: 'Situation 3 vignette Sophie and Daniel' },
      { role: 'assistant', content: paraphrase },
    ]);
    expect(synced.scenario?.label).toBe('Personal reflection');
    expect(synced.scenario?.text).toBe(MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT.trim());
    expect(synced.prompt).toBeNull();
  });
});
