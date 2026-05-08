import { describe, expect, it } from '@jest/globals';
import { evaluateInterviewCompletionGate, pillarScoresHaveNumericAssessment } from '../interviewCompletionGate';

describe('pillarScoresHaveNumericAssessment', () => {
  it('returns false when all null', () => {
    expect(pillarScoresHaveNumericAssessment({ mentalizing: null, repair: null })).toBe(false);
  });
  it('returns true when any finite number', () => {
    expect(pillarScoresHaveNumericAssessment({ mentalizing: 6, repair: null })).toBe(true);
  });
});

describe('evaluateInterviewCompletionGate', () => {
  const bundle = (n: number) => ({
    pillarScores: { mentalizing: n, repair: 5 },
    pillarConfidence: {},
    keyEvidence: {},
    scenarioName: `S${n}`,
  });

  it('passes when all scenarios and moment 4 have numeric pillars', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: { pillarScores: { commitment_threshold: 5 } },
    });
    expect(r.ok).toBe(true);
  });

  it('passes when Moment 4 was scored but all markers are non-assessable/null', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: {
        pillarScores: {
          contempt_recognition: null,
          contempt_expression: null,
          commitment_threshold: null,
          accountability: null,
          mentalizing: null,
        },
        keyEvidence: {
          contempt_recognition: 'No substantive engagement with grudge/dislike question in this slice.',
          contempt_expression: 'No substantive engagement with grudge/dislike question in this slice.',
          commitment_threshold: 'No substantive engagement with grudge/dislike question in this slice.',
          accountability: 'No substantive engagement with grudge/dislike question in this slice.',
          mentalizing: 'No substantive engagement with grudge/dislike question in this slice.',
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it('fails when a scenario is null', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: null,
      scenario3: bundle(3),
      moment4: { pillarScores: { mentalizing: 5 } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.incomplete_reason).toBe('missing_scenario_2');
  });

  it('fails when moment 4 is missing', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: null,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.incomplete_reason).toBe('missing_moment_4');
  });

  it('fails when Moment 4 has no numeric score and no scored evidence', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: { pillarScores: { mentalizing: null } },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.detail).toContain('moment_4_scores missing scored pillar evidence');
  });
});
