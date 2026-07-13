import { describe, expect, it } from '@jest/globals';

import {
  coerceScenarioARepairQuestionForTts,
  looksLikeScenarioARepairReAskQuestion,
  looksLikeScenarioARepairStreamFragment,
  normalizeScenarioARepairQuestionInAssistantDraft,
  spokenTextContainsScenarioARepairQuestion,
} from '../scenarioARepairQuestionHelpers';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '../probeAndScoringUtils';

describe('coerceScenarioARepairQuestionForTts', () => {
  it('coerces the canonical first repair ask', () => {
    expect(
      coerceScenarioARepairQuestionForTts(
        'What if you were Ryan — how would you repair this situation?',
      ),
    ).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('coerces truncated Emma-tail fragments to the full Ryan repair ask', () => {
    expect(coerceScenarioARepairQuestionForTts('Got it. this with Emma?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(coerceScenarioARepairQuestionForTts('Makes sense. this with Emma?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(coerceScenarioARepairQuestionForTts('this with Emma?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(coerceScenarioARepairQuestionForTts('Now, things with Emma?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
  });

  it('coerces sentence-split dangling tails after "Got it." to the full Ryan repair ask', () => {
    expect(coerceScenarioARepairQuestionForTts('Got it. this?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(coerceScenarioARepairQuestionForTts('this?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(coerceScenarioARepairQuestionForTts('How would you repair this?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
  });

  it('coerces "repair this as Ryan" paraphrases to the canonical first ask', () => {
    expect(coerceScenarioARepairQuestionForTts('And how would you repair this as Ryan?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
    expect(coerceScenarioARepairQuestionForTts('How would you repair this as Ryan?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
  });

  it('detects repair-as-Ryan paraphrases in stream fragments and bundled spoken text', () => {
    expect(looksLikeScenarioARepairStreamFragment('And how would you repair this as Ryan?')).toBe(
      true,
    );
    expect(looksLikeScenarioARepairStreamFragment('Now, things with Emma?')).toBe(true);
    expect(
      spokenTextContainsScenarioARepairQuestion(
        'Got it. And how would you repair this as Ryan?',
      ),
    ).toBe(true);
  });

  it('preserves the repair re-ask instead of collapsing to the first ask', () => {
    const reAsk =
      'Got it. How would you make that repair actually happen — what would you say to Emma?';
    expect(looksLikeScenarioARepairReAskQuestion(reAsk)).toBe(true);
    expect(coerceScenarioARepairQuestionForTts(reAsk)).toBe(reAsk);
  });

  it('preserves alternate repair re-ask phrasing that mentions Ryan', () => {
    const reAsk = 'Got it — how would you make that repair actually happen as Ryan?';
    expect(coerceScenarioARepairQuestionForTts(reAsk)).toBe(reAsk);
  });

  it('does not treat S1 wrap reflections with Emma as repair stream fragments', () => {
    const handoff =
      "Makes sense. That's a wrap on this situation. Good work, Matt — you framed Emma's line as a reactive dig rather than an opening. Here's the next situation. Sarah has been job hunting for four months.";
    expect(looksLikeScenarioARepairStreamFragment(handoff)).toBe(false);
    expect(normalizeScenarioARepairQuestionInAssistantDraft(handoff)).toBe(handoff);
  });
});
