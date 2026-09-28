import {
  classifyAdminUserListStatus,
  computeCohortHeaderStats,
  filterAdminUserCohort,
  getCohortActivityTimestampMs,
  localDayRangeFromYmd,
  toggleAdminStatusFilterSelection,
  trimLaunchNotificationPhone,
  userGroupInNearMissWeightedBand,
  userGroupMatchesNeedsReviewQuickFilter,
  userGroupMatchesSearchQuery,
  userMatchesAdminStatusFilter,
  userMatchesTimeRange,
} from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import type { UserGroup } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

function makeGroup(overrides: Partial<UserGroup['user']> = {}, latestAttempt: UserGroup['latestAttempt'] = null): UserGroup {
  return {
    user: {
      id: 'u1',
      email: 'test@example.com',
      ...overrides,
    },
    attempts: latestAttempt ? [latestAttempt] : [],
    latestAttempt,
  };
}

describe('adminInterviewDashboardCohortUtils', () => {
  it('trimLaunchNotificationPhone returns null for empty strings', () => {
    expect(trimLaunchNotificationPhone('')).toBeNull();
    expect(trimLaunchNotificationPhone('  ')).toBeNull();
    expect(trimLaunchNotificationPhone('+1 555-0100')).toBe('+1 555-0100');
  });

  it('localDayRangeFromYmd rejects invalid dates', () => {
    expect(localDayRangeFromYmd('not-a-date')).toBeNull();
    expect(localDayRangeFromYmd('2024-02-30')).toBeNull();
  });

  it('getCohortActivityTimestampMs prefers interview_completed_at', () => {
    const completedAt = '2024-06-15T12:00:00.000Z';
    const g = makeGroup(
      { interview_completed: true, interview_completed_at: completedAt },
      {
        id: 'a1',
        user_id: 'u1',
        attempt_number: 1,
        created_at: '2024-01-01T00:00:00.000Z',
        completed_at: '2024-01-02T00:00:00.000Z',
        weighted_score: null,
        passed: null,
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
      },
    );
    expect(getCohortActivityTimestampMs(g)).toBe(new Date(completedAt).getTime());
  });

  it('userMatchesTimeRange returns true for all range', () => {
    const g = makeGroup();
    expect(userMatchesTimeRange(g, 'all', '', '')).toBe(true);
  });

  it('userGroupMatchesSearchQuery matches email substring', () => {
    const g = makeGroup({ email: 'alice@amoraea.com' });
    expect(userGroupMatchesSearchQuery(g, 'alice')).toBe(true);
    expect(userGroupMatchesSearchQuery(g, 'bob')).toBe(false);
  });

  it('classifyAdminUserListStatus detects in-progress interviews', () => {
    const g = makeGroup({ interview_completed: false, latest_attempt_id: 'a1' });
    expect(classifyAdminUserListStatus(g)).toBe('in_progress');
  });

  it('classifyAdminUserListStatus does not treat scored completed attempt as in progress', () => {
    const g = makeGroup(
      { interview_completed: false, latest_attempt_id: 'a1' },
      {
        id: 'a1',
        user_id: 'u1',
        attempt_number: 1,
        created_at: '2026-07-29T03:19:13.369724+00:00',
        completed_at: '2026-07-29T03:42:22.732+00:00',
        weighted_score: 5.2,
        passed: false,
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
      },
    );
    expect(classifyAdminUserListStatus(g)).toBe('fail');
  });

  it('filterAdminUserCohort respects hideIncomplete', () => {
    const done = makeGroup({ interview_completed: true });
    const open = makeGroup({ id: 'u2', interview_completed: false });
    const filtered = filterAdminUserCohort([done, open], {
      timeRangeFilter: 'all',
      customTimeFrom: '',
      customTimeTo: '',
      bookmarkCohortFilter: 'all',
      humanVerifiedCohortFilter: 'all',
      uncertaintyBandFilter: 'all',
      hideIncomplete: true,
      statusFilters: [],
      needsReviewQuickFilter: false,
      userSearchQuery: '',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.user.id).toBe('u1');
  });

  it('filterAdminUserCohort supports multi-select status exclusion (all except fail)', () => {
    const pass = makeGroup(
      { id: 'pass', interview_completed: true },
      {
        id: 'a-pass',
        user_id: 'pass',
        attempt_number: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T01:00:00.000Z',
        weighted_score: 7,
        passed: true,
        reasoning_pending: null,
        pillar_scores: { empathy: 7 },
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
      },
    );
    const fail = makeGroup(
      { id: 'fail', interview_completed: true },
      {
        id: 'a-fail',
        user_id: 'fail',
        attempt_number: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T01:00:00.000Z',
        weighted_score: 5,
        passed: false,
        reasoning_pending: null,
        pillar_scores: { empathy: 5 },
        override_status: null,
        override_set_at: null,
        scenario_composites: null,
        scenario_floor_grandfather_review: null,
        gate_fail_reasons: ['weighted_score'],
        gate_fail_detail: { weighted_score: { score: 5, requiredMin: 6.5 } },
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
      },
    );
    const filtered = filterAdminUserCohort([pass, fail], {
      timeRangeFilter: 'all',
      customTimeFrom: '',
      customTimeTo: '',
      bookmarkCohortFilter: 'all',
      humanVerifiedCohortFilter: 'all',
      uncertaintyBandFilter: 'all',
      hideIncomplete: false,
      statusFilters: ['pass', 'almost', 'in_progress', 'no_result', 'incomplete'],
      needsReviewQuickFilter: false,
      userSearchQuery: '',
    });
    expect(filtered.map((g) => g.user.id)).toEqual(['pass']);
  });

  it('needs review quick filter matches near-miss band, almost, and review flags', () => {
    const nearMiss = makeGroup(
      { id: 'near', interview_completed: true },
      {
        id: 'a-near',
        user_id: 'near',
        attempt_number: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T01:00:00.000Z',
        weighted_score: 6.2,
        passed: false,
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
      },
    );
    expect(userGroupInNearMissWeightedBand(nearMiss)).toBe(true);
    expect(userGroupMatchesNeedsReviewQuickFilter(nearMiss)).toBe(true);

    const flagged = makeGroup(
      { id: 'flagged', interview_completed: true },
      {
        ...nearMiss.latestAttempt!,
        id: 'a-flagged',
        user_id: 'flagged',
        review_flags: ['defense_pattern_review'],
        weighted_score: 7,
      },
    );
    expect(userGroupMatchesNeedsReviewQuickFilter({ ...flagged, latestAttempt: flagged.latestAttempt })).toBe(true);
  });

  it('toggleAdminStatusFilterSelection supports multi-select toggling', () => {
    expect(toggleAdminStatusFilterSelection([], 'pass')).toEqual(['pass']);
    expect(toggleAdminStatusFilterSelection(['pass'], 'pass')).toEqual([]);
    expect(toggleAdminStatusFilterSelection(['pass', 'almost'], 'all')).toEqual([]);
  });

  it('userMatchesAdminStatusFilter detects flagged users', () => {
    const g = makeGroup(
      { interview_completed: true },
      {
        id: 'a1',
        user_id: 'u1',
        attempt_number: 1,
        created_at: '2026-01-01T00:00:00.000Z',
        completed_at: '2026-01-01T01:00:00.000Z',
        weighted_score: 7,
        passed: true,
        reasoning_pending: null,
        pillar_scores: null,
        override_status: null,
        override_set_at: null,
        scenario_composites: null,
        scenario_floor_grandfather_review: null,
        gate_fail_reasons: null,
        gate_fail_detail: null,
        mentalizing_repair_floor_grandfather_review: null,
        review_flags: ['defense_pattern_review'],
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
      },
    );
    expect(userMatchesAdminStatusFilter(g, 'flagged')).toBe(true);
    expect(userMatchesAdminStatusFilter(g, 'fail')).toBe(false);
  });

  it('computeCohortHeaderStats counts started users', () => {
    const g = makeGroup({ latest_attempt_id: 'a1' });
    expect(computeCohortHeaderStats([g]).started).toBe(1);
  });
});
