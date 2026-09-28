import { describe, expect, it } from '@jest/globals';

import {
  mergeProbeConstructSatisfactionWithLlm,
  resolvedProbeConstructShouldSkip,
} from '@features/aria/mergeProbeConstructSatisfactionWithLlm';

describe('mergeProbeConstructSatisfactionWithLlm', () => {
  it('keeps heuristic when already satisfied', () => {
    const merged = mergeProbeConstructSatisfactionWithLlm(
      { satisfied: true, source: 'user_transcript', reason: 'coverage' },
      { satisfied: false, confidence: 0.9, reason: 'llm no' },
    );
    expect(merged.resolution).toBe('heuristic');
    expect(merged.satisfied).toBe(true);
  });

  it('upgrades to llm_live when heuristic false and LLM confident satisfied', () => {
    const merged = mergeProbeConstructSatisfactionWithLlm(
      { satisfied: false, source: 'none', reason: 'not_met' },
      { satisfied: true, confidence: 0.85, reason: 'user addressed contempt in Q1' },
    );
    expect(merged.resolution).toBe('llm_live');
    expect(merged.satisfied).toBe(true);
    expect(merged.source).toBe('llm_live');
  });

  it('does not upgrade when LLM confidence is below threshold', () => {
    const merged = mergeProbeConstructSatisfactionWithLlm(
      { satisfied: false, source: 'none', reason: 'not_met' },
      { satisfied: true, confidence: 0.5, reason: 'maybe' },
    );
    expect(merged.resolution).toBe('heuristic_fallback');
    expect(merged.satisfied).toBe(false);
  });

  it('resolvedProbeConstructShouldSkip rejects transcript_delivered', () => {
    expect(
      resolvedProbeConstructShouldSkip({
        satisfied: true,
        source: 'transcript_delivered',
        reason: 'already spoken',
        llm: null,
        resolution: 'heuristic',
      }),
    ).toBe(false);
  });

  it('resolvedProbeConstructShouldSkip allows llm_live skip', () => {
    expect(
      resolvedProbeConstructShouldSkip({
        satisfied: true,
        source: 'llm_live',
        reason: 'construct met',
        llm: { satisfied: true, confidence: 0.9, reason: 'met' },
        resolution: 'llm_live',
      }),
    ).toBe(true);
  });
});
