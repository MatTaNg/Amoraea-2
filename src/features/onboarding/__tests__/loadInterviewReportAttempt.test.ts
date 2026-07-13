import { describe, expect, it } from '@jest/globals';
import { resolveAttemptPillarScoresForReport } from '../loadInterviewReportAttempt';

describe('resolveAttemptPillarScoresForReport', () => {
  it('returns stored pillar_scores when present', () => {
    expect(
      resolveAttemptPillarScoresForReport({
        pillar_scores: { repair: 7, attunement: 6.5 },
      }),
    ).toEqual({ repair: 7, attunement: 6.5 });
  });

  it('falls back to averaging scenario bundles when holistic rollup is unavailable', () => {
    const pillars = resolveAttemptPillarScoresForReport({
      pillar_scores: null,
      scenario_1_scores: { pillarScores: { repair: 5, attunement: 5 } },
      scenario_2_scores: { pillarScores: { repair: 7, attunement: 7 } },
      scenario_3_scores: { pillarScores: { repair: 6, attunement: 6 } },
    });

    expect(pillars).toEqual({ repair: 6, attunement: 6 });
  });

  it('prefers stored pillar_scores over scenario-bundle averages', () => {
    expect(
      resolveAttemptPillarScoresForReport({
        pillar_scores: { repair: 8 },
        scenario_1_scores: { pillarScores: { repair: 4 } },
      }),
    ).toEqual({ repair: 8 });
  });
});
