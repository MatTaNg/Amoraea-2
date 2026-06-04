import { describe, expect, it } from '@jest/globals';
import { aggregatePillarScoresWithCommitmentMergeDetailed } from '../aggregateMarkerScoresFromSlices';
import { detectDefensePatterns } from '../defensePatternsDetection';

/** Slice bundle for attempt 8f52b3e4 (Matt) — mirrors stored scenario + moment JSON. */
function mattMarkerSlices() {
  return [
    {
      pillarScores: {
        repair: 7,
        attunement: 4,
        mentalizing: 4,
        accountability: 7,
        contempt_expression: 8,
        contempt_recognition: 3,
      },
      keyEvidence: { repair: 's1', attunement: 's1', mentalizing: 's1', accountability: 's1', contempt_expression: 's1', contempt_recognition: 's1' },
    },
    {
      pillarScores: {
        repair: 8,
        attunement: 8,
        mentalizing: 7,
        appreciation: 8,
        accountability: 8,
        contempt_expression: 9,
      },
      keyEvidence: { repair: 's2', attunement: 's2', mentalizing: 's2', appreciation: 's2', accountability: 's2', contempt_expression: 's2' },
    },
    {
      pillarScores: {
        repair: 6,
        attunement: 4,
        regulation: 7,
        mentalizing: 5,
        accountability: 5,
        contempt_expression: 6,
      },
      keyEvidence: { repair: 's3', attunement: 's3', regulation: 's3', mentalizing: 's3', accountability: 's3', contempt_expression: 's3' },
    },
    {
      pillarScores: {
        mentalizing: 4,
        accountability: 4,
        contempt_expression: 9,
        commitment_threshold: 7,
      },
      keyEvidence: { mentalizing: 'm4', accountability: 'm4', contempt_expression: 'm4', commitment_threshold: 'm4' },
      response_concreteness: 'moderate',
    },
    {
      pillarScores: {
        repair: 6,
        regulation: 5,
        mentalizing: 4,
        accountability: 3,
        contempt_expression: 6,
      },
      keyEvidence: { repair: 'm5', regulation: 'm5', mentalizing: 'm5', accountability: 'm5', contempt_expression: 'm5' },
      response_concreteness: 'moderate',
      mentalizing_overcertainty: true,
    },
  ];
}

const MATT_TRANSCRIPT_MIS_TAGGED = [
  {
    role: 'user',
    content: 'They need to figure out why Daniel keeps running away.',
    scenarioNumber: 3,
    interviewMoment: 1,
  },
  {
    role: 'user',
    content: "I still think he's a bit ignorant and immature, but I understand.",
    scenarioNumber: 3,
    interviewMoment: 5,
  },
] as const;

describe('adminRecalculateRegression (Matt 8f52b3e4)', () => {
  it('rollup: integer scenario-only pillars (M4/M5 must not dilute)', () => {
    const agg = aggregatePillarScoresWithCommitmentMergeDetailed(mattMarkerSlices(), {
      egoDevelopmentLevel: 3,
      defensePatternTranscript: MATT_TRANSCRIPT_MIS_TAGGED,
    });
    const p = agg.scores;
    for (const v of Object.values(p)) {
      expect(Number.isInteger(v)).toBe(true);
    }
    expect(p).toEqual({
      repair: 7,
      attunement: 5,
      mentalizing: 5,
      accountability: 7,
      regulation: 7,
      appreciation: 8,
      contempt: 6,
      commitment_threshold: 7,
    });
  });

  it('defense: no projection when M5 immature line is mis-tagged scenarioNumber 3', () => {
    const slices = mattMarkerSlices();
    const dp = detectDefensePatterns(
      [slices[0]!, slices[1]!, slices[2]!],
      slices[3]!,
      slices[4]!,
      MATT_TRANSCRIPT_MIS_TAGGED,
    );
    expect(dp.projection_detected).toBe(false);
  });

  it('broken rollup signature: averaging M4/M5 reproduces stored decimal pillars', () => {
    const broken = {
      repair: Math.round(((7 + 8 + 6 + 6) / 4) * 10) / 10,
      mentalizing: Math.round(((4 + 7 + 5 + 4 + 4) / 5) * 10) / 10,
      accountability: Math.round(((7 + 8 + 5 + 4 + 3) / 5) * 10) / 10,
    };
    expect(broken.mentalizing).toBe(4.8);
    expect(broken.repair).toBe(6.8);
    expect(broken.accountability).toBe(5.4);
  });
});
