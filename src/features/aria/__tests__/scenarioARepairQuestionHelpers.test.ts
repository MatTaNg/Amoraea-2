import { describe, expect, it } from '@jest/globals';

import {
  coerceRetiredScenarioARepairLeakDuringScenarioB,
  coerceScenarioARepairQuestionForTts,
  isDanglingInterviewRepeatLeadFragment,
  isOrphanScenarioARepairEmmaTailFragment,
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairReAskQuestion,
  looksLikeScenarioARepairStreamFragment,
  normalizeScenarioARepairQuestionInAssistantDraft,
  omitRetiredScenarioARepairAsk,
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
    expect(normalizeScenarioARepairQuestionInAssistantDraft(broken)).toBe(
      `I'm with you. ${SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY}`,
    );
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

  it('replaces a Ryan repair leak during Scenario B with the James-differently question', () => {
    const spoken = 'If you were Ryan in that moment, how would you repair things with Emma?';
    expect(
      coerceRetiredScenarioARepairLeakDuringScenarioB({
        spoken,
        scenario: 2,
        moment: 2,
        messages: [
          {
            role: 'assistant',
            content:
              'Sarah has been job hunting for four months. What do you think is going on here?',
          },
          {
            role: 'user',
            content:
              "Sarah had an expectation of what he meant by let's celebrate tonight and then felt unappreciated.",
          },
        ],
      }),
    ).toBe(
      'Got it. What do you think James could have done differently to help Sarah feel appreciated?',
    );
  });

  it('drops "How would you repair things as Ryan?" and does not treat a contempt answer as Scenario B', () => {
    const spoken = 'Got it. How would you repair things as Ryan?';
    expect(looksLikeScenarioARepairQuestion(spoken)).toBe(true);
    expect(looksLikeScenarioARepairQuestion('How would you repair things as Ryan?')).toBe(true);
    expect(coerceScenarioARepairQuestionForTts(spoken)).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(omitRetiredScenarioARepairAsk(spoken)).toBe(spoken);
    expect(stripEmbeddedScenarioARepairQuestionAsk(spoken)).toBe('Got it.');
    expect(
      coerceRetiredScenarioARepairLeakDuringScenarioB({
        spoken,
        scenario: 2,
        moment: 2,
        messages: [
          {
            role: 'assistant',
            content: "What about when Emma says 'you've made that very clear' — what do you make of that?",
          },
          {
            role: 'user',
            content:
              'Now if he was a bit passive-aggressive when she says that, if she maybe had said, I feel like the way that you take the call during our dinner.',
          },
        ],
      }),
    ).toBeNull();
  });

  it('coerces Ryan roleplay respond asks to the live repair probe', () => {
    const spoken = 'Got it. As Ryan, how would you respond to Emma in that moment?';
    expect(looksLikeScenarioARepairQuestion(spoken)).toBe(true);
    expect(coerceScenarioARepairQuestionForTts(spoken)).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(stripEmbeddedScenarioARepairQuestionAsk(spoken)).toBe('Got it.');
  });

  it('coerces live S1 repair paraphrases to the canonical Ryan question', () => {
    expect(isInterviewCanonicalProbeRetired('s1_repair')).toBe(false);
    expect(
      coerceScenarioARepairQuestionForTts(
        'Got it. If you were Ryan, how would you repair this with Emma?',
      ),
    ).toBe('If you were Ryan, how would you repair this?');
    expect(coerceScenarioARepairQuestionForTts('Got it. with Emma?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('with Emma?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
  });

  it('coerces the canonical first repair ask', () => {
    expect(
      coerceScenarioARepairQuestionForTts(
        'What if you were Ryan — how would you repair this situation?',
      ),
    ).toBe('If you were Ryan, how would you repair this?');
  });

  it('coerces truncated Emma-tail fragments to the live Ryan repair question', () => {
    expect(coerceScenarioARepairQuestionForTts('Got it. this with Emma?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('Makes sense. this with Emma?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('this with Emma?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('Now, things with Emma?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
  });

  it('coerces sentence-split dangling tails to the live Ryan repair question', () => {
    expect(coerceScenarioARepairQuestionForTts('Got it. this?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('this?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('How would you repair this?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
  });

  it('coerces "repair this as Ryan" paraphrases to the live Ryan repair question', () => {
    expect(coerceScenarioARepairQuestionForTts('And how would you repair this as Ryan?')).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(coerceScenarioARepairQuestionForTts('How would you repair this as Ryan?')).toBe(
      'If you were Ryan, how would you repair this?',
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

  it('preserves the repair re-ask instead of collapsing to the first ask when not a retired drop', () => {
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
