import { describe, expect, it } from '@jest/globals';
import {
  aggregateMarketResearch,
  assignAlgorithmEra,
  computeCronbachAlpha,
  computeFullyCompletedCohortAnalytics,
  computeInterviewCompletedCohortAnalytics,
  computeOverviewAnalytics,
  detectScoreRecovery,
  type AttemptRecord,
  type UserRecord,
} from '../analytics';

describe('analytics', () => {
  it('computes Cronbach alpha when item totals vary', () => {
    const matrix = [
      [3, 4, 5, 6, 7, 8, 6, 5],
      [4, 5, 6, 7, 8, 7, 6, 5],
      [5, 6, 7, 8, 7, 6, 5, 4],
      [6, 7, 8, 7, 6, 5, 4, 3],
      [7, 8, 7, 6, 5, 4, 3, 4],
      [8, 7, 6, 5, 4, 3, 4, 5],
      [7, 6, 5, 4, 3, 4, 5, 6],
      [6, 5, 4, 3, 4, 5, 6, 7],
      [5, 4, 3, 4, 5, 6, 7, 8],
      [4, 3, 4, 5, 6, 7, 8, 7],
      [3, 4, 5, 6, 7, 8, 7, 6],
      [4, 5, 6, 7, 8, 7, 6, 5],
    ];
    const alpha = computeCronbachAlpha(matrix);
    expect(alpha).not.toBeNull();
    expect(Number.isFinite(alpha)).toBe(true);
  });

  it('returns null for insufficient Cronbach sample', () => {
    expect(computeCronbachAlpha([[1, 2], [2, 3]])).toBeNull();
  });

  it('detects score recovery in keyEvidence', () => {
    expect(
      detectScoreRecovery({
        keyEvidence: { mentalizing: 'Score recovered from model output.' },
      }),
    ).toBe(true);
    expect(detectScoreRecovery({ keyEvidence: { mentalizing: 'clear evidence' } })).toBe(false);
  });

  it('assigns algorithm era from created_at', () => {
    expect(assignAlgorithmEra('2026-03-15T00:00:00Z')).toBe('early');
    expect(assignAlgorithmEra('2026-04-15T00:00:00Z')).toBe('mid');
    expect(assignAlgorithmEra('2026-05-15T00:00:00Z')).toBe('current');
  });

  it('returns empty analytics for no attempts', () => {
    const result = computeOverviewAnalytics([], []);
    expect(result.sampleSize.interviewCompletedUsers).toBe(0);
    expect(result.sampleSize.scoredAttempts).toBe(0);
    expect(result.sampleSize.total).toBe(0);
    expect(result.cronbachAlpha.pillars).toBeNull();
  });

  it('counts interview-completed users separately from scored attempts', () => {
    const users: UserRecord[] = [
      {
        id: 'u-scored',
        email: 'scored@test.com',
        full_name: 'Scored',
        display_name: null,
        interview_completed: true,
        interview_completed_at: '2026-05-01T01:00:00Z',
        psychometrics_completed_at: null,
      },
      {
        id: 'u-pending',
        email: 'pending@test.com',
        full_name: 'Pending',
        display_name: null,
        interview_completed: true,
        interview_completed_at: '2026-05-02T01:00:00Z',
        psychometrics_completed_at: null,
      },
    ];
    const attempts: AttemptRecord[] = [
      {
        id: 'a1',
        user_id: 'u-scored',
        created_at: '2026-05-01T00:00:00Z',
        completed_at: '2026-05-01T01:00:00Z',
        weighted_score: 6.5,
        modified_weighted_score: null,
        passed: true,
        final_gate_pass: true,
        pillar_scores: { repair: 7 },
        scenario_1_scores: null,
        scenario_2_scores: null,
        scenario_3_scores: null,
        scenario_composites: null,
        depth_signal_modifier: null,
        score_modifier: null,
        ego_development_level: null,
        disclosure_calibration: null,
        moment_4_concreteness: null,
        moment_5_concreteness: null,
        personal_moment_emotional_vocab_density: null,
        mentalizing_overcertainty_count: null,
        defense_patterns: null,
        emotion_recognition_raw_score: null,
        gate_fail_reasons: null,
        review_flags: null,
        reasoning_pending: null,
        scenario_1_recovered: false,
        scenario_2_recovered: false,
        scenario_3_recovered: false,
        algorithm_era: 'current',
      },
      {
        id: 'a2',
        user_id: 'u-pending',
        created_at: '2026-05-02T00:00:00Z',
        completed_at: '2026-05-02T01:00:00Z',
        weighted_score: null,
        modified_weighted_score: null,
        passed: null,
        final_gate_pass: null,
        pillar_scores: null,
        scenario_1_scores: null,
        scenario_2_scores: null,
        scenario_3_scores: null,
        scenario_composites: null,
        depth_signal_modifier: null,
        score_modifier: null,
        ego_development_level: null,
        disclosure_calibration: null,
        moment_4_concreteness: null,
        moment_5_concreteness: null,
        personal_moment_emotional_vocab_density: null,
        mentalizing_overcertainty_count: null,
        defense_patterns: null,
        emotion_recognition_raw_score: null,
        gate_fail_reasons: null,
        review_flags: null,
        reasoning_pending: null,
        scenario_1_recovered: false,
        scenario_2_recovered: false,
        scenario_3_recovered: false,
        algorithm_era: 'current',
      },
    ];

    const result = computeOverviewAnalytics(attempts, users);
    expect(result.sampleSize.interviewCompletedUsers).toBe(2);
    expect(result.sampleSize.scoredAttempts).toBe(1);
    expect(result.sampleSize.pendingScoringUsers).toBe(1);
    expect(result.userDrilldown).toHaveLength(2);
    expect(result.userDrilldown.find((r) => r.userId === 'u-pending')?.hasScoredAttempt).toBe(false);
  });

  it('uses all interview-completed users for cohort size, not psychometrics subset', () => {
    const users: UserRecord[] = [
      {
        id: 'u1',
        email: 'a@test.com',
        full_name: 'Alice',
        display_name: null,
        interview_completed: true,
        interview_completed_at: '2026-05-01T01:00:00Z',
        psychometrics_completed_at: '2026-05-01T02:00:00Z',
      },
      {
        id: 'u2',
        email: 'b@test.com',
        full_name: 'Bob',
        display_name: null,
        interview_completed: true,
        interview_completed_at: '2026-05-02T01:00:00Z',
        psychometrics_completed_at: null,
      },
    ];
    const attempts: AttemptRecord[] = [
      {
        id: 'a1',
        user_id: 'u1',
        created_at: '2026-05-01T00:00:00Z',
        completed_at: '2026-05-01T01:00:00Z',
        weighted_score: 6.5,
        modified_weighted_score: 6.7,
        modified_weighted_score_with_psychometrics: 6.8,
        passed: true,
        final_gate_pass: true,
        pillar_scores: { repair: 7 },
        scenario_1_scores: null,
        scenario_2_scores: null,
        scenario_3_scores: null,
        scenario_composites: { scenario_1: 6.2 },
        depth_signal_modifier: null,
        score_modifier: null,
        ego_development_level: null,
        disclosure_calibration: null,
        moment_4_concreteness: null,
        moment_5_concreteness: null,
        personal_moment_emotional_vocab_density: null,
        mentalizing_overcertainty_count: null,
        defense_patterns: null,
        emotion_recognition_raw_score: null,
        gate_fail_reasons: null,
        review_flags: null,
        reasoning_pending: null,
        scenario_1_recovered: false,
        scenario_2_recovered: false,
        scenario_3_recovered: false,
        algorithm_era: 'current',
      },
    ];

    const interviewCohort = computeInterviewCompletedCohortAnalytics(attempts, users);
    expect(interviewCohort.cohortSize).toBe(2);
    expect(interviewCohort.scoredUsers).toBe(1);
    expect(interviewCohort.withPsychometricsUsers).toBe(1);

    const fullCohort = computeFullyCompletedCohortAnalytics(attempts, users);
    expect(fullCohort.cohortSize).toBe(1);
  });

  it('computes fully completed cohort averages and timing', () => {
    const users: UserRecord[] = [
      {
        id: 'u1',
        email: 'a@test.com',
        full_name: 'Alice',
        display_name: null,
        interview_completed: true,
        interview_completed_at: '2026-05-01T01:00:00Z',
        psychometrics_completed_at: '2026-05-01T02:00:00Z',
        psychometrics_aaq2_score: 20,
        psychometrics_rses_score: 30,
        psychometrics_brs_score: 4,
        psychometrics_scs_public_score: 25,
        psychometrics_scs_private_score: 22,
        psychometric_modifier: 0.1,
      },
    ];
    const attempts: AttemptRecord[] = [
      {
        id: 'a1',
        user_id: 'u1',
        created_at: '2026-05-01T00:00:00Z',
        completed_at: '2026-05-01T01:00:00Z',
        weighted_score: 6.5,
        modified_weighted_score: 6.7,
        modified_weighted_score_with_psychometrics: 6.8,
        passed: true,
        final_gate_pass: true,
        pillar_scores: { repair: 7, contempt: 6, attunement: 7, regulation: 6, mentalizing: 7, appreciation: 6, accountability: 7, commitment_threshold: 6 },
        scenario_1_scores: {
          pillarScores: {
            mentalizing: 7,
            repair: 6,
            accountability: 7,
            attunement: 6,
            contempt_recognition: 5,
            contempt_expression: 6,
          },
        },
        scenario_2_scores: {
          pillarScores: {
            mentalizing: 6,
            repair: 7,
            accountability: 6,
            attunement: 7,
            appreciation: 8,
            contempt_expression: 5,
          },
        },
        scenario_3_scores: {
          pillarScores: {
            mentalizing: 6,
            repair: 5,
            accountability: 6,
            attunement: 7,
            regulation: 6,
            contempt_expression: 5,
          },
        },
        scenario_composites: { scenario_1: 6.2, scenario_2: 6.4, scenario_3: 6.1 },
        scenario_specific_patterns: {
          moment_4_scores: { pillarScores: { repair: 7, attunement: 6 } },
          moment_5_scores: { pillarScores: { repair: 8, attunement: 7 } },
        },
        depth_signal_modifier: 0.2,
        score_modifier: null,
        ego_development_level: 3,
        disclosure_calibration: 'calibrated',
        moment_4_concreteness: 'moderate',
        moment_5_concreteness: 'high',
        personal_moment_emotional_vocab_density: 0.5,
        mentalizing_overcertainty_count: 0,
        defense_patterns: null,
        emotion_recognition_raw_score: 8,
        gate_fail_reasons: null,
        review_flags: null,
        reasoning_pending: false,
        scenario_1_recovered: false,
        scenario_2_recovered: false,
        scenario_3_recovered: false,
        algorithm_era: 'current',
        response_timings: [{ latency_ms: 1000, duration_ms: 2000 }],
      },
    ];

    const cohort = computeFullyCompletedCohortAnalytics(attempts, users);
    expect(cohort.cohortSize).toBe(1);
    expect(cohort.scoredUsers).toBe(1);
    expect(cohort.withPsychometricsUsers).toBe(1);
    expect(cohort.scoreAverages.weightedScore).toBe(6.5);
    expect(cohort.scoreAverages.modifiedWeightedWithPsychometrics).toBe(6.8);
    expect(cohort.scoreAverages.scenario1).toBe(6.2);
    expect(cohort.timingAverages.interviewMs).toBe(3000);
    expect(cohort.timingAverages.psychometricMs).toBe(3600000);
    expect(cohort.timingAverages.totalProcessMs).toBe(7200000);
    expect(cohort.timingAverages.totalMs).toBeNull();
    expect(cohort.timingAverages.profileEditMs).toBeNull();

    const s1 = cohort.segmentPillarDistributions.find((s) => s.key === 'scenario1');
    expect(s1?.n).toBe(1);
    expect(s1?.pillars.mentalizing?.mean).toBe(7);
    expect(s1?.pillars.repair?.mean).toBe(6);

    const m5 = cohort.segmentPillarDistributions.find((s) => s.key === 'moment5');
    expect(m5?.n).toBe(1);
    expect(m5?.pillars.repair?.mean).toBe(8);
    expect(m5?.pillars.attunement?.mean).toBe(7);
  });

  it('aggregates market research choice and text responses', () => {
    const users: UserRecord[] = [
      {
        id: 'u1',
        email: null,
        full_name: null,
        display_name: null,
        psychometrics_completed_at: null,
        psychometrics_aaq2_score: null,
        psychometrics_rses_score: null,
        psychometrics_brs_score: null,
        psychometrics_scs_public_score: null,
        psychometrics_scs_private_score: null,
        psychometric_modifier: null,
        market_research_completed_at: '2026-05-01T00:00:00Z',
        market_research_referral_source: 'Friend',
        market_research_relationship_seriousness: 'Very seriously',
        market_research_search_duration: '1 to 3 years',
        market_research_dating_status: 'Doing fine',
        market_research_max_spend: '101 - 500',
      },
    ];
    const occupations = new Map([['u1', 'Engineer']]);
    const agg = aggregateMarketResearch(users, occupations);
    expect(agg.totalResponses).toBe(1);
    expect(agg.questions.find((q) => q.id === 'referral')?.options?.[0].value).toBe('Friend');
    expect(agg.questions.find((q) => q.id === 'occupation')?.textResponses).toEqual(['Engineer']);
  });

  it('computes profile questionnaire, edit-profile, and end-to-end timing', () => {
    const users: UserRecord[] = [
      {
        id: 'u1',
        email: 'a@test.com',
        full_name: 'Alice',
        display_name: null,
        interview_completed: true,
        interview_completed_at: '2026-05-01T01:00:00Z',
        psychometrics_completed_at: '2026-05-01T02:00:00Z',
        psychometrics_aaq2_score: 20,
        psychometrics_rses_score: 30,
        psychometrics_brs_score: 4,
        psychometrics_scs_public_score: 25,
        psychometrics_scs_private_score: 22,
        psychometric_modifier: 0.1,
      },
    ];
    const attempts: AttemptRecord[] = [
      {
        id: 'a1',
        user_id: 'u1',
        created_at: '2026-05-01T00:00:00Z',
        completed_at: '2026-05-01T01:00:00Z',
        weighted_score: 6.5,
        modified_weighted_score: 6.7,
        passed: true,
        final_gate_pass: true,
        pillar_scores: { repair: 7 },
        scenario_1_scores: null,
        scenario_2_scores: null,
        scenario_3_scores: null,
        scenario_composites: null,
        scenario_specific_patterns: null,
        depth_signal_modifier: null,
        score_modifier: null,
        ego_development_level: null,
        disclosure_calibration: null,
        moment_4_concreteness: null,
        moment_5_concreteness: null,
        personal_moment_emotional_vocab_density: null,
        mentalizing_overcertainty_count: null,
        defense_patterns: null,
        emotion_recognition_raw_score: null,
        gate_fail_reasons: null,
        review_flags: null,
        reasoning_pending: null,
        scenario_1_recovered: false,
        scenario_2_recovered: false,
        scenario_3_recovered: false,
        algorithm_era: 'current',
        response_timings: [{ latency_ms: 500, duration_ms: 500 }],
      },
    ];
    const profileTiming = new Map([
      [
        'u1',
        {
          assessmentsCompletedAt: '2026-05-01T03:00:00Z',
          onboardingCompletedAt: '2026-05-01T04:00:00Z',
          datingAssessmentActiveMs: 900000,
        },
      ],
    ]);

    const cohort = computeInterviewCompletedCohortAnalytics(attempts, users, profileTiming);
    expect(cohort.timingAverages.interviewMs).toBe(1000);
    expect(cohort.timingAverages.psychometricMs).toBe(3600000);
    expect(cohort.timingAverages.profileQuestionnaireMs).toBe(900000);
    expect(cohort.timingAverages.profileEditMs).toBe(3600000);
    expect(cohort.timingAverages.totalMs).toBe(4 * 3600000);
  });
});
