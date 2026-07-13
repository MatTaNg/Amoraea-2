import type { AttemptSummary } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import {
  getPassColor,
  getPassWord,
  resolveAdminPrimaryOutcomeDisplay,
} from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { formatScoreCell } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';

function makeAttemptSummary(passed: boolean | null): AttemptSummary {
  return {
    id: 'a1',
    user_id: 'u1',
    attempt_number: 1,
    created_at: '2024-01-01T00:00:00.000Z',
    completed_at: '2024-01-02T00:00:00.000Z',
    weighted_score: 7.5,
    passed,
    reasoning_pending: null,
    pillar_scores: null,
    override_status: null,
    override_set_at: null,
    scenario_composites: null,
    scenario_floor_grandfather_review: null,
    gate_fail_reasons: null,
    gate_fail_detail: null,
    mentalizing_repair_floor_grandfather_review: null,
    review_flags: null,
    score_modifier: null,
    depth_signal_modifier: null,
    modified_weighted_score: null,
    psychometric_modifier_applied: null,
    modified_weighted_score_with_psychometrics: null,
    final_gate_pass: null,
    ego_development_level: null,
    defense_patterns: null,
    moment_4_concreteness: null,
    moment_5_concreteness: null,
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
  };
}

describe('adminInterviewDashboardScoreUtils', () => {
  it('formatScoreCell renders em dash for missing values', () => {
    expect(formatScoreCell(null)).toBe('—');
    expect(formatScoreCell(7.25)).toBe('7.3');
  });
});

describe('adminInterviewDashboardGateDisplay', () => {
  it('getPassWord maps attempt.passed', () => {
    expect(getPassWord(makeAttemptSummary(true))).toBe('pass');
    expect(getPassWord(makeAttemptSummary(false))).toBe('fail');
    expect(getPassWord(null)).toBe('none');
  });

  it('resolveAdminPrimaryOutcomeDisplay honors admin override', () => {
    const attempt = makeAttemptSummary(false);
    const display = resolveAdminPrimaryOutcomeDisplay(
      { interview_passed: true, interview_passed_computed: false, interview_passed_admin_override: true },
      attempt,
    );
    expect(display.word).toBe('pass');
    expect(display.color).toBe(getPassColor('pass'));
  });
});
