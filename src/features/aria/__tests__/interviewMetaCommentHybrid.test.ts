import { describe, expect, it } from '@jest/globals';
import {
  mergeHeuristicMetaWithLlm,
  shouldAwaitMetaCommentLlm,
} from '@features/aria/interviewMetaCommentHybrid';
import type { MetaCommentLlmResult } from '@features/aria/interviewMetaCommentLlmTypes';
import type { ResolvedMetaComment } from '@features/aria/metaCommentClassificationTypes';

function resolution(
  overrides: Partial<ResolvedMetaComment> &
    Pick<ResolvedMetaComment, 'raw' | 'effective'>,
): ResolvedMetaComment {
  return {
    exemptMetaCommentTurn: false,
    exemptMetaCommentTurnReason: 'no_exemption_condition_met',
    ...overrides,
  };
}

describe('shouldAwaitMetaCommentLlm', () => {
  it('awaits LLM for ambiguous_short', () => {
    expect(
      shouldAwaitMetaCommentLlm({
        trimmed: 'uh hmm okay',
        metaResolved: resolution({
          raw: { type: 'ambiguous_short', confidence: 0.35 },
          effective: { type: 'ambiguous_short', confidence: 0.35 },
        }),
        micStopTelemetry: null,
      }),
    ).toBe(true);
  });

  it('awaits LLM for low-confidence frustration', () => {
    expect(
      shouldAwaitMetaCommentLlm({
        trimmed: 'this is annoying',
        metaResolved: resolution({
          raw: { type: 'frustration', confidence: 0.67 },
          effective: { type: 'frustration', confidence: 0.67 },
        }),
        micStopTelemetry: null,
      }),
    ).toBe(true);
  });

  it('skips LLM when cut-off detected', () => {
    expect(
      shouldAwaitMetaCommentLlm({
        trimmed: 'If I am right and I really',
        metaResolved: resolution({
          raw: { type: 'ambiguous_short', confidence: 0.35 },
          effective: { type: 'ambiguous_short', confidence: 0.35 },
        }),
        micStopTelemetry: {
          audioDurationMs: 0,
          wordCount: 6,
          wordsPerSecond: 0,
          ratioFlag: true,
        },
      }),
    ).toBe(false);
  });

  it('skips LLM for exempt meta turns', () => {
    expect(
      shouldAwaitMetaCommentLlm({
        trimmed: 'okay sure',
        metaResolved: resolution({
          raw: { type: 'ambiguous_short', confidence: 0.35 },
          effective: null,
          exemptMetaCommentTurn: true,
          exemptMetaCommentTurnReason: 'post_meta_ack_window_active',
        }),
        micStopTelemetry: null,
      }),
    ).toBe(false);
  });
  it('skips LLM for clear skip_request heuristics', () => {
    expect(
      shouldAwaitMetaCommentLlm({
        trimmed: 'Can I skip this question?',
        metaResolved: resolution({
          raw: { type: 'skip_request', confidence: 0.95 },
          effective: { type: 'skip_request', confidence: 0.95 },
        }),
        micStopTelemetry: null,
      }),
    ).toBe(false);
  });
});

describe('mergeHeuristicMetaWithLlm', () => {
  it('upgrades ambiguous_short to inability when LLM is confident', () => {
    const heuristic = resolution({
      raw: { type: 'ambiguous_short', confidence: 0.35 },
      effective: { type: 'ambiguous_short', confidence: 0.35 },
    });
    const llm: MetaCommentLlmResult = {
      metaType: 'inability',
      confidence: 0.92,
      reason: 'User cannot answer',
    };
    const merged = mergeHeuristicMetaWithLlm({
      metaResolved: heuristic,
      llm,
      minConfidence: 0.72,
    });
    expect(merged.effective?.type).toBe('inability');
    expect(merged.raw?.type).toBe('inability');
  });

  it('never lets LLM overwrite heuristic skip_request as confusion', () => {
    const heuristic = resolution({
      raw: { type: 'skip_request', confidence: 0.95 },
      effective: { type: 'skip_request', confidence: 0.95 },
    });
    const llm: MetaCommentLlmResult = {
      metaType: 'confusion',
      confidence: 0.95,
      reason: 'User asked a clarifying question',
    };
    const merged = mergeHeuristicMetaWithLlm({
      metaResolved: heuristic,
      llm,
      minConfidence: 0.72,
    });
    expect(merged.effective?.type).toBe('skip_request');
    expect(merged.raw?.type).toBe('skip_request');
  });

  it('downgrades to non-meta when LLM says substantive_answer', () => {
    const heuristic = resolution({
      raw: { type: 'frustration', confidence: 0.67 },
      effective: { type: 'frustration', confidence: 0.67 },
    });
    const llm: MetaCommentLlmResult = {
      metaType: 'substantive_answer',
      confidence: 0.88,
      reason: 'Substantive scenario response',
    };
    const merged = mergeHeuristicMetaWithLlm({
      metaResolved: heuristic,
      llm,
      minConfidence: 0.72,
    });
    expect(merged.effective).toBeNull();
  });

  it('keeps heuristic when LLM confidence is below threshold', () => {
    const heuristic = resolution({
      raw: { type: 'ambiguous_short', confidence: 0.35 },
      effective: { type: 'ambiguous_short', confidence: 0.35 },
    });
    const llm: MetaCommentLlmResult = {
      metaType: 'inability',
      confidence: 0.55,
      reason: 'Uncertain',
    };
    const merged = mergeHeuristicMetaWithLlm({
      metaResolved: heuristic,
      llm,
      minConfidence: 0.72,
    });
    expect(merged).toEqual(heuristic);
  });
});
