import {
  aggregateMarkerScoresFromLabeledSlices,
  aggregatePillarScoresWithCommitmentMergeDetailed,
  combinedContemptFromScenarioPillarScores,
  extractEgoDevelopmentLevel,
  extractRepairSourceSignals,
  mergeCommitmentThresholdWeighted,
  type PillarMomentLabel,
} from '../aggregateMarkerScoresFromSlices';
import { calculateScoreConsistency } from '../alphaAssessmentUtils';

describe('combinedContemptFromScenarioPillarScores', () => {
  it('blends 60% expression + 40% recognition when both present (Scenario A)', () => {
    expect(
      combinedContemptFromScenarioPillarScores({ contempt_expression: 2, contempt_recognition: 3 })
    ).toBe(2);
  });

  it('uses expression only when recognition absent (Scenario B/C)', () => {
    expect(combinedContemptFromScenarioPillarScores({ contempt_expression: 3 })).toBe(3);
  });

  it('falls back to legacy monolithic contempt when split keys absent', () => {
    expect(combinedContemptFromScenarioPillarScores({ contempt: 5 })).toBe(5);
  });
});

describe('calculateScoreConsistency contempt row', () => {
  it('fills destructive_conflict s1–s3 from split sub-scores + 60/40 blend', () => {
    const out = calculateScoreConsistency(
      { contempt_expression: 2, contempt_recognition: 3 },
      { contempt_expression: 3 },
      { contempt_expression: 2, contempt_recognition: 4 }
    );
    expect(out.destructive_conflict.s1).toBe(2);
    expect(out.destructive_conflict.s2).toBe(3);
    expect(out.destructive_conflict.s3).toBe(3);
    expect(out.destructive_conflict.mean).toBeCloseTo(2.7, 5);
  });
});

describe('mergeCommitmentThresholdWeighted', () => {
  it('uses Moment 4 only when both slices have scores (Scenario C ignored)', () => {
    const base = { mentalizing: 7 };
    const s3 = {
      pillarScores: { commitment_threshold: 5 },
      keyEvidence: { commitment_threshold: 'Daniel/Sophie: legacy row ignored.' },
    };
    const m4 = {
      pillarScores: { commitment_threshold: 8 },
      keyEvidence: { commitment_threshold: 'First-person: clear limits.' },
    };
    const out = mergeCommitmentThresholdWeighted(base, s3, m4);
    expect(out.mentalizing).toBe(7);
    expect(out.commitment_threshold).toBe(8);
  });

  it('omits commitment_threshold when Moment 4 has no score (even if Scenario C has legacy data)', () => {
    const base = { repair: 6 };
    const s3 = {
      pillarScores: { commitment_threshold: 5 },
      keyEvidence: { commitment_threshold: 'Scenario C evidence.' },
    };
    const out = mergeCommitmentThresholdWeighted(base, s3, null);
    expect(out.commitment_threshold).toBeUndefined();
  });

  it('uses Moment 4 alone', () => {
    const base = { repair: 6 };
    const m4 = {
      pillarScores: { commitment_threshold: 9 },
      keyEvidence: { commitment_threshold: 'Personal threshold.' },
    };
    const out = mergeCommitmentThresholdWeighted(base, null, m4);
    expect(out.commitment_threshold).toBe(9);
  });
});

function labeled(
  moment: PillarMomentLabel,
  pillarScores: Record<string, number | null>,
  keyEvidence: Record<string, string> = {}
) {
  return { moment, pillarScores, keyEvidence };
}

