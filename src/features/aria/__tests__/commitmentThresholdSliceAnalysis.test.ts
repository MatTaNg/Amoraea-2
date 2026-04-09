import {
  sampleStdDev,
  analyzeCommitmentThresholdInconsistency,
} from '../commitmentThresholdSliceAnalysis';

describe('commitmentThresholdSliceAnalysis', () => {
  it('sampleStdDev returns null for fewer than 2 values', () => {
    expect(sampleStdDev([7])).toBeNull();
    expect(sampleStdDev([])).toBeNull();
  });

  it('flags high spread across two commitment slices', () => {
    const slices = [
      null,
      null,
      {
        pillarScores: { commitment_threshold: 2 },
        keyEvidence: { commitment_threshold: 'Third-party: never give up.' },
      },
      {
        pillarScores: { commitment_threshold: 7 },
        keyEvidence: { commitment_threshold: 'First-person: harm or dishonesty as walk-away.' },
      },
      null,
    ];
    const labels = ['scenario_1', 'scenario_2', 'scenario_3', 'moment_4', 'moment_5'];
    const r = analyzeCommitmentThresholdInconsistency(slices, labels);
    expect(r).not.toBeNull();
    expect(r!.sliceScores).toEqual([2, 7]);
    expect(r!.standardDeviation).toBeGreaterThan(3);
    expect(r!.evidenceSnippets.length).toBe(2);
  });
});
