import { describe, expect, it } from '@jest/globals';
import {
  evaluateInterviewCompletionGate,
  personalMomentBundleWasScored,
  pillarScoresHaveNumericAssessment,
} from '../interviewCompletionGate';
import { mergeMoment5PillarScoresAfterEvidenceNormalize } from '../probeAndScoringUtils';

describe('pillarScoresHaveNumericAssessment', () => {
  it('returns false when all null', () => {
    expect(pillarScoresHaveNumericAssessment({ mentalizing: null, repair: null })).toBe(false);
  });
  it('returns true when any finite number', () => {
    expect(pillarScoresHaveNumericAssessment({ mentalizing: 6, repair: null })).toBe(true);
  });
});

describe('personalMomentBundleWasScored', () => {
  it('returns false when merged Moment 5 null bundle has empty keyEvidence', () => {
    expect(
      personalMomentBundleWasScored({
        pillarScores: mergeMoment5PillarScoresAfterEvidenceNormalize({}),
        keyEvidence: {},
      }),
    ).toBe(false);
  });

  it('returns true when merged Moment 5 null bundle has substantive keyEvidence', () => {
    expect(
      personalMomentBundleWasScored({
        pillarScores: mergeMoment5PillarScoresAfterEvidenceNormalize({}),
        keyEvidence: { accountability: 'User named repair moves after the rupture.' },
      }),
    ).toBe(true);
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

  it('passes when Moment 4 pillarScores is empty after evidence filter but keyEvidence documents assessment', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: {
        pillarScores: {},
        keyEvidence: {
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

  it('fails when transcript reached Moment 5 but moment_5_scores are missing', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: { pillarScores: { commitment_threshold: 5 } },
      moment5: null,
      transcript: [
        { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
        { role: 'user', content: 'My roommate Christy and I argued about dishes for weeks.' },
      ],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.incomplete_reason).toBe('missing_moment_5');
      expect(r.missingMoment5).toBe(true);
    }
  });

  it('passes when thin skip/meta answers after M5 question do not require moment_5_scores', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: { pillarScores: { commitment_threshold: 5 } },
      moment5: null,
      transcript: [
        { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
        { role: 'user', content: 'Can we skip this one?' },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it('passes when transcript never reached Moment 5 without moment_5_scores', () => {
    const r = evaluateInterviewCompletionGate({
      scenario1: bundle(1),
      scenario2: bundle(2),
      scenario3: bundle(3),
      moment4: { pillarScores: { commitment_threshold: 5 } },
      moment5: null,
      transcript: [
        { role: 'assistant', content: 'What do you think is going on here?' },
        { role: 'user', content: 'Emma felt dismissed.' },
      ],
    });
    expect(r.ok).toBe(true);
  });
});
