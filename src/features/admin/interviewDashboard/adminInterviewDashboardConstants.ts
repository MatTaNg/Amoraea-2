import type { AdminAttemptInnerTabId } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export const PILLAR_ROWS = [
  { id: 'mentalizing', constructKey: 'mentalizing', label: 'Mentalizing', short: 'Men' },
  { id: 'accountability', constructKey: 'accountability', label: 'Accountability', short: 'Acc' },
  { id: 'contempt', constructKey: 'contempt', label: 'Contempt', short: 'Con' },
  { id: 'repair', constructKey: 'repair', label: 'Repair', short: 'Rep' },
  { id: 'regulation', constructKey: 'regulation', label: 'Regulation', short: 'Reg' },
  { id: 'attunement', constructKey: 'attunement', label: 'Attunement', short: 'Att' },
  { id: 'appreciation', constructKey: 'appreciation', label: 'Appreciation', short: 'App' },
  { id: 'commitment_threshold', constructKey: 'commitment_threshold', label: 'Commitment Threshold', short: 'Com' },
] as const;

export const MARKER_IDS = PILLAR_ROWS.map((p) => p.id);

export const ASSESSED_MARKERS_BY_SECTION: Record<string, string[]> = {
  scenario_1: ['mentalizing', 'accountability', 'contempt', 'repair', 'attunement', 'appreciation'],
  scenario_2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt'],
  scenario_3: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'commitment_threshold', 'contempt'],
  moment_4: ['contempt', 'commitment_threshold', 'accountability', 'mentalizing'],
  moment_5: ['accountability', 'mentalizing', 'repair', 'regulation', 'contempt_expression'],
};

export const SLICE_CONTEMPT_EXTRA_KEYS = ['contempt_recognition', 'contempt_expression'] as const;

export const COMMUNICATION_STYLE_INITIAL_POLL_ATTEMPTS = 8;
export const COMMUNICATION_STYLE_INITIAL_POLL_DELAY_MS = 1200;

export const ADMIN_USERS_LIST_SELECT = `
      id,
      email,
      full_name,
      name,
      display_name,
      basic_info,
      created_at,
      latest_attempt_id,
      interview_completed,
      interview_passed,
      interview_passed_computed,
      interview_passed_admin_override,
      interview_cohort_admin_reviewed,
      admin_human_verified_pass,
      interview_completed_at,
      interview_retake_admin_allowed_at,
      interview_attempt_count,
      launch_notification_phone,
      psychometrics_sd3_narcissism_score,
      psychometric_straight_line_flags,
      psychometrics_rfq_score,
      psychometrics_gasp_score,
      psychometrics_dweck_score,
      psychometrics_scs_sf_score,
      validation_track,
      validation_standard_app_enrolled
    `;

/** When 20260628140000_users_psychometrics_sd3_narcissism.sql has not been applied yet. */
export const ADMIN_USERS_LIST_SELECT_WITHOUT_SD3_RFQ = `
      id,
      email,
      full_name,
      name,
      display_name,
      basic_info,
      created_at,
      latest_attempt_id,
      interview_completed,
      interview_passed,
      interview_passed_computed,
      interview_passed_admin_override,
      interview_cohort_admin_reviewed,
      admin_human_verified_pass,
      interview_completed_at,
      interview_retake_admin_allowed_at,
      interview_attempt_count,
      launch_notification_phone,
      psychometric_straight_line_flags,
      psychometrics_gasp_score,
      psychometrics_dweck_score,
      psychometrics_scs_sf_score,
      validation_track,
      validation_standard_app_enrolled
    `;

export const ADMIN_USER_LEVEL_INNER_TABS = new Set<AdminAttemptInnerTabId>([
  'profile_intent',
  'dating_profile',
]);

export function adminDetailTabs(): { id: AdminAttemptInnerTabId; label: string }[] {
  return [
    { id: 'summary', label: 'Tab 1: Summary' },
    { id: 'reasoning', label: 'Tab 2: AI Reasoning' },
    { id: 'transcript', label: 'Tab 3: Transcript' },
    { id: 'depth', label: 'Tab 4: Depth Signals' },
    { id: 'profile_intent', label: 'Profile & Intent' },
    { id: 'dating_profile', label: 'Dating Profile' },
    { id: 'full_assessment', label: 'Full Assessment' },
  ];
}
