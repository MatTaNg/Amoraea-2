import { describe, expect, it } from '@jest/globals';
import { resolvePillarScoresForNarrativeFromAttempt } from '../resolvePillarScoresForNarrative';

describe('resolvePillarScoresForNarrativeFromAttempt', () => {
  it('prefers stored pillar_scores and marks fromRollup false', () => {
    const result = resolvePillarScoresForNarrativeFromAttempt(
      {
        pillar_scores: { repair: 7.5, attunement: 6.2 },
        weighted_score: 6.8,
        passed: true,
        scenario_1_scores: { pillarScores: { repair: 4, attunement: 4 } },
      },
      true,
    );

    expect(result).toEqual({
      pillar_scores: { repair: 7.5, attunement: 6.2 },
      weighted_score: 6.8,
      passed: true,
      fromRollup: false,
    });
  });

  it('returns null when stored pillars are empty and rollup inputs are missing', () => {
    expect(
      resolvePillarScoresForNarrativeFromAttempt({
        pillar_scores: {},
        scenario_1_scores: null,
      }),
    ).toBeNull();
  });

  it('ignores non-numeric pillar values in stored scores', () => {
    const result = resolvePillarScoresForNarrativeFromAttempt({
      pillar_scores: { repair: 'bad' as unknown as number, attunement: 6 },
    });

    expect(result?.pillar_scores).toEqual({ attunement: 6 });
    expect(result?.fromRollup).toBe(false);
  });
});
