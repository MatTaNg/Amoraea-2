import { describe, expect, it } from 'vitest';
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
});
