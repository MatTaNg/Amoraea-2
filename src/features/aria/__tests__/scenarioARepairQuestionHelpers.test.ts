import { describe, expect, it } from '@jest/globals';

import {
  coerceScenarioARepairQuestionForTts,
  isDanglingInterviewRepeatLeadFragment,
  isOrphanScenarioARepairEmmaTailFragment,
  looksLikeScenarioARepairReAskQuestion,
  looksLikeScenarioARepairStreamFragment,
  normalizeScenarioARepairQuestionInAssistantDraft,
  repairAssistantDraftAfterDanglingRepeatLead,
  spokenTextContainsScenarioARepairQuestion,
  stripEmbeddedScenarioARepairQuestionAsk,
  stripScenarioARepairQuestion,
} from '../scenarioARepairQuestionHelpers';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '../probeAndScoringUtils';
import { isInterviewCanonicalProbeRetired } from '../interviewCanonicalProbeRegistry';

describe('coerceScenarioARepairQuestionForTts', () => {
  it('detects and repairs dangling repeat-lead fragments after repair dedup', () => {
    const broken = "I'm with you. Of course, I said — this?";
    expect(isDanglingInterviewRepeatLeadFragment(broken)).toBe(true);
    expect(repairAssistantDraftAfterDanglingRepeatLead(broken)).toBe(
      `I'm with you. ${SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}`,
    );
    expect(normalizeScenarioARepairQuestionInAssistantDraft(broken)).toBe('');
  });

  it('repairs dangling repeat lead when repair ask is stripped from a longer paragraph', () => {
    const dangling = "I'm with you. Of course, I said — this?";
    expect(stripEmbeddedScenarioARepairQuestionAsk(dangling)).toBe(dangling);
    expect(repairAssistantDraftAfterDanglingRepeatLead(dangling)).toBe(
      `I'm with you. ${SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}`,
    );
  });

  it('fully strips repair-with-Emma so no orphan Emma tail remains', () => {
    expect(
      stripScenarioARepairQuestion(
        'Got it. If you were Ryan, how would you repair this with Emma?',
      ),
    ).toBe('Got it.');
    expect(
      stripScenarioARepairQuestion(
        'Got it. If you were Ryan, how would you repair things with Emma?',
      ),
    ).toBe('Got it.');
    expect(isOrphanScenarioARepairEmmaTailFragment('Got it. with Emma?')).toBe(true);
    expect(isOrphanScenarioARepairEmmaTailFragment('with Emma?')).toBe(true);
    expect(looksLikeScenarioARepairStreamFragment('Got it. with Emma?')).toBe(true);
    expect(looksLikeScenarioARepairStreamFragment('with Emma?')).toBe(true);
  });

  it('drops retired S1 repair fragments instead of coercing to canonical ask', () => {
    expect(isInterviewCanonicalProbeRetired('s1_repair')).toBe(true);
    expect(
      coerceScenarioARepairQuestionForTts(
        'Got it. If you were Ryan, how would you repair this with Emma?',
      ),
    ).toBe('');
    expect(coerceScenarioARepairQuestionForTts('Got it. with Emma?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('with Emma?')).toBe('');
  });

  it('coerces the canonical first repair ask', () => {
    // Probe is retired — coerce drops rather than reinjecting canonical copy.
    expect(
      coerceScenarioARepairQuestionForTts(
        'What if you were Ryan — how would you repair this situation?',
      ),
    ).toBe('');
  });

  it('coerces truncated Emma-tail fragments to empty when S1 repair is retired', () => {
    expect(coerceScenarioARepairQuestionForTts('Got it. this with Emma?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('Makes sense. this with Emma?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('this with Emma?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('Now, things with Emma?')).toBe('');
  });

  it('coerces sentence-split dangling tails after "Got it." to empty when S1 repair is retired', () => {
    expect(coerceScenarioARepairQuestionForTts('Got it. this?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('this?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('How would you repair this?')).toBe('');
  });

  it('coerces "repair this as Ryan" paraphrases to empty when S1 repair is retired', () => {
    expect(coerceScenarioARepairQuestionForTts('And how would you repair this as Ryan?')).toBe('');
    expect(coerceScenarioARepairQuestionForTts('How would you repair this as Ryan?')).toBe('');
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

  it('preserves the repair re-ask instead of collapsing to the first ask when not a retired drop', () => {
    const reAsk =
      'Got it. How would you make that repair actually happen — what would you say to Emma?';
    expect(looksLikeScenarioARepairReAskQuestion(reAsk)).toBe(true);
    // Retired: re-ask also drops.
    expect(coerceScenarioARepairQuestionForTts(reAsk)).toBe('');
  });

  it('preserves alternate repair re-ask phrasing that mentions Ryan', () => {
    const reAsk = 'Got it — how would you make that repair actually happen as Ryan?';
    expect(coerceScenarioARepairQuestionForTts(reAsk)).toBe('');
  });

  it('does not treat S1 wrap reflections with Emma as repair stream fragments', () => {
    const handoff =
      "Makes sense. That's a wrap on this situation. Good work, Matt — you framed Emma's line as a reactive dig rather than an opening. Here's the next situation. Sarah has been job hunting for four months.";
    expect(looksLikeScenarioARepairStreamFragment(handoff)).toBe(false);
    expect(normalizeScenarioARepairQuestionInAssistantDraft(handoff)).toBe(handoff);
  });
});
