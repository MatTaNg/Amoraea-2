import { describe, expect, it } from '@jest/globals';

import {
  assertScenarioARepairQuestionCompleteness,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  S1_REPAIR_QUESTION,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import { normalizeScenarioARepairQuestionInAssistantDraft } from '@features/aria/scenarioARepairQuestionHelpers';

describe('SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY', () => {
  it('is the static S1 repair question without a leading acknowledgment', () => {
    expect(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(S1_REPAIR_QUESTION).toBe(SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY);
  });

  it('passes completeness assertion', () => {
    expect(() => assertScenarioARepairQuestionCompleteness()).not.toThrow();
  });

  it('normalizes truncated transcript fragments before persist', () => {
    expect(normalizeScenarioARepairQuestionInAssistantDraft('Got it. this with Emma?')).toBe(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );
  });
});
