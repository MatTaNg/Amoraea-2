import type {
  AdminUserStatusFilter,
  BookmarkCohortFilter,
  HumanVerifiedCohortFilter,
  TimeRangeFilter,
  UncertaintyBandFilter,
  UserGroup,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export const STATUS_FILTER_OPTIONS: { id: AdminUserStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'pass', label: 'Pass' },
  { id: 'fail', label: 'Fail' },
  { id: 'almost', label: 'Almost' },
  { id: 'no_result', label: 'No result' },
  { id: 'flagged', label: 'Flagged' },
  { id: 'er_floor_review', label: 'ER floor review' },
  { id: 'sd3_narcissism_floor_review', label: 'SD3 narcissism floor review' },
  { id: 'psychometric_floor_review', label: 'Psych floor review' },
];

export const TIME_RANGE_OPTIONS: { id: TimeRangeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: '24h' },
  { id: 'three_days', label: '3d' },
  { id: 'week', label: '7d' },
  { id: 'month', label: '30d' },
  { id: 'custom', label: 'Custom' },
];

export const BOOKMARK_COHORT_OPTIONS: { id: BookmarkCohortFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bookmarked', label: 'Yes' },
  { id: 'not_bookmarked', label: 'No' },
];

export const HUMAN_VERIFIED_COHORT_OPTIONS: { id: HumanVerifiedCohortFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pass', label: 'Pass' },
  { id: 'fail', label: 'Fail' },
  { id: 'unset', label: 'Unset' },
];

export const UNCERTAINTY_BAND_OPTIONS: { id: UncertaintyBandFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'low', label: 'Low (<0.4)' },
  { id: 'medium', label: 'Medium' },
  { id: 'high', label: 'High (≥0.6)' },
];

export const USER_LIST_SORT_OPTIONS = [
  { id: 'date', label: 'Date' },
  { id: 'uncertainty', label: 'Uncertainty' },
] as const;
