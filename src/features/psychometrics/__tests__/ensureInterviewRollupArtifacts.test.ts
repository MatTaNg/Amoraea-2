import { describe, expect, it } from '@jest/globals';

import {
  attemptRowMissingRollupArtifacts,
  attemptRowMissingScenarioComposites,
  buildPartialInterviewRollupPatchFromAttemptRow,
  buildFullInterviewRollupPatchFromAttemptRow,
  buildInterviewRollupArtifactBackfillPatch,
  buildScenarioCompositesBackfillFromAttemptRow,
  evaluateScoringStagesReadyForRollup,
  markScoringStageComplete,
  transcriptReachedMoment5ForRollup,
} from '@features/psychometrics/ensureInterviewRollupArtifacts';

describe('ensureInterviewRollupArtifacts', () => {
  const scenarioBundle = {
    pillar_scores: { accountability: 5, repair: 6, mentalizing: 7, attunement: 6 },
  };

  const scoredMoment = {
    pillarScores: { commitment_threshold: 7, mentalizing: 6 },
    keyEvidence: { commitment_threshold: 'Would leave if pattern continues.' },
  };

  it('detects missing rollup artifacts', () => {
    expect(attemptRowMissingRollupArtifacts({ scenario_composites: null, defense_cross_reference: null })).toBe(
      true,
    );
    expect(
      attemptRowMissingRollupArtifacts({
        scenario_composites: { scenario_1: 5.5, scenario_2: 6, scenario_3: 6.2 },
        defense_cross_reference: { flags: [], overallConfidence: 'high' },
        defense_patterns: {
          projection_detected: false,
          splitting_detected: false,
          rationalization_detected: false,
          denial_detected: false,
        },
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
      }),
    ).toBe(false);
  });

  it('treats all-null scenario_composites as missing (not present)', () => {
    expect(
      attemptRowMissingScenarioComposites({
        scenario_composites: { scenario_1: null, scenario_2: null, scenario_3: null },
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
      }),
    ).toBe(true);
  });

  it('treats partial scenario_composites as missing when all three scenario scores exist', () => {
    expect(
      attemptRowMissingScenarioComposites({
        scenario_composites: { scenario_1: 6, scenario_2: null, scenario_3: null },
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
      }),
    ).toBe(true);
  });

  it('builds scenario composites from stored scenario bundles', () => {
    const composites = buildScenarioCompositesBackfillFromAttemptRow({
      scenario_1_scores: scenarioBundle,
      scenario_2_scores: scenarioBundle,
      scenario_3_scores: scenarioBundle,
    });
    expect(composites).toEqual({
      scenario_1: 6,
      scenario_2: 6,
      scenario_3: 6,
    });
  });

  it('builds defense cross-reference default when missing', () => {
    const patch = buildInterviewRollupArtifactBackfillPatch({
      scenario_composites: null,
      defense_cross_reference: null,
      defense_patterns: {
        projection_detected: false,
        splitting_detected: false,
        rationalization_detected: false,
        denial_detected: false,
      },
      scenario_1_scores: scenarioBundle,
      scenario_2_scores: scenarioBundle,
      scenario_3_scores: scenarioBundle,
      modified_weighted_score: 6.2,
    });
    expect(patch.scenario_composites).toEqual({
      scenario_1: 6,
      scenario_2: 6,
      scenario_3: 6,
    });
    expect(patch.defense_cross_reference).toMatchObject({
      overallConfidence: expect.any(String),
      flags: expect.any(Array),
      modifierAdjustment: expect.any(Number),
      recommendAdminReview: expect.any(Boolean),
    });
  });

  it('buildFullInterviewRollupPatch fills composites + defense_* from scenario scores', () => {
    const patch = buildFullInterviewRollupPatchFromAttemptRow(
      {
        scenario_composites: null,
        defense_cross_reference: null,
        defense_patterns: {},
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
        depth_signal_modifier: 0.1,
        gate_fail_reasons: null,
      },
      null,
      {
        ego_development_level: 3,
        disclosure_calibration: 'calibrated',
        personal_moment_emotional_vocab_density: 1.5,
      },
    );
    expect(patch.scenario_composites).toEqual({
      scenario_1: 6,
      scenario_2: 6,
      scenario_3: 6,
    });
    expect(patch.defense_patterns).toMatchObject({
      projection_detected: false,
      denial_detected: false,
    });
    expect(patch.defense_cross_reference).toMatchObject({
      overallConfidence: expect.any(String),
    });
    expect(patch.ego_development_level).toBe(3);
    expect(patch.disclosure_calibration).toBe('calibrated');
    expect(patch.personal_moment_emotional_vocab_density).toBe(1.5);
    expect(patch.gate_fail_reasons).toEqual([]);
  });

  describe('evaluateScoringStagesReadyForRollup', () => {
    it('is not ready when M5 was reached but moment_5_scores are missing', () => {
      const r = evaluateScoringStagesReadyForRollup({
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
        scenario_specific_patterns: { moment_4_scores: scoredMoment },
        transcript: [
          { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
          { role: 'user', content: 'I got into a fight with my partner last week and I apologized.' },
        ],
      });
      expect(r.ready).toBe(false);
      expect(r.missing).toContain('moment5');
    });

    it('is ready when S1–S3 + M4 + M5 are scored', () => {
      const r = evaluateScoringStagesReadyForRollup({
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
        scenario_specific_patterns: {
          moment_4_scores: scoredMoment,
          moment_5_scores: {
            pillarScores: { accountability: 6 },
            keyEvidence: { accountability: 'I owned my part.' },
          },
        },
        transcript: [
          { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
          { role: 'user', content: 'I got into a fight with my partner last week and I apologized.' },
        ],
      });
      expect(r.ready).toBe(true);
      expect(r.missing).toEqual([]);
    });

    it('treats M5 as complete when transcript never reached Moment 5', () => {
      const r = evaluateScoringStagesReadyForRollup({
        scenario_1_scores: scenarioBundle,
        scenario_2_scores: scenarioBundle,
        scenario_3_scores: scenarioBundle,
        scenario_specific_patterns: { moment_4_scores: scoredMoment },
        transcript: [
          { role: 'assistant', content: 'What do you think is going on here?' },
          { role: 'user', content: 'Emma felt dismissed.' },
        ],
      });
      expect(r.state.moment5Complete).toBe(true);
      expect(r.ready).toBe(true);
    });
  });

  it('transcriptReachedMoment5ForRollup detects primary conflict question + user answer', () => {
    expect(
      transcriptReachedMoment5ForRollup([
        { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
        { role: 'user', content: 'My coworker and I argued about a project deadline last week.' },
      ]),
    ).toBe(true);
    expect(
      transcriptReachedMoment5ForRollup([
        { role: 'user', content: 'Emma felt dismissed.', interviewMoment: 1 },
      ]),
    ).toBe(false);
  });

  it('does not treat thin skip/meta M5 turns as assessable for rollup', () => {
    const thinTranscript = [
      { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
      { role: 'user', content: 'Ah, the conflict wins.' },
      { role: 'user', content: 'Can we skip this one?' },
    ];
    expect(transcriptReachedMoment5ForRollup(thinTranscript)).toBe(false);
    const rollup = evaluateScoringStagesReadyForRollup({
      scenario_1_scores: scenarioBundle,
      scenario_2_scores: scenarioBundle,
      scenario_3_scores: scenarioBundle,
      scenario_specific_patterns: { moment_4_scores: scoredMoment },
      transcript: thinTranscript,
    });
    expect(rollup.missing).not.toContain('moment5');
    expect(rollup.state.moment5Complete).toBe(true);
  });

  it('buildPartialInterviewRollupPatchFromAttemptRow fills composites without Moment 5', () => {
    const patch = buildPartialInterviewRollupPatchFromAttemptRow({
      scenario_1_scores: scenarioBundle,
      scenario_2_scores: scenarioBundle,
      scenario_3_scores: scenarioBundle,
      scenario_specific_patterns: { moment_4_scores: scoredMoment },
      scenario_composites: null,
      defense_patterns: {},
      defense_cross_reference: null,
      transcript: [
        { role: 'assistant', content: 'Think of a time when you had a conflict with someone important to you.' },
        { role: 'user', content: 'My roommate and I argued about chores.' },
      ],
    });
    expect(patch.scenario_composites).not.toBeNull();
    expect(patch.defense_patterns).toEqual({
      projection_detected: false,
      rationalization_detected: false,
      splitting_detected: false,
      denial_detected: false,
    });
    expect(patch.defense_cross_reference).not.toBeNull();
  });

  it('markScoringStageComplete defers full rollup but writes partial scenario artifacts when M5 pending', async () => {
    const update = jest.fn().mockReturnValue({
      eq: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    });
    const attemptRow = {
      scenario_1_scores: scenarioBundle,
      scenario_2_scores: scenarioBundle,
      scenario_3_scores: scenarioBundle,
      scenario_specific_patterns: { moment_4_scores: scoredMoment },
      transcript: [
        {
          role: 'assistant',
          content: 'Think of a time when you had a conflict with someone important to you.',
        },
        { role: 'user', content: 'My partner and I had a long argument about money last week.' },
      ],
      scenario_composites: null,
      defense_cross_reference: null,
      defense_patterns: null,
    };
    const maybeSingle = jest
      .fn()
      .mockResolvedValueOnce({ data: attemptRow, error: null })
      .mockResolvedValueOnce({ data: attemptRow, error: null });
    const supabase = {
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle }),
            maybeSingle,
          }),
        }),
        update,
      }),
    };

    const result = await markScoringStageComplete(supabase, 'attempt-1', 'user-1', 'scenario1', {
      trigger: 'test',
    });
    expect(result.skipped).toMatch(/stages_incomplete/);
    expect(update).toHaveBeenCalled();
    const patch = update.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(patch.scenario_composites).toBeDefined();
    expect(patch.defense_patterns).toBeDefined();
  });
});