describe('aggregateMarkerScoresFromLabeledSlices (moment matrix)', () => {
  it('averages repair from assessable sources only (missing slices omitted, not zeroed)', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { repair: 4 }, { repair: 'a' }),
      labeled('scenario_2', { repair: 4 }, { repair: 'b' }),
      labeled('scenario_3', { repair: 4 }, { repair: 'c' }),
      labeled('moment_4', { repair: null }, { repair: 'No assessable repair evidence from this scenario' }),
    ]);
    expect(scores.repair).toBe(4);
  });

  it('includes Moment 4 spontaneous repair when assessable', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_3', { repair: 6 }, { repair: 's3' }),
      labeled('moment_4', { repair: 8 }, { repair: 'spontaneous: I apologized and we talked it through.' }),
    ]);
    expect(scores.repair).toBe(7);
  });

  it('averages regulation from S1, S3, M4, M5, and support; missing sources omitted', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { regulation: 9 }, { regulation: 'x' }),
      labeled('scenario_3', { regulation: 5 }, { regulation: 'y' }),
      labeled('moment_4', { regulation: 8 }, { regulation: 'z' }),
    ]);
    expect(scores.regulation).toBe(7);
  });

  it('averages appreciation from scenario_1 and scenario_2 only (ignores M4/M5)', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { appreciation: 8 }, { appreciation: 's1' }),
      labeled('scenario_2', { appreciation: 6 }, { appreciation: 's2' }),
      labeled('moment_4', { appreciation: 9 }, { appreciation: 'ignored' }),
      labeled('moment_5', { appreciation: 4 }, { appreciation: 'ignored' }),
    ]);
    expect(scores.appreciation).toBe(7);
  });

  it('uses scenario_2 appreciation alone when scenario_1 has no score', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_2', { appreciation: 6 }, { appreciation: 's2' }),
      labeled('moment_4', { appreciation: 9 }, { appreciation: 'ignored' }),
    ]);
    expect(scores.appreciation).toBe(6);
  });

  it('excludes recovered-only scenario_1 appreciation regardless of recovered raw score', () => {
    const { scores: lowRecovered } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { appreciation: 5 }, { appreciation: 'Score recovered from model output.' }),
      labeled('scenario_2', { appreciation: 8 }, { appreciation: 's2 substantive' }),
    ]);
    expect(lowRecovered.appreciation).toBe(8);

    const { scores: highRecovered } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { appreciation: 6 }, { appreciation: 'Score recovered from model output.' }),
      labeled('scenario_2', { appreciation: 8 }, { appreciation: 's2 substantive' }),
    ]);
    expect(highRecovered.appreciation).toBe(8);
  });

  it('averages mentalizing from scenarios + support (ignores M4/M5); accountability includes M5', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { mentalizing: 8, accountability: 7 }, { mentalizing: 's1', accountability: 's1' }),
      labeled('scenario_2', { mentalizing: 8, accountability: 7 }, { mentalizing: 's2', accountability: 's2' }),
      labeled('scenario_3', { mentalizing: 8, accountability: 7 }, { mentalizing: 's3', accountability: 's3' }),
      labeled('moment_4', { mentalizing: 3, accountability: 3 }, { mentalizing: 'm4', accountability: 'm4' }),
      labeled('moment_5', { mentalizing: 3, accountability: 3 }, { mentalizing: 'm5', accountability: 'm5' }),
    ]);
    expect(scores.mentalizing).toBe(8);
    expect(scores.accountability).toBe(6);
  });

  it('excludes moment_4 attunement from responsiveness_support rollup', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { attunement: 6 }, { attunement: 's1' }),
      labeled('scenario_2', { attunement: 8 }, { attunement: 's2' }),
      labeled('moment_4', { attunement: 2 }, { attunement: 'm4' }),
    ]);
    expect(scores.responsiveness_support).toBe(7);
    expect(scores.attunement).toBeUndefined();
  });

  it('combines contempt: 60% expression + 40% recognition when both pools exist', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled(
        'scenario_1',
        { contempt_expression: 10, contempt_recognition: 4 },
        { contempt_expression: 'e', contempt_recognition: 'r' }
      ),
    ]);
    expect(scores.contempt).toBe(8);
  });

  it('moment_4 legacy monolithic `contempt` does not enter aggregate contempt (pooled expression is vignette-only)', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('moment_4', { contempt: 3 }, { contempt: 'legacy m4' }),
    ]);
    expect(scores.contempt).toBeUndefined();
  });

  it('uses scenario_1 legacy `contempt` for recognition only, not expression pool', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { contempt: 5 }, { contempt: 'legacy s1' }),
    ]);
    expect(scores.contempt).toBe(5);
  });

  it('scenario_1 legacy contempt recognition is unchanged when M4 also carries legacy contempt', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { contempt: 8 }, { contempt: 'rec read' }),
      labeled('moment_4', { contempt: 8 }, { contempt: 'm4 tone' }),
    ]);
    expect(scores.contempt).toBe(8);
  });

  it('pools contempt expression from scenarios 1–3 only — moment_4 cannot dilute low vignette expression', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled(
        'scenario_1',
        { contempt_expression: 2, contempt_recognition: 5 },
        { contempt_expression: 'harsh s1', contempt_recognition: 'r1' }
      ),
      labeled('moment_4', { contempt_expression: 10, contempt_recognition: 8 }, { contempt_expression: 'warm m4', contempt_recognition: 'r4' }),
    ]);
    // expression 2 only (scenarios); recognition (5+8)/2 = 6.5 → round(0.6*2 + 0.4*6.5) = 4
    expect(scores.contempt).toBe(4);
  });
});

