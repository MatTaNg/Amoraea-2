import { describe, expect, it } from '@jest/globals';
import {
  shouldDeferClientNarrativeForScoringInFlight,
  shouldKickClientNarrativeForAttempt,
} from '../clientNarrativeKickGate';

describe('clientNarrativeKickGate', () => {
  it('defers narrative when scenario slices are missing and no stored pillars', () => {
    expect(
      shouldDeferClientNarrativeForScoringInFlight({
        pillar_scores: null,
        scenario_1_scores: null,
        scenario_2_scores: null,
        scenario_3_scores: null,
        scenario_specific_patterns: {},
        transcript: [{ role: 'assistant', content: 'hello' }],
      }),
    ).toBe(true);
  });

  it('does not defer when stored pillar_scores exist', () => {
    expect(
      shouldDeferClientNarrativeForScoringInFlight({
        pillar_scores: { repair: 6 },
        scenario_1_scores: null,
      }),
    ).toBe(false);
  });

  it('skips narrative kick while scoring stages are in flight', () => {
    expect(
      shouldKickClientNarrativeForAttempt({
        reasoning_pending: true,
        hasPersistedPillarScores: false,
        ai_reasoning: null,
        sourceRow: {
          pillar_scores: null,
          scenario_1_scores: null,
          scenario_2_scores: null,
          scenario_3_scores: null,
          scenario_specific_patterns: {},
          transcript: [{ role: 'assistant', content: 'hello' }],
        },
      }),
    ).toBe(false);
  });
});
