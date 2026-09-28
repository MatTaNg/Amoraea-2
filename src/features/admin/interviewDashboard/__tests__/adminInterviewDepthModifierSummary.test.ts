import { buildAdminPassFailPlainLanguageSummary, collectAdminNegativeScoreModifiers } from '@features/admin/interviewDashboard/adminInterviewDepthModifierSummary';
import type { AttemptRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

function makeAttempt(overrides: Partial<AttemptRow> = {}): AttemptRow {
  return {
    id: 'attempt-1',
    user_id: 'user-1',
    attempt_number: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    completed_at: '2026-01-01T01:00:00.000Z',
    weighted_score: 6.3,
    passed: false,
    pillar_scores: { empathy: 6, mentalizing: 6, repair: 6, accountability: 6, contempt: 6 },
    scenario_1_scores: null,
    scenario_2_scores: null,
    scenario_3_scores: null,
    score_consistency: null,
    construct_asymmetry: null,
    response_timings: null,
    dropout_point: null,
    language_markers: null,
    ai_reasoning: null,
    user_analysis_rating: null,
    user_analysis_comment: null,
    per_construct_ratings: null,
    transcript: null,
    reasoning_pending: null,
    override_status: null,
    override_set_at: null,
    scenario_composites: null,
    scenario_floor_grandfather_review: null,
    gate_fail_reasons: ['weighted_score'],
    gate_fail_detail: { weighted_score: { score: 6.3, requiredMin: 6.5 } },
    mentalizing_repair_floor_grandfather_review: null,
    review_flags: null,
    score_modifier: -0.2,
    depth_signal_modifier: -0.2,
    modified_weighted_score: 6.1,
    psychometric_modifier_applied: null,
    modified_weighted_score_with_psychometrics: null,
    final_gate_pass: null,
    ego_development_level: 1,
    defense_patterns: {
      projection_detected: false,
      rationalization_detected: true,
      splitting_detected: false,
      denial_detected: false,
    },
    moment_4_concreteness: 'low',
    moment_5_concreteness: 'absent',
    personal_moment_emotional_vocab_low: null,
    disclosure_calibration: null,
    mentalizing_overcertainty_count: null,
    emotion_recognition_raw_score: null,
    emotion_recognition_score: null,
    emotion_recognition_responses: null,
    uncertainty_score: null,
    requires_clarification_battery: null,
    post_clarification_uncertainty_score: null,
    uncertainty_pending_admin_review: null,
    ...overrides,
  };
}

describe('adminInterviewDepthModifierSummary', () => {
  it('buildAdminPassFailPlainLanguageSummary states fail reason with score and threshold', () => {
    const summary = buildAdminPassFailPlainLanguageSummary(null, makeAttempt());
    expect(summary).toMatch(/Failed:/i);
    expect(summary).toMatch(/6\.3/);
    expect(summary).toMatch(/6\.5/);
  });

  it('collectAdminNegativeScoreModifiers ranks negative modifiers by magnitude', () => {
    const modifiers = collectAdminNegativeScoreModifiers(makeAttempt());
    expect(modifiers.length).toBeGreaterThan(0);
    expect(modifiers.every((m) => m.value < 0)).toBe(true);
    for (let i = 1; i < modifiers.length; i++) {
      expect(modifiers[i]!.value).toBeGreaterThanOrEqual(modifiers[i - 1]!.value);
    }
  });
});
