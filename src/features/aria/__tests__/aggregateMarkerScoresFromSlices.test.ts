import {
  aggregateMarkerScoresFromLabeledSlices,
  combinedContemptFromScenarioPillarScores,
  mergeCommitmentThresholdWeighted,
  type PillarMomentLabel,
} from '../aggregateMarkerScoresFromSlices';
import { calculateScoreConsistency } from '../alphaAssessmentUtils';

describe('combinedContemptFromScenarioPillarScores', () => {
  it('blends 60% expression + 40% recognition when both present (Scenario A)', () => {
    expect(
      combinedContemptFromScenarioPillarScores({ contempt_expression: 2, contempt_recognition: 3 })
    ).toBe(2.4);
  });

  it('uses expression only when recognition absent (Scenario B/C)', () => {
    expect(combinedContemptFromScenarioPillarScores({ contempt_expression: 3 })).toBe(3);
  });

  it('falls back to legacy monolithic contempt when split keys absent', () => {
    expect(combinedContemptFromScenarioPillarScores({ contempt: 5 })).toBe(5);
  });
});

describe('calculateScoreConsistency contempt row', () => {
  it('fills contempt s1–s3 from split sub-scores + 60/40 blend', () => {
    const out = calculateScoreConsistency(
      { contempt_expression: 2, contempt_recognition: 3 },
      { contempt_expression: 3 },
      { contempt_expression: 2, contempt_recognition: 4 }
    );
    expect(out.contempt.s1).toBe(2.4);
    expect(out.contempt.s2).toBe(3);
    expect(out.contempt.s3).toBe(2.8);
    expect(out.contempt.mean).toBeCloseTo(2.7, 5);
  });
});

describe('mergeCommitmentThresholdWeighted', () => {
  it('uses 60% Moment 4 + 40% Scenario C when both present', () => {
    const base = { mentalizing: 7 };
    const s3 = {
      pillarScores: { commitment_threshold: 5 },
      keyEvidence: { commitment_threshold: 'Theo/Morgan: generic stay.' },
    };
    const m4 = {
      pillarScores: { commitment_threshold: 8 },
      keyEvidence: { commitment_threshold: 'First-person: clear limits.' },
    };
    const out = mergeCommitmentThresholdWeighted(base, s3, m4);
    expect(out.mentalizing).toBe(7);
    expect(out.commitment_threshold).toBe(6.8);
  });

  it('falls back to Scenario C alone when Moment 4 has no threshold', () => {
    const base = { repair: 6 };
    const s3 = {
      pillarScores: { commitment_threshold: 5 },
      keyEvidence: { commitment_threshold: 'Scenario C evidence.' },
    };
    const out = mergeCommitmentThresholdWeighted(base, s3, null);
    expect(out.commitment_threshold).toBe(5);
  });

  it('falls back to Moment 4 alone when Scenario C has no threshold', () => {
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
  it('averages repair from scenarios 1–3 only (ignores M4/M5)', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { repair: 4 }, { repair: 'a' }),
      labeled('scenario_2', { repair: 4 }, { repair: 'b' }),
      labeled('scenario_3', { repair: 4 }, { repair: 'c' }),
      labeled('moment_4', { repair: 2 }, { repair: 'm4' }),
      labeled('moment_5', { repair: 10 }, { repair: 'm5' }),
    ]);
    expect(scores.repair).toBe(4);
  });

  it('uses regulation from scenario_3 only', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { regulation: 9 }, { regulation: 'x' }),
      labeled('scenario_3', { regulation: 5 }, { regulation: 'y' }),
      labeled('moment_4', { regulation: 8 }, { regulation: 'z' }),
    ]);
    expect(scores.regulation).toBe(5);
  });

  it('averages appreciation from scenario_2 and moment_5 only', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { appreciation: 10 }, { appreciation: 'n/a' }),
      labeled('scenario_2', { appreciation: 6 }, { appreciation: 's2' }),
      labeled('moment_5', { appreciation: 8 }, { appreciation: 'm5' }),
    ]);
    expect(scores.appreciation).toBe(7);
  });

  it('excludes attunement from moment_4', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { attunement: 6 }, { attunement: 's1' }),
      labeled('moment_4', { attunement: 2 }, { attunement: 'm4' }),
      labeled('moment_5', { attunement: 8 }, { attunement: 'm5' }),
    ]);
    expect(scores.attunement).toBe(7);
  });

  it('combines contempt: 60% expression + 40% recognition when both pools exist', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled(
        'scenario_1',
        { contempt_expression: 10, contempt_recognition: 4 },
        { contempt_expression: 'e', contempt_recognition: 'r' }
      ),
    ]);
    expect(scores.contempt).toBe(7.6);
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
    // expression 2 only (scenarios); recognition (5+8)/2 = 6.5 → 0.6*2 + 0.4*6.5 = 3.8
    expect(scores.contempt).toBe(3.8);
  });
});
