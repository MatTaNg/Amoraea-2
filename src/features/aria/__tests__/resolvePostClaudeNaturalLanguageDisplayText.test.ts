import { describe, expect, it, jest } from '@jest/globals';

import {
  applyPostClaudeClosingQuestionTokenFromRawText,
  resolvePostClaudeNaturalLanguageDisplayText,
} from '@features/aria/resolvePostClaudeNaturalLanguageDisplayText';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
} from './postClaudeGateTestHelpers';

describe('resolvePostClaudeNaturalLanguageDisplayText', () => {
  it('applyPostClaudeClosingQuestionTokenFromRawText marks closing question refs', () => {
    const markClosingQuestionAsked = jest.fn();
    const setClosingQuestionPending = jest.fn();
    const setClosingQuestionScenario = jest.fn();
    const deps = createMockPostClaudeDeps({
      markClosingQuestionAsked,
      setClosingQuestionPending,
      setClosingQuestionScenario,
    });

    applyPostClaudeClosingQuestionTokenFromRawText(deps, 'Wrap up. [CLOSING_QUESTION:1] Anything else?');

    expect(markClosingQuestionAsked).toHaveBeenCalledWith(1);
    expect(setClosingQuestionPending).toHaveBeenCalledWith(true);
    expect(setClosingQuestionScenario).toHaveBeenCalledWith(1);
  });

  it('returns ack-adjusted display text for a normal turn', () => {
    const deps = createMockPostClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
    });
    const params = createMockPostClaudeParams({
      trimmed: 'I think Ryan was wrong.',
      messagesToUse: [{ role: 'user', content: 'I think Ryan was wrong.' }],
    });

    const displayText = resolvePostClaudeNaturalLanguageDisplayText(deps, params, {
      strippedText: 'Thanks Alex, that makes sense.',
      recentAsstForAck: [],
      shouldInjectScenarioARepairAfterContemptAnswer: false,
      assistantIssuedScenarioAContemptProbe: false,
      assistantIssuedScenarioBFullProbe: false,
      needsScenarioBJamesDifferentlyInsert: false,
    });

    expect(displayText).toMatch(/makes sense/i);
  });
});
