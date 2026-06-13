import { describe, expect, it } from '@jest/globals';
import {
  aggregateMarketResearch,
  assignAlgorithmEra,
  computeCronbachAlpha,
  computeFullyCompletedCohortAnalytics,
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
    expect(result.sampleSize.total).toBe(0);
    expect(result.cronbachAlpha.pillars).toBeNull();
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
    expect(cohort.scoreAverages.weightedScore).toBe(6.5);
    expect(cohort.scoreAverages.modifiedWeightedWithPsychometrics).toBe(6.8);
    expect(cohort.scoreAverages.scenario1).toBe(6.2);
    expect(cohort.timingAverages.interviewMs).toBe(3000);
    expect(cohort.timingAverages.psychometricMs).toBe(3600000);
    expect(cohort.timingAverages.totalProcessMs).toBe(7200000);

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
});
