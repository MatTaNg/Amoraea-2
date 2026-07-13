import {
  classifyAdminGateOutcome,
  summarizeGateForAdmin,
  type AdminGateOutcomeLabel,
} from '@features/aria/adminGateDisplay';
import {
  computeGateResultCore,
  GATE_PASS_WEIGHTED_MIN,
  type GateFailCode,
  type GateFailDetailJson,
} from '@features/aria/computeGateResultCore';
import {
  isLegacyEmotionRecognitionFloorOnlyFail,
  LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE,
} from '@features/aria/emotionRecognitionInterview';
import { MENTALIZING_REPAIR_SCENARIO_PASS_MIN } from '@features/aria/mentalizingRepairScenarioFloor';
import { SCENARIO_COMPOSITE_PASS_MIN } from '@features/aria/scenarioCompositeFloor';
import { userHasInProgressInterview } from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import { pillarScoresForGate } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type {
  AttemptRow,
  AttemptSummary,
  UserGroup,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import { evaluateScoringStagesReadyForRollup } from '@features/psychometrics/ensureInterviewRollupArtifacts';

export const PASS_FLAGGED_COLOR = '#C9A227';

export function getPassWord(attempt: AttemptSummary | AttemptRow | null): 'pass' | 'fail' | 'none' {
  if (!attempt || attempt.passed == null) return 'none';
  return attempt.passed ? 'pass' : 'fail';
}

export function getPassColor(value: 'pass' | 'fail' | 'none'): string {
  if (value === 'pass') return '#2A8C6A';
  if (value === 'fail') return '#E87A7A';
  return '#7A9ABE';
}

export function reviewFlagsFromStoredAttempt(attempt: AttemptSummary | AttemptRow | null): string[] {
  if (!attempt) return [];
  const raw = attempt.review_flags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

export function passWithReviewFlagsDetail(flags: string[]): string {
  return `Review flags: ${flags.join(', ')}`;
}

/** Human-readable admin pass/fail override for UI (avoids "false" / "true"). */
export function formatAdminPassFailLabel(v: boolean | null | undefined): string {
  if (v === true) return 'Pass';
  if (v === false) return 'Fail';
  return 'none';
}

/**
 * Admin Pass/Fail chips: show for any finished attempt without attempt-level `override_status`.
 * (Previously gated to 48h after completion; that hid buttons after backdating `completed_at` for QA or when
 * correcting accounts recreated after an admin override — profile row still gates via `interview_passed_admin_override`.)
 */
export function adminShowEarlyRevealPassFail(a: AttemptSummary | null | undefined): boolean {
  if (!a) return false;
  const finishedAt = a.completed_at ?? a.created_at;
  if (!finishedAt) return false;
  if (a.override_status === true || a.override_status === false) return false;
  const t = new Date(finishedAt).getTime();
  return Number.isFinite(t);
}

export function getAlmostPassColor(): string {
  return '#D97A3A';
}

export function scenarioFloorBreachSummaryFromComposites(scenarioComposites: unknown): string | null {
  const obj =
    scenarioComposites != null && typeof scenarioComposites === 'object' && !Array.isArray(scenarioComposites)
      ? (scenarioComposites as Record<string, unknown>)
      : null;
  if (!obj) return null;
  const breachParts: string[] = [];
  for (const sn of [1, 2, 3] as const) {
    const raw = obj[`scenario_${sn}`] ?? obj[String(sn)];
    const c = typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
    if (c !== undefined && c < SCENARIO_COMPOSITE_PASS_MIN) {
      breachParts.push(`S${sn} ${c.toFixed(2)}`);
    }
  }
  return breachParts.length > 0 ? breachParts.join(', ') : null;
}

const STORED_GATE_FAIL_ORDER: GateFailCode[] = [
  'weighted_score',
  'ego_development_floor',
  'scenario_floor',
  'mentalizing_floor',
  'repair_floor',
];

export function normalizeGateFailCodesFromAttempt(attempt: AttemptSummary | AttemptRow): GateFailCode[] {
  const raw = attempt.gate_fail_reasons;
  if (Array.isArray(raw)) {
    return STORED_GATE_FAIL_ORDER.filter((c) => raw.includes(c));
  }
  return [];
}

export function parseGateFailDetailRow(attempt: AttemptSummary | AttemptRow): GateFailDetailJson | null {
  const d = attempt.gate_fail_detail;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  return d as GateFailDetailJson;
}

export function buildStoredGateFailureLines(attempt: AttemptSummary | AttemptRow): string[] {
  const codes = normalizeGateFailCodesFromAttempt(attempt);
  const detail = parseGateFailDetailRow(attempt);
  const lines: string[] = [];

  for (const c of STORED_GATE_FAIL_ORDER) {
    if (!codes.includes(c)) continue;
    if (c === 'weighted_score') {
      const w =
        detail?.weighted_score ??
        (attempt.weighted_score != null
          ? { score: attempt.weighted_score, requiredMin: GATE_PASS_WEIGHTED_MIN }
          : null);
      if (w) lines.push(`Weighted ${w.score.toFixed(1)} (min ${w.requiredMin.toFixed(1)})`);
    }
    if (c === 'ego_development_floor') {
      const e = detail?.ego_development_floor;
      if (e) {
        lines.push(`Ego development floor: level ${e.level}, weighted ${e.weightedScore.toFixed(1)} (< 7.0)`);
      } else {
        lines.push('Ego development floor (level 1, weighted < 7.0)');
      }
    }
    if (c === 'scenario_floor') {
      const breachText = scenarioFloorBreachSummaryFromComposites(attempt.scenario_composites);
      if (breachText) lines.push(`Scenario floor: ${breachText} (< ${SCENARIO_COMPOSITE_PASS_MIN})`);
      else if (detail?.scenario_floor?.breaches?.length) {
        const parts = detail.scenario_floor.breaches.map((b) => `S${b.scenario} ${b.composite.toFixed(2)}`);
        lines.push(`Scenario floor: ${parts.join(', ')} (< ${SCENARIO_COMPOSITE_PASS_MIN})`);
      }
    }
    if (c === 'mentalizing_floor') {
      const lows = detail?.mentalizing_floor?.lowScenarios ?? [];
      if (lows.length > 0) {
        const parts = lows.map((l) => `S${l.scenario} ${l.score.toFixed(2)}`);
        lines.push(`Mentalizing: ${parts.join(', ')} (< ${MENTALIZING_REPAIR_SCENARIO_PASS_MIN} in 2+ scenarios)`);
      }
    }
    if (c === 'repair_floor') {
      const lows = detail?.repair_floor?.lowScenarios ?? [];
      if (lows.length > 0) {
        const parts = lows.map((l) => `S${l.scenario} ${l.score.toFixed(2)}`);
        lines.push(`Repair: ${parts.join(', ')} (< ${MENTALIZING_REPAIR_SCENARIO_PASS_MIN} in 2+ scenarios)`);
      }
    }
  }

  return lines;
}

export function mentalizingRepairGrandfatherLine(attempt: AttemptSummary | AttemptRow): string | null {
  if (attempt.mentalizing_repair_floor_grandfather_review !== true) return null;
  const d = parseGateFailDetailRow(attempt);
  const ment = d?.mentalizing_floor?.lowScenarios ?? [];
  const rep = d?.repair_floor?.lowScenarios ?? [];
  const parts: string[] = [];
  if (ment.length >= 2) {
    parts.push(`Mentalizing ${ment.map((l) => `S${l.scenario} ${l.score.toFixed(2)}`).join(', ')}`);
  }
  if (rep.length >= 2) {
    parts.push(`Repair ${rep.map((l) => `S${l.scenario} ${l.score.toFixed(2)}`).join(', ')}`);
  }
  if (parts.length > 0) return `Legacy pass — mentalizing/repair review: ${parts.join(' · ')}`;
  return 'Legacy pass — mentalizing/repair scenario review';
}

export function getAdminOutcomeDisplay(attempt: AttemptSummary | AttemptRow | null): {
  word: string;
  color: string;
  detail: string | null;
  outcomeLabel: AdminGateOutcomeLabel;
} {
  if (!attempt) {
    return { word: '—', color: '#7A9ABE', detail: null, outcomeLabel: 'none' };
  }

  const scenarioGrandfather = attempt.scenario_floor_grandfather_review === true;
  const grandfatherBreaches = scenarioFloorBreachSummaryFromComposites(attempt.scenario_composites);
  const grandfatherDetail =
    scenarioGrandfather && grandfatherBreaches
      ? `Legacy pass — review: ${grandfatherBreaches} (< ${SCENARIO_COMPOSITE_PASS_MIN})`
      : scenarioGrandfather
        ? 'Legacy pass — scenario floor review'
        : null;
  const mrGrandfatherLine = mentalizingRepairGrandfatherLine(attempt);

  const mergeDetail = (base: string | null | undefined): string | null => {
    const parts = [grandfatherDetail, mrGrandfatherLine, base].filter((p): p is string => !!p && p.length > 0);
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  if (attempt.passed === false) {
    if (isLegacyEmotionRecognitionFloorOnlyFail(attempt)) {
      return {
        word: 'fail',
        color: getPassColor('fail'),
        detail: mergeDetail(LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE),
        outcomeLabel: 'almost',
      };
    }
    const storedLines = buildStoredGateFailureLines(attempt);
    const detailStr = storedLines.length > 0 ? storedLines.join(' · ') : null;
    return {
      word: 'fail',
      color: getPassColor('fail'),
      detail: detailStr,
      outcomeLabel: 'fail',
    };
  }

  const scores = pillarScoresForGate(attempt);
  if (Object.keys(scores).length === 0) {
    const pw = getPassWord(attempt);
    const rf = reviewFlagsFromStoredAttempt(attempt);
    const flagged = pw === 'pass' && rf.length > 0;
    const w = pw === 'none' ? '—' : flagged ? 'pass (flagged)' : pw;
    return {
      word: w,
      color: flagged ? PASS_FLAGGED_COLOR : pw === 'none' ? getPassColor('none') : getPassColor(pw),
      detail: mergeDetail(flagged ? passWithReviewFlagsDetail(rf) : null),
      outcomeLabel: pw === 'pass' || pw === 'fail' ? pw : 'none',
    };
  }
  const gate = computeGateResultCore(scores);
  const { label, detailLines } = classifyAdminGateOutcome(scores, gate);
  if (label === 'pass') {
    const rf = reviewFlagsFromStoredAttempt(attempt);
    const flagged = attempt.passed === true && rf.length > 0;
    return {
      word: flagged ? 'pass (flagged)' : 'pass',
      color: flagged ? PASS_FLAGGED_COLOR : getPassColor('pass'),
      detail: mergeDetail(flagged ? passWithReviewFlagsDetail(rf) : null),
      outcomeLabel: 'pass',
    };
  }
  if (label === 'almost') {
    const detail =
      detailLines.length > 0 ? detailLines.join(' · ') : summarizeGateForAdmin(scores, gate);
    return {
      word: 'almost',
      color: getAlmostPassColor(),
      detail: mergeDetail(detail ?? null),
      outcomeLabel: 'almost',
    };
  }
  if (label === 'fail') {
    const detail = detailLines.length > 0 ? detailLines.join(' · ') : null;
    return {
      word: 'fail',
      color: getPassColor('fail'),
      detail: mergeDetail(detail),
      outcomeLabel: 'fail',
    };
  }
  const pw = getPassWord(attempt);
  const w = pw === 'none' ? '—' : pw;
  return {
    word: w,
    color: pw === 'none' ? getPassColor('none') : getPassColor(pw),
    detail: mergeDetail(null),
    outcomeLabel: 'none',
  };
}

/** Attempt or profile admin lock-in takes precedence over computed gate / "almost" for list, export, and stats. */
export function getEffectiveAdminForcedPassFail(
  user: Pick<UserRow, 'interview_passed' | 'interview_passed_computed' | 'interview_passed_admin_override'> | null | undefined,
  attempt: AttemptSummary | AttemptRow | null,
): boolean | null {
  if (attempt) {
    const ov = attempt.override_status;
    if (ov === true || ov === false) return ov;
  }
  const p = user?.interview_passed_admin_override;
  if (p === true || p === false) return p;
  /** Effective routing differs from stored gate — treat as locked-in outcome (CSV/cards match profile row). */
  const eff = user?.interview_passed;
  const comp = user?.interview_passed_computed;
  if ((eff === true || eff === false) && (comp === true || comp === false) && eff !== comp) {
    return eff;
  }
  return null;
}

export function resolveAdminPrimaryOutcomeDisplay(
  user: Pick<UserRow, 'interview_passed' | 'interview_passed_computed' | 'interview_passed_admin_override'> | null | undefined,
  attempt: AttemptSummary | AttemptRow | null,
): {
  word: string;
  color: string;
  detail: string | null;
  outcomeLabel: AdminGateOutcomeLabel;
} {
  const forced = getEffectiveAdminForcedPassFail(user, attempt);
  if (forced === true) {
    return { word: 'pass', color: getPassColor('pass'), detail: null, outcomeLabel: 'pass' };
  }
  if (forced === false) {
    return { word: 'fail', color: getPassColor('fail'), detail: null, outcomeLabel: 'fail' };
  }
  if (user?.interview_passed === true) {
    return { word: 'pass', color: getPassColor('pass'), detail: null, outcomeLabel: 'pass' };
  }
  return getAdminOutcomeDisplay(attempt);
}

/** Matches UserCard status line (Pass / Fail / Almost / — / In progress). */
export function adminCohortExportStatusLine(g: UserGroup): string {
  if (userHasInProgressInterview(g.user, g.latestAttempt)) return 'In progress';
  const o = resolveAdminPrimaryOutcomeDisplay(g.user, g.latestAttempt);
  const w = o.word;
  if (w === '—') return '—';
  if (w === 'pass') return 'Pass';
  if (w === 'fail') return 'Fail';
  if (w === 'almost') return 'Almost';
  return w;
}

/** Human-readable rollup stage gaps (e.g. moment5 missing after full M5 transcript). */
export function describeScoringStagesIncomplete(
  attempt: Pick<
    AttemptRow,
    | 'scenario_1_scores'
    | 'scenario_2_scores'
    | 'scenario_3_scores'
    | 'scenario_specific_patterns'
    | 'transcript'
  > | null,
): { incomplete: boolean; missing: string[]; summary: string | null } {
  if (!attempt) return { incomplete: false, missing: [], summary: null };
  const rollup = evaluateScoringStagesReadyForRollup(attempt);
  if (rollup.ready) return { incomplete: false, missing: [], summary: null };
  const labels: Record<string, string> = {
    scenario1: 'Scenario 1 scores',
    scenario2: 'Scenario 2 scores',
    scenario3: 'Scenario 3 scores',
    moment4: 'Moment 4 scores',
    moment5: 'Moment 5 scores',
  };
  const missing = rollup.missing.map((m) => labels[m] ?? m);
  return {
    incomplete: true,
    missing: rollup.missing,
    summary: `Scoring incomplete: ${missing.join(', ')}`,
  };
}
