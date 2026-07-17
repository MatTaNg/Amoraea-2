import { describe, expect, it } from '@jest/globals';

import { moment4AggregateFromBaselinePatterns } from '@features/aria/scoreAndPersistMoment4Slice';

describe('moment4AggregateFromBaselinePatterns', () => {
  it('returns sanitized aggregate when moment_4_scores were scored', () => {
    const out = moment4AggregateFromBaselinePatterns({
      moment_4_scores: {
        pillarScores: { accountability: 6, commitment_threshold: 5, repair: 8 },
        keyEvidence: { accountability: 'quote', repair: 'should strip' },
      },
    });
    expect(out?.pillarScores?.accountability).toBe(6);
    expect(out?.pillarScores?.repair).toBeUndefined();
  });

  it('returns null when moment_4_scores missing', () => {
    expect(moment4AggregateFromBaselinePatterns({})).toBeNull();
  });
});
