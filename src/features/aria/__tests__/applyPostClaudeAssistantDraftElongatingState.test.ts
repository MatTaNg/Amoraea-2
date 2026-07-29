import { describe, expect, it } from '@jest/globals';

import { applyPostClaudeAssistantDraftElongatingState } from '@features/aria/applyPostClaudeAssistantDraftElongatingState';
import {
  createMockPostClaudeDeps,
  createMockPostClaudeParams,
} from './postClaudeGateTestHelpers';

describe('applyPostClaudeAssistantDraftElongatingState', () => {
  it('clears coerced elongating-only draft when user turn suppressed elongating', () => {
    const deps = createMockPostClaudeDeps({
      elongatingProbeFiredRef: { current: false },
    });
    const answer =
      "Daniel felt genuinely at a loss about what to say next. He had some unresolved things that he wanted to say out loud, but he doesn't know how to say them.";
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      trimmed: answer,
    });

    const result = applyPostClaudeAssistantDraftElongatingState(
      deps,
      params,
      'Makes sense. And actually — go on?',
      false,
    );

    expect(result.strippedText).toBe('');
    expect(result.assistantTurnIsElongatingProbeOnly).toBe(false);
    expect(deps.elongatingProbeFiredRef.current).toBe(true);
  });

  it('clears elongating-only draft when user turn suppressed elongating', () => {
    const deps = createMockPostClaudeDeps({
      elongatingProbeFiredRef: { current: false },
    });
    const params = createMockPostClaudeParams({
      elongatingSuppressedForUserTurn: true,
      trimmed: 'Ryan should not have taken that call during their date with Emma.',
    });

    const result = applyPostClaudeAssistantDraftElongatingState(
      deps,
      params,
      'Can you say more about that?',
      false,
    );

    expect(result.strippedText).toBe('');
    expect(result.assistantTurnIsElongatingProbeOnly).toBe(false);
    expect(deps.elongatingProbeFiredRef.current).toBe(true);
  });

  it('marks elongating fired without clearing non-elongating draft', () => {
    const deps = createMockPostClaudeDeps({
      elongatingProbeFiredRef: { current: false },
    });
    const params = createMockPostClaudeParams();

    const result = applyPostClaudeAssistantDraftElongatingState(
      deps,
      params,
      'Thanks Alex, that makes sense.',
      false,
    );

    expect(result.strippedText).toBe('Thanks Alex, that makes sense.');
    expect(result.assistantTurnIsElongatingProbeOnly).toBe(false);
    expect(deps.elongatingProbeFiredRef.current).toBe(false);
  });
});