describe('extractEgoDevelopmentLevel', () => {
  it('reads top-level ego_development_level', () => {
    expect(extractEgoDevelopmentLevel({ ego_development_level: 4 })).toBe(4);
  });

  it('reads nested pillarScores.ego_development_level', () => {
    expect(
      extractEgoDevelopmentLevel({
        pillarScores: { mentalizing: 5, ego_development_level: 2 },
      })
    ).toBe(2);
  });

  it('accepts string numerals', () => {
    expect(extractEgoDevelopmentLevel({ ego_development_level: '3' })).toBe(3);
  });

  it('returns null when absent', () => {
    expect(extractEgoDevelopmentLevel({ pillarScores: { mentalizing: 5 } })).toBe(null);
  });
});

describe('extractRepairSourceSignals', () => {
  it('keeps hypothetical, autobiographical, and spontaneous distinguishable without changing the pillar', () => {
    const rows = [
      labeled('scenario_1', { repair: 8 }, { repair: 's1 spontaneous' }),
      labeled('scenario_2', { repair: 6 }, { repair: 's2 spontaneous' }),
      labeled('scenario_3', { repair: 9 }, { repair: 's3 hypothetical' }),
      labeled('moment_4', { repair: 2 }, { repair: 'No assessable repair evidence from this scenario' }),
      labeled('moment_5', { repair: 4 }, { repair: 'm5 autobiographical' }),
    ];
    const { scores } = aggregateMarkerScoresFromLabeledSlices(rows);
    expect(scores.repair).toBe(7);
    const sources = extractRepairSourceSignals(rows);
    expect(sources.hypothetical_repair).toBe(9);
    expect(sources.autobiographical_repair).toBe(4);
    expect(sources.spontaneous_repair).toBe(7);
    expect(sources.spontaneous_scenario_1).toBe(8);
    expect(sources.spontaneous_scenario_2).toBe(6);
    expect(sources.no_divergence_penalty).toBe(true);
    expect(sources.hypothetical_minus_autobiographical).toBe(5);
    const detailed = aggregatePillarScoresWithCommitmentMergeDetailed(
      rows.map((r) => ({ pillarScores: r.pillarScores, keyEvidence: r.keyEvidence })),
    );
    expect(detailed.scores.repair).toBe(7);
    expect(detailed.repairSourceSignals.hypothetical_minus_autobiographical).toBe(5);
  });

  it('does not treat missing autobiographical as a zero gap', () => {
    const sources = extractRepairSourceSignals([
      labeled('scenario_3', { repair: 8 }, { repair: 's3' }),
    ]);
    expect(sources.hypothetical_repair).toBe(8);
    expect(sources.autobiographical_repair).toBeNull();
    expect(sources.hypothetical_minus_autobiographical).toBeNull();
  });
});
