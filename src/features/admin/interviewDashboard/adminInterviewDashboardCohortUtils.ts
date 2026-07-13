import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import { isLegacyEmotionRecognitionFloorOnlyFail } from '@features/aria/emotionRecognitionInterview';
import {
  resolveAdminPrimaryOutcomeDisplay,
  reviewFlagsFromStoredAttempt,
} from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { UNCERTAINTY_ROUTING_THRESHOLD } from '@features/psychometrics/computeUncertaintyScore';
import { userNeedsPsychometricFloorReview } from '@features/psychometrics/psychometricFloorBreaches';
import type {
  AdminUserStatusFilter,
  AttemptSummary,
  BookmarkCohortFilter,
  HumanVerifiedCohortFilter,
  TimeRangeFilter,
  UncertaintyBandFilter,
  UserGroup,
  UserListSort,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function trimLaunchNotificationPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== 'string') return null;
  const t = phone.trim();
  return t.length > 0 ? t : null;
}

export function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive start/end of local calendar day for a YYYY-MM-DD string, or null if invalid. */
export function localDayRangeFromYmd(ymd: string): { start: number; end: number } | null {
  const t = ymd.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const s = new Date(y, mo - 1, d, 0, 0, 0, 0);
  if (s.getFullYear() !== y || s.getMonth() !== mo - 1 || s.getDate() !== d) return null;
  const e = new Date(y, mo - 1, d, 23, 59, 59, 999);
  return { start: s.getTime(), end: e.getTime() };
}

export function getCohortActivityTimestampMs(g: UserGroup): number {
  if (g.user.interview_completed === true && g.user.interview_completed_at) {
    const t = new Date(g.user.interview_completed_at).getTime();
    if (Number.isFinite(t)) return t;
  }
  const a = g.latestAttempt;
  if (a) {
    const raw = a.completed_at ?? a.created_at;
    const t2 = new Date(raw).getTime();
    if (Number.isFinite(t2)) return t2;
  }
  return 0;
}

export function userMatchesTimeRange(
  g: UserGroup,
  range: TimeRangeFilter,
  customFrom: string,
  customTo: string,
): boolean {
  if (range === 'all') return true;
  const ts = getCohortActivityTimestampMs(g);
  if (ts <= 0) return false;
  if (range === 'day' || range === 'three_days' || range === 'week' || range === 'month') {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const start =
      range === 'day'
        ? now - dayMs
        : range === 'three_days'
          ? now - 3 * dayMs
          : range === 'week'
            ? now - 7 * dayMs
            : now - 30 * dayMs;
    return ts >= start;
  }
  if (range === 'custom') {
    const a = localDayRangeFromYmd(customFrom);
    const b = localDayRangeFromYmd(customTo);
    if (!a || !b) {
      // While inputs are incomplete or invalid, do not apply a time window (matches prior “all time” for this cohort).
      return true;
    }
    const lo = Math.min(a.start, b.start);
    const hi = Math.max(a.end, b.end);
    return ts >= lo && ts <= hi;
  }
  return true;
}

/** True when the account has an unfinished interview (active attempt row, not yet completed on `users`). */
export function userHasInProgressInterview(
  user: UserRow,
  latestAttempt?: AttemptSummary | null,
): boolean {
  if (user.interview_completed === true) return false;
  if (latestAttempt != null && latestAttempt.completed_at == null) return true;
  return !!user.latest_attempt_id;
}

export function hasStartedInterviewCohort(g: UserGroup): boolean {
  if (userHasInProgressInterview(g.user, g.latestAttempt)) return true;
  if (g.latestAttempt != null) return true;
  return !!g.user.latest_attempt_id;
}

export function sortUserGroups(list: UserGroup[], sort: UserListSort): UserGroup[] {
  if (sort === 'date') return list;
  return [...list].sort((a, b) => {
    const sa = a.latestAttempt?.uncertainty_score;
    const sb = b.latestAttempt?.uncertainty_score;
    const na = sa != null && Number.isFinite(sa) ? sa : -1;
    const nb = sb != null && Number.isFinite(sb) ? sb : -1;
    return nb - na;
  });
}

export function userMatchesHumanVerifiedCohortFilter(
  g: UserGroup,
  filter: HumanVerifiedCohortFilter,
): boolean {
  if (filter === 'all') return true;
  const v = g.user.admin_human_verified_pass;
  if (filter === 'pass') return v === true;
  if (filter === 'fail') return v === false;
  if (filter === 'unset') return v == null;
  return true;
}

export function userMatchesUncertaintyFilter(g: UserGroup, filter: UncertaintyBandFilter): boolean {
  if (filter === 'all') return true;
  const score = g.latestAttempt?.uncertainty_score;
  if (score == null || !Number.isFinite(score)) return false;
  if (filter === 'low') return score < 0.4;
  if (filter === 'medium') return score >= 0.4 && score < UNCERTAINTY_ROUTING_THRESHOLD;
  return score >= UNCERTAINTY_ROUTING_THRESHOLD;
}

export function normalizePhoneSearchDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function userGroupMatchesSearchQuery(g: UserGroup, rawQuery: string): boolean {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return true;

  const phoneQuery = normalizePhoneSearchDigits(rawQuery);
  const u = g.user;
  const haystacks = [
    resolveAdminInterviewIntroDisplayName(u),
    u.email,
    u.full_name,
    u.display_name,
    u.name,
    trimLaunchNotificationPhone(u.launch_notification_phone),
  ]
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.toLowerCase());

  if (haystacks.some((h) => h.includes(query))) return true;

  if (phoneQuery.length >= 4) {
    const phoneDigits = normalizePhoneSearchDigits(
      trimLaunchNotificationPhone(u.launch_notification_phone) ?? '',
    );
    if (phoneDigits.includes(phoneQuery)) return true;
  }

  return false;
}

function asAdminStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

export function userGroupNeedsPsychometricFloorReview(g: UserGroup): boolean {
  return userNeedsPsychometricFloorReview(
    g.latestAttempt,
    {
      rfqScore: typeof g.user.psychometrics_rfq_score === 'number' ? g.user.psychometrics_rfq_score : null,
      gaspScore: typeof g.user.psychometrics_gasp_score === 'number' ? g.user.psychometrics_gasp_score : null,
      dweckScore: typeof g.user.psychometrics_dweck_score === 'number' ? g.user.psychometrics_dweck_score : null,
      scsSfScore: typeof g.user.psychometrics_scs_sf_score === 'number' ? g.user.psychometrics_scs_sf_score : null,
      sd3NarcissismScore:
        typeof g.user.psychometrics_sd3_narcissism_score === 'number'
          ? g.user.psychometrics_sd3_narcissism_score
          : null,
    },
    asAdminStringArray(g.user.psychometric_straight_line_flags),
  );
}

export function formatUserInterviewDateLine(g: UserGroup): string {
  const u = g.user;
  if (u.interview_completed === true && u.interview_completed_at) {
    return `Completed ${new Date(u.interview_completed_at).toLocaleString('en-GB')}`;
  }
  const a = g.latestAttempt;
  if (a) {
    const raw = a.completed_at ?? a.created_at;
    if (a.completed_at) {
      return `Completed ${new Date(raw).toLocaleString('en-GB')}`;
    }
    return `Started ${new Date(raw).toLocaleString('en-GB')} · not completed`;
  }
  return '—';
}

/** Local calendar date for cohort activity (same instant as time-range filters). */
export function adminCohortExportTestDateYmd(g: UserGroup): string {
  const ts = getCohortActivityTimestampMs(g);
  if (ts <= 0) return '—';
  return formatYmdLocal(new Date(ts));
}

export function classifyAdminUserListStatus(g: UserGroup): AdminUserStatusFilter {
  if (userHasInProgressInterview(g.user, g.latestAttempt)) return 'in_progress';
  const o = resolveAdminPrimaryOutcomeDisplay(g.user, g.latestAttempt);
  if (o.outcomeLabel === 'pass') return 'pass';
  if (o.outcomeLabel === 'fail') return 'fail';
  if (o.outcomeLabel === 'almost') return 'almost';
  return 'no_result';
}

export function computeCohortHeaderStats(groups: UserGroup[]) {
  let started = 0;
  let passed = 0;
  let failed = 0;
  for (const g of groups) {
    if (hasStartedInterviewCohort(g)) started += 1;
    const o = resolveAdminPrimaryOutcomeDisplay(g.user, g.latestAttempt);
    if (o.outcomeLabel === 'pass') passed += 1;
    else if (o.outcomeLabel === 'fail' || o.outcomeLabel === 'almost') failed += 1;
  }
  return { started, passed, failed };
}

export type AdminCohortListFilters = {
  timeRangeFilter: TimeRangeFilter;
  customTimeFrom: string;
  customTimeTo: string;
  bookmarkCohortFilter: BookmarkCohortFilter;
  humanVerifiedCohortFilter: HumanVerifiedCohortFilter;
  uncertaintyBandFilter: UncertaintyBandFilter;
  hideIncomplete: boolean;
  statusFilter: AdminUserStatusFilter;
  userSearchQuery: string;
};

export function filterAdminUserCohort(users: UserGroup[], filters: AdminCohortListFilters): UserGroup[] {
  let list = users;
  list = list.filter((g) =>
    userMatchesTimeRange(g, filters.timeRangeFilter, filters.customTimeFrom, filters.customTimeTo),
  );
  if (filters.bookmarkCohortFilter === 'bookmarked') {
    list = list.filter((g) => g.user.interview_cohort_admin_reviewed === true);
  } else if (filters.bookmarkCohortFilter === 'not_bookmarked') {
    list = list.filter((g) => !g.user.interview_cohort_admin_reviewed);
  }
  if (filters.humanVerifiedCohortFilter !== 'all') {
    list = list.filter((g) => userMatchesHumanVerifiedCohortFilter(g, filters.humanVerifiedCohortFilter));
  }
  if (filters.uncertaintyBandFilter !== 'all') {
    list = list.filter((g) => userMatchesUncertaintyFilter(g, filters.uncertaintyBandFilter));
  }
  if (filters.hideIncomplete && filters.statusFilter !== 'incomplete') {
    list = list.filter((g) => g.user.interview_completed === true);
  }
  if (filters.statusFilter !== 'all') {
    list = list.filter((g) => {
      if (filters.statusFilter === 'flagged') {
        const flags = reviewFlagsFromStoredAttempt(g.latestAttempt);
        return flags.length > 0;
      }
      if (filters.statusFilter === 'er_floor_review') {
        return g.latestAttempt != null && isLegacyEmotionRecognitionFloorOnlyFail(g.latestAttempt);
      }
      if (
        filters.statusFilter === 'sd3_narcissism_floor_review' ||
        filters.statusFilter === 'psychometric_floor_review'
      ) {
        return userGroupNeedsPsychometricFloorReview(g);
      }
      const s = classifyAdminUserListStatus(g);
      if (filters.statusFilter === 'incomplete') return s === 'in_progress' || s === 'no_result';
      return s === filters.statusFilter;
    });
  }
  if (filters.userSearchQuery.trim()) {
    list = list.filter((g) => userGroupMatchesSearchQuery(g, filters.userSearchQuery));
  }
  return list;
}
