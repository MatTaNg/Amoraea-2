/**
 * Alpha-only: Admin panel — cohort overview and individual user drill-down.
 * Visible only to admin@amoraea.com. Remove before production.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
  Switch,
  Share,
  Modal,
} from 'react-native';
import { supabase } from '@data/supabase/client';
import {
  getInterviewAttemptOverrideColumnsAbsent,
  isInterviewAttemptsMissingOverrideColumnsError,
  markInterviewAttemptOverrideColumnsPresent,
  rememberInterviewAttemptOverrideColumnsAbsent,
} from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { formatEdgeFunctionInvokeFailure } from '@utilities/runCommunicationStylePipeline';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  type MarkerScoreSlice,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import { enrichScenarioSliceWithContemptHeuristic } from '@features/aria/contemptExpressionScenarioHeuristic';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import {
  describeCertaintyAmbiguityAxis,
  describeEmotionalAnalyticalAxis,
  describeExpressivenessAxis,
  describeNarrativeConceptualAxis,
  describeRelationalIndividualAxis,
  describeWarmthAxis,
  styleProfileFromDbRow,
  translateStyleProfile,
} from '@utilities/styleTranslations';
import { ADMIN_CONSOLE_EMAIL, isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { adminRetryAIReasoningForAttempt } from '@utilities/adminRetryAIReasoning';
import { confirmAsync } from '@utilities/alerts/confirmDialog';
import { COMMUNICATION_FLOOR_MIN_AVG_WORDS } from '@features/aria/communicationFloorFromTranscript';
import {
  computeGateResultCore,
  GATE_PASS_WEIGHTED_MIN,
  type GateFailCode,
  type GateFailDetailJson,
} from '@features/aria/computeGateResultCore';
import { MENTALIZING_REPAIR_SCENARIO_PASS_MIN } from '@features/aria/mentalizingRepairScenarioFloor';
import { SCENARIO_COMPOSITE_PASS_MIN } from '@features/aria/scenarioCompositeFloor';
import {
  classifyAdminGateOutcome,
  formatGateFailureLines,
  summarizeGateForAdmin,
  type AdminGateOutcomeLabel,
} from '@features/aria/adminGateDisplay';
import { AdminFeedbackPanel } from '@/components/admin/AdminFeedbackPanel';
import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
  snapshotAttemptScoresForAudit,
} from '@features/aria/adminRecalculateAttemptScores';
import { remoteLog } from '@utilities/remoteLog';

// Marker ids as stored in DB; construct keys match ai_reasoning.construct_breakdown
const PILLAR_ROWS = [
  { id: 'mentalizing', constructKey: 'mentalizing', label: 'Mentalizing', short: 'Men' },
  { id: 'accountability', constructKey: 'accountability', label: 'Accountability', short: 'Acc' },
  { id: 'contempt', constructKey: 'contempt', label: 'Contempt', short: 'Con' },
  { id: 'repair', constructKey: 'repair', label: 'Repair', short: 'Rep' },
  { id: 'regulation', constructKey: 'regulation', label: 'Regulation', short: 'Reg' },
  { id: 'attunement', constructKey: 'attunement', label: 'Attunement', short: 'Att' },
  { id: 'appreciation', constructKey: 'appreciation', label: 'Appreciation', short: 'App' },
  { id: 'commitment_threshold', constructKey: 'commitment_threshold', label: 'Commitment Threshold', short: 'Com' },
];

const MARKER_IDS = PILLAR_ROWS.map((p) => p.id);
const ASSESSED_MARKERS_BY_SECTION: Record<string, string[]> = {
  scenario_1: ['mentalizing', 'accountability', 'contempt', 'repair', 'attunement'],
  scenario_2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt'],
  scenario_3: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'commitment_threshold', 'contempt'],
  moment_4: ['contempt', 'commitment_threshold', 'accountability', 'mentalizing'],
  moment_5: ['accountability', 'mentalizing', 'repair', 'regulation', 'contempt_expression'],
};

const SLICE_CONTEMPT_EXTRA_KEYS = ['contempt_recognition', 'contempt_expression'] as const;

/** Preview contempt for a single slice (sub-keys or legacy `contempt`), aligned with 70/30 pillar weighting when both strands exist. */
function sliceContemptDisplayValue(scores: Record<string, number> | null | undefined): number | undefined {
  if (!scores) return undefined;
  const exp = coerceScoreNumber(scores.contempt_expression);
  const recOnly = coerceScoreNumber(scores.contempt_recognition);
  const legacy = coerceScoreNumber(scores.contempt);
  const e = exp ?? legacy;
  const r = recOnly ?? (legacy != null && exp == null && recOnly == null ? legacy : undefined);
  if (e != null && r != null) return Math.round((0.6 * e + 0.4 * r) * 10) / 10;
  return e ?? r;
}
const USER_FEEDBACK_LABELS: Record<string, string> = {
  conversation_quality: 'Conversation Quality',
  clarity_flow: 'Clarity and Flow',
  trust_accuracy: 'Trust and Accuracy',
  other_feedback: 'Additional Feedback',
};

export { ADMIN_CONSOLE_EMAIL };

async function confirmDeleteAccount(message: string): Promise<boolean> {
  return confirmAsync({
    title: 'Delete account',
    message,
    confirmText: 'Delete',
  });
}

async function deleteUserAccountViaEdge(userId: string): Promise<{ ok: true } | { error: string }> {
  const { data, error } = await supabase.functions.invoke('admin-delete-user', {
    body: { userId },
  });
  const body = data as { ok?: boolean; error?: string } | null;
  if (body && typeof body === 'object' && typeof body.error === 'string') {
    return { error: body.error };
  }
  if (error) {
    return { error: error.message };
  }
  if (body && typeof body === 'object' && body.ok === true) {
    return { ok: true };
  }
  return { error: 'Unexpected response from server' };
}

type UserRow = {
  id: string;
  email: string | null;
  full_name?: string | null;
  name?: string | null;
  display_name?: string | null;
  /** Onboarding JSON; may include `firstName` when `users.name` is missing or corrupt. */
  basic_info?: unknown;
  created_at?: string;
  /** When set, user completed at least one attempt row in DB (even if admin cannot read attempts yet). */
  latest_attempt_id?: string | null;
  interview_completed?: boolean | null;
  /** Effective pass/fail for routing (gate result unless admin override is set). */
  interview_passed?: boolean | null;
  interview_passed_computed?: boolean | null;
  interview_passed_admin_override?: boolean | null;
  interview_cohort_admin_reviewed?: boolean | null;
  interview_completed_at?: string | null;
  /** Optional SMS number from post-interview flow (`users.launch_notification_phone`). */
  launch_notification_phone?: string | null;
  /** Live or checkpoint snapshot of messages (same shape as interview_attempts.transcript). */
  interview_transcript?: unknown;
};

type AttemptRow = {
  id: string;
  user_id: string;
  attempt_number: number;
  created_at: string;
  completed_at: string | null;
  weighted_score: number | null;
  passed: boolean | null;
  pillar_scores: Record<string, number> | null;
  scenario_1_scores: Record<string, unknown> | null;
  scenario_2_scores: Record<string, unknown> | null;
  scenario_3_scores: Record<string, unknown> | null;
  score_consistency: Record<string, { std_dev?: number }> | null;
  construct_asymmetry: Record<string, unknown> | null;
  response_timings: Array<{ latency_ms?: number; duration_ms?: number; word_count?: number }> | null;
  dropout_point: Record<string, unknown> | null;
  language_markers: Record<string, unknown> | null;
  ai_reasoning: Record<string, unknown> | null;
  user_analysis_rating: number | null;
  user_analysis_comment: string | null;
  per_construct_ratings: Record<string, unknown> | null;
  transcript: Array<{ role: string; content?: string }> | null;
  scenario_specific_patterns?: Record<string, unknown> | null;
  probe_log?: unknown;
  communication_style_error?: string | null;
  communication_floor_flag?: boolean | null;
  communication_floor_avg_unprompted_words?: number | null;
  communication_floor_dismissed_at?: string | null;
  communication_floor_dismissed_by?: string | null;
  communication_floor_dismiss_note?: string | null;
  reasoning_pending?: boolean | null;
  override_status?: boolean | null;
  override_set_at?: string | null;
  gate_fail_reason?: string | null;
  scenario_composites?: Record<string, unknown> | null;
  scenario_floor_grandfather_review?: boolean | null;
  gate_fail_reasons?: unknown;
  gate_fail_detail?: unknown;
  mentalizing_repair_floor_grandfather_review?: boolean | null;
  /** Snapshot before admin score recalculation. */
  original_scores?: Record<string, unknown> | null;
  recalculated_at?: string | null;
  recalculation_delta?: Record<string, number> | null;
  recalculation_notes?: string[] | null;
  incomplete_reason?: string | null;
};

/** List/overview only — loaded once for all users (small payload). Full rows load per user on drill-down. */
type AttemptSummary = Pick<
  AttemptRow,
  | 'id'
  | 'user_id'
  | 'attempt_number'
  | 'created_at'
  | 'completed_at'
  | 'weighted_score'
  | 'passed'
  | 'reasoning_pending'
  | 'pillar_scores'
  | 'override_status'
  | 'override_set_at'
  | 'gate_fail_reason'
  | 'scenario_composites'
  | 'scenario_floor_grandfather_review'
  | 'gate_fail_reasons'
  | 'gate_fail_detail'
  | 'mentalizing_repair_floor_grandfather_review'
>;

const INTERVIEW_ATTEMPTS_FULL_SELECT_BASE = `
      id,
      user_id,
      attempt_number,
      created_at,
      completed_at,
      weighted_score,
      passed,
      pillar_scores,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      score_consistency,
      construct_asymmetry,
      response_timings,
      probe_log,
      dropout_point,
      language_markers,
      scenario_specific_patterns,
      ai_reasoning,
      user_analysis_rating,
      user_analysis_comment,
      per_construct_ratings,
      transcript,
      communication_style_error,
      communication_floor_flag,
      communication_floor_avg_unprompted_words,
      communication_floor_dismissed_at,
      communication_floor_dismissed_by,
      communication_floor_dismiss_note,
      reasoning_pending,
      gate_fail_reason,
      scenario_composites,
      scenario_floor_grandfather_review,
      gate_fail_reasons,
      gate_fail_detail,
      mentalizing_repair_floor_grandfather_review
    ` as const;

const INTERVIEW_ATTEMPTS_FULL_SELECT = `${INTERVIEW_ATTEMPTS_FULL_SELECT_BASE},
      override_status,
      override_set_at` as const;

const INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE = `
      id,
      user_id,
      attempt_number,
      created_at,
      completed_at,
      weighted_score,
      passed,
      reasoning_pending,
      pillar_scores,
      gate_fail_reason,
      scenario_composites,
      scenario_floor_grandfather_review,
      gate_fail_reasons,
      gate_fail_detail,
      mentalizing_repair_floor_grandfather_review
    ` as const;

const INTERVIEW_ATTEMPTS_SUMMARY_SELECT = `${INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE},
      override_status,
      override_set_at` as const;

type CommunicationStyleProfileRow = {
  user_id: string;
  emotional_analytical_score: number | null;
  narrative_conceptual_score: number | null;
  certainty_ambiguity_score: number | null;
  relational_individual_score: number | null;
  emotional_vocab_density: number | null;
  qualifier_density: number | null;
  first_person_ratio: number | null;
  avg_response_length: number | null;
  pitch_mean: number | null;
  pitch_range: number | null;
  speech_rate: number | null;
  pause_frequency: number | null;
  energy_variation: number | null;
  emotional_expressiveness: number | null;
  warmth_score: number | null;
  text_confidence: number | null;
  audio_confidence: number | null;
  overall_confidence: number | null;
  updated_at: string | null;
  style_labels_primary?: string[] | null;
  style_labels_secondary?: string[] | null;
  matchmaker_summary?: string | null;
  low_confidence_note?: string | null;
  source_attempt_id?: string | null;
};

function coerceScoreNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function formatScoreCell(v: unknown): string {
  const n = coerceScoreNumber(v);
  return n === undefined ? '—' : n.toFixed(1);
}

/**
 * interview_attempts.pillar_scores and scenario_*_scores jsonb may arrive as:
 * - parsed object, JSON string, nested { pillarScores } / { pillar_scores }, or numeric strings.
 */
function normalizePillarScoresMap(raw: unknown): Record<string, number> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const nested = o.pillarScores ?? o.pillar_scores;
  const source =
    nested != null && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : o;
  const out: Record<string, number> = {};
  for (const id of MARKER_IDS) {
    const n = coerceScoreNumber(source[id]);
    if (n !== undefined) out[id] = n;
  }
  for (const id of SLICE_CONTEMPT_EXTRA_KEYS) {
    const n = coerceScoreNumber(source[id]);
    if (n !== undefined) out[id] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

function pillarScoresFromAIReasoning(ai: unknown): Record<string, number> | null {
  if (ai == null || typeof ai !== 'object') return null;
  const breakdown = (ai as Record<string, unknown>).construct_breakdown;
  if (breakdown == null || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null;
  const b = breakdown as Record<string, { score?: unknown }>;
  const out: Record<string, number> = {};
  for (const id of MARKER_IDS) {
    const n = coerceScoreNumber(b[id]?.score);
    if (n !== undefined) out[id] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Merge DB pillar_scores with construct_breakdown scores when column is empty or partial. */
function getResolvedPillarScores(a: AttemptRow | null | undefined): Record<string, number> {
  if (!a) return {};
  const fromDb = normalizePillarScoresMap(a.pillar_scores);
  const fromAi = pillarScoresFromAIReasoning(a.ai_reasoning);
  return { ...(fromAi ?? {}), ...(fromDb ?? {}) };
}

function getScenarioPillarScoresMap(raw: unknown): Record<string, number> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const innerRaw = o.pillarScores ?? o.pillar_scores;
  if (innerRaw != null && typeof innerRaw === 'object' && !Array.isArray(innerRaw)) {
    return normalizePillarScoresMap(innerRaw);
  }
  if (typeof innerRaw === 'string') {
    return normalizePillarScoresMap(innerRaw);
  }
  return normalizePillarScoresMap(o);
}

function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Non-empty narrative fields — pending stubs only carry _reasoningPending + pillar_scores + note. */
function adminAttemptHasSubstantiveAiReasoning(ar: Record<string, unknown> | null): boolean {
  if (!ar) return false;
  const summary = ar.interview_summary;
  if (typeof summary === 'string' && summary.trim().length > 0) return true;
  const strengths = ar.overall_strengths;
  if (Array.isArray(strengths) && strengths.some((x) => typeof x === 'string' && x.trim().length > 0)) return true;
  const growth = ar.overall_growth_areas;
  if (Array.isArray(growth) && growth.some((x) => typeof x === 'string' && x.trim().length > 0)) return true;
  return false;
}

/**
 * True when the attempt is still missing long-form AI narrative, not only when `reasoning_pending` / _reasoningPending
 * flags are set (they can be stale after a successful retry or backfill).
 */
function adminAiNarrativeStillPending(attempt: AttemptRow): boolean {
  const ar = parseObject(attempt.ai_reasoning);
  const flagPending =
    attempt.reasoning_pending === true || !!(ar as { _reasoningPending?: boolean } | null)?._reasoningPending;
  if (!flagPending) return false;
  if (adminAttemptHasSubstantiveAiReasoning(ar)) return false;
  return true;
}

function getMomentScoreBundle(
  attempt: AttemptRow | null | undefined,
  momentNumber: 4 | 5
): { scores: Record<string, number> | null; summary: string | null } {
  const patterns = parseObject(attempt?.scenario_specific_patterns);
  const key = momentNumber === 4 ? 'moment_4_scores' : 'moment_5_scores';
  const bundle = parseObject(patterns?.[key]);
  const scores = getScenarioPillarScoresMap(bundle);
  const summaryRaw = bundle?.summary;
  const summary = typeof summaryRaw === 'string' && summaryRaw.trim().length > 0 ? summaryRaw.trim() : null;
  return { scores, summary };
}

function getScoreBundleDetails(raw: unknown): {
  scores: Record<string, number> | null;
  evidence: Record<string, string>;
  confidence: Record<string, string>;
} {
  const obj = parseObject(raw);
  const scores = getScenarioPillarScoresMap(obj);
  const evidenceRaw = parseObject(obj?.keyEvidence);
  const confidenceRaw = parseObject(obj?.pillarConfidence);
  const evidence: Record<string, string> = {};
  const confidence: Record<string, string> = {};
  MARKER_IDS.forEach((id) => {
    const ev = getString(evidenceRaw?.[id]);
    const cf = getString(confidenceRaw?.[id]);
    if (ev) evidence[id] = ev;
    if (cf) confidence[id] = cf;
  });
  return { scores, evidence, confidence };
}

/**
 * True when the attempt has merged/holistic trait scores in DB but no per-scenario slice JSON (scenario_1/2/3_scores).
 * Typical when deferred holistic completion updated `pillar_scores` only (see `completeStandardInterviewCore`).
 */
function adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(a: AttemptRow): boolean {
  const hasScenarioSlice =
    getScoreBundleDetails(a.scenario_1_scores).scores != null ||
    getScoreBundleDetails(a.scenario_2_scores).scores != null ||
    getScoreBundleDetails(a.scenario_3_scores).scores != null;
  if (hasScenarioSlice) return false;
  const resolved = getResolvedPillarScores(a);
  return MARKER_IDS.some((id) => coerceScoreNumber(resolved[id]) !== undefined);
}

function markerIsAssessedInSection(sectionKey: string, markerId: string): boolean {
  return (ASSESSED_MARKERS_BY_SECTION[sectionKey] ?? []).includes(markerId);
}

function extractAggregateSlice(raw: unknown): MarkerScoreSlice {
  const obj = parseObject(raw);
  if (!obj) return null;
  const ps = obj.pillarScores;
  const ke = obj.keyEvidence;
  if (ps == null && ke == null) return null;
  return {
    pillarScores:
      typeof ps === 'object' && ps != null && !Array.isArray(ps)
        ? (ps as Record<string, number | null>)
        : undefined,
    keyEvidence:
      typeof ke === 'object' && ke != null && !Array.isArray(ke)
        ? (ke as Record<string, string>)
        : undefined,
  };
}

type TranscriptMsg = { role?: string; content?: string; scenarioNumber?: number };

function userTextForAdminScenario(
  transcript: AttemptRow['transcript'],
  scenarioNum: 1 | 2 | 3,
): string {
  if (!Array.isArray(transcript)) return '';
  return (transcript as TranscriptMsg[])
    .filter(
      (m) =>
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string',
    )
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

/** Strip non-assessed keys from personal moments before pillar math (matches live interview + recompute script). */
function extractSanitizedMomentSlice(raw: unknown): MarkerScoreSlice {
  const slice = extractAggregateSlice(raw);
  if (!slice?.pillarScores) return slice;
  const sanitized = sanitizePersonalMomentScoresForAggregate({
    pillarScores: slice.pillarScores as Record<string, number | null>,
    keyEvidence: slice.keyEvidence,
  });
  if (!sanitized?.pillarScores) return slice;
  return { pillarScores: sanitized.pillarScores, keyEvidence: sanitized.keyEvidence };
}

function extractSanitizedMoment5Slice(raw: unknown): MarkerScoreSlice {
  const slice = extractAggregateSlice(raw);
  if (!slice?.pillarScores) return slice;
  const sanitized = sanitizeMoment5PersonalScoresForAggregate({
    pillarScores: slice.pillarScores as Record<string, number | null>,
    keyEvidence: slice.keyEvidence,
  });
  if (!sanitized?.pillarScores) return slice;
  return { pillarScores: sanitized.pillarScores, keyEvidence: sanitized.keyEvidence };
}

function computeMarkerAggregateFromAttempt(
  attempt: AttemptRow
): { scores: Record<string, number>; counts: Record<string, number> } {
  const patterns = parseObject(attempt.scenario_specific_patterns);
  const m4Raw = parseObject(patterns?.moment_4_scores);
  const tx = attempt.transcript;
  const m5Raw = parseObject(patterns?.moment_5_scores);
  const slices: MarkerScoreSlice[] = [
    enrichScenarioSliceWithContemptHeuristic(extractAggregateSlice(attempt.scenario_1_scores), userTextForAdminScenario(tx, 1)),
    enrichScenarioSliceWithContemptHeuristic(extractAggregateSlice(attempt.scenario_2_scores), userTextForAdminScenario(tx, 2)),
    enrichScenarioSliceWithContemptHeuristic(extractAggregateSlice(attempt.scenario_3_scores), userTextForAdminScenario(tx, 3)),
    extractSanitizedMomentSlice(m4Raw),
    extractSanitizedMoment5Slice(m5Raw),
  ];
  return aggregatePillarScoresWithCommitmentMergeDetailed(slices);
}

function buildMomentOrScenarioSummary(
  title: string,
  details: { evidence: Record<string, string> },
  explicitSummary?: string | null
): string {
  if (explicitSummary && explicitSummary.trim().length > 0) return explicitSummary.trim();
  const lines = Object.entries(details.evidence)
    .slice(0, 3)
    .map(([key, value]) => `${formatConstruct(key)}: ${value}`);
  if (lines.length === 0) return `${title}: No summary text was recorded for this run.`;
  return lines.join(' ');
}

/** Elapsed time between attempt created_at and completed_at (admin overview). */
function formatAdminAttemptElapsed(start: string, end: string): string {
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  const ms = t1 - t0;
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Clock time from start to completion, or elapsed so far when the attempt is still open. */
function formatAttemptElapsedDisplay(attempt: { created_at: string; completed_at: string | null }): string {
  const end = attempt.completed_at ?? new Date().toISOString();
  const elapsed = formatAdminAttemptElapsed(attempt.created_at, end);
  return attempt.completed_at ? elapsed : `${elapsed} · in progress`;
}

type UserGroup = {
  user: UserRow;
  attempts: AttemptSummary[];
  latestAttempt: AttemptSummary | null;
};

function trimLaunchNotificationPhone(phone: string | null | undefined): string | null {
  if (typeof phone !== 'string') return null;
  const t = phone.trim();
  return t.length > 0 ? t : null;
}

type TimeRangeFilter = 'all' | 'day' | 'week' | 'month' | 'custom';
type ReviewedCohortFilter = 'all' | 'reviewed' | 'unreviewed';

function formatYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Inclusive start/end of local calendar day for a YYYY-MM-DD string, or null if invalid. */
function localDayRangeFromYmd(ymd: string): { start: number; end: number } | null {
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

function getCohortActivityTimestampMs(g: UserGroup): number {
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

function userMatchesTimeRange(
  g: UserGroup,
  range: TimeRangeFilter,
  customFrom: string,
  customTo: string,
): boolean {
  if (range === 'all') return true;
  const ts = getCohortActivityTimestampMs(g);
  if (ts <= 0) return false;
  if (range === 'day' || range === 'week' || range === 'month') {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const start = range === 'day' ? now - dayMs : range === 'week' ? now - 7 * dayMs : now - 30 * dayMs;
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

function hasStartedInterviewCohort(g: UserGroup): boolean {
  if (userHasInProgressInterview(g.user)) return true;
  if (g.latestAttempt != null) return true;
  if (g.user.latest_attempt_id) return true;
  return parseUserTranscript(g.user.interview_transcript).length > 0;
}

type FetchAdminUsersListResult = { groups: UserGroup[]; errorMessage: string | null };

/** Users + lightweight attempt rows for list (counts, pass badge, tab labels). No transcript / scores jsonb. */
async function fetchAdminUsersList(): Promise<FetchAdminUsersListResult> {
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select(
      `
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
      interview_completed_at,
      launch_notification_phone,
      interview_transcript
    `
    )
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('Admin panel users fetch error:', usersError);
    return { groups: [], errorMessage: usersError.message };
  }

  const users = (allUsers ?? []) as UserRow[];

  const overrideColsAbsent = await getInterviewAttemptOverrideColumnsAbsent();

  let { data: allAttempts, error: attemptsError } = await supabase
    .from('interview_attempts')
    .select(overrideColsAbsent ? INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE : INTERVIEW_ATTEMPTS_SUMMARY_SELECT)
    .order('created_at', { ascending: false });

  if (overrideColsAbsent && allAttempts) {
    allAttempts = allAttempts.map((row) => ({
      ...row,
      override_status: null as boolean | null,
      override_set_at: null as string | null,
    })) as AttemptSummary[];
  }

  if (!overrideColsAbsent && attemptsError && isInterviewAttemptsMissingOverrideColumnsError(attemptsError)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    const legacy = await supabase
      .from('interview_attempts')
      .select(INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE)
      .order('created_at', { ascending: false });
    attemptsError = legacy.error;
    allAttempts = legacy.data?.map((row) => ({
      ...row,
      override_status: null as boolean | null,
      override_set_at: null as string | null,
    })) as AttemptSummary[];
  }

  if (!overrideColsAbsent && !attemptsError) {
    void markInterviewAttemptOverrideColumnsPresent();
  }

  if (attemptsError) {
    console.error('Admin panel attempts fetch error:', attemptsError);
    return {
      groups: users.map((user) => ({
        user,
        attempts: [] as AttemptSummary[],
        latestAttempt: null,
      })),
      errorMessage: `Could not load interview_attempts: ${attemptsError.message}`,
    };
  }

  const attempts = (allAttempts ?? []) as AttemptSummary[];

  const attemptFinishedMs = (a: AttemptSummary): number => {
    const raw = a.completed_at ?? a.created_at;
    const t = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  };

  const groups = users.map((user) => {
    const userAttempts = attempts
      .filter((a) => a.user_id === user.id)
      .sort((a, b) => attemptFinishedMs(b) - attemptFinishedMs(a));
    const latestAttempt = userAttempts.length > 0 ? userAttempts[0] : null;
    return {
      user,
      attempts: userAttempts,
      latestAttempt,
    };
  });

  groups.sort((a, b) => {
    const ta = a.latestAttempt ? attemptFinishedMs(a.latestAttempt) : Number.NEGATIVE_INFINITY;
    const tb = b.latestAttempt ? attemptFinishedMs(b.latestAttempt) : Number.NEGATIVE_INFINITY;
    return tb - ta;
  });

  return { groups, errorMessage: null };
}

/** Latest run only — product treats one run per user (retake overwrites). */
async function fetchLatestFullAttemptForUser(
  userId: string,
  latestAttemptId: string | null | undefined,
): Promise<{ attempts: AttemptRow[]; errorMessage: string | null }> {
  const absent = await getInterviewAttemptOverrideColumnsAbsent();
  const patchOverrideNulls = (row: Record<string, unknown>): AttemptRow =>
    ({ ...row, override_status: null, override_set_at: null }) as AttemptRow;
  const fullSelect = absent ? INTERVIEW_ATTEMPTS_FULL_SELECT_BASE : INTERVIEW_ATTEMPTS_FULL_SELECT;

  if (latestAttemptId) {
    let { data, error } = await supabase
      .from('interview_attempts')
      .select(fullSelect)
      .eq('id', latestAttemptId)
      .eq('user_id', userId)
      .maybeSingle();
    // #region agent log
    if (data && typeof data === 'object') {
      const r = data as Record<string, unknown>;
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
        body: JSON.stringify({
          sessionId: 'c61a43',
          hypothesisId: 'H3-H4',
          location: 'AdminInterviewDashboard.tsx:fetchLatestFullAttemptForUser',
          message: 'full attempt loaded by latest_attempt_id',
          data: {
            path: 'latest_id',
            attemptId: r.id,
            userTail: typeof userId === 'string' ? userId.slice(-8) : null,
            s1Null: r.scenario_1_scores == null,
            s2Null: r.scenario_2_scores == null,
            s3Null: r.scenario_3_scores == null,
            pillarScoresNull: r.pillar_scores == null,
          },
          timestamp: Date.now(),
          runId: 'pre-fix',
        }),
      }).catch(() => {});
    }
    // #endregion
    if (absent && data) {
      data = patchOverrideNulls(data as Record<string, unknown>);
    } else if (!absent && error && isInterviewAttemptsMissingOverrideColumnsError(error)) {
      await rememberInterviewAttemptOverrideColumnsAbsent();
      const legacy = await supabase
        .from('interview_attempts')
        .select(INTERVIEW_ATTEMPTS_FULL_SELECT_BASE)
        .eq('id', latestAttemptId)
        .eq('user_id', userId)
        .maybeSingle();
      error = legacy.error;
      data = legacy.data ? patchOverrideNulls(legacy.data as Record<string, unknown>) : null;
    }
    if (error) {
      console.error('Admin panel fetchLatestFullAttemptForUser:', error);
      return { attempts: [], errorMessage: error.message };
    }
    if (!absent && !error && data) void markInterviewAttemptOverrideColumnsPresent();
    return { attempts: data ? ([data] as AttemptRow[]) : [], errorMessage: null };
  }
  let { data, error } = await supabase
    .from('interview_attempts')
    .select(fullSelect)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1);
  // #region agent log
  if (data?.[0] && typeof data[0] === 'object') {
    const r = data[0] as Record<string, unknown>;
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        hypothesisId: 'H3-H4',
        location: 'AdminInterviewDashboard.tsx:fetchLatestFullAttemptForUser',
        message: 'full attempt loaded by newest created_at',
        data: {
          path: 'newest_row',
          attemptId: r.id,
          userTail: typeof userId === 'string' ? userId.slice(-8) : null,
          s1Null: r.scenario_1_scores == null,
          s2Null: r.scenario_2_scores == null,
          s3Null: r.scenario_3_scores == null,
          pillarScoresNull: r.pillar_scores == null,
        },
        timestamp: Date.now(),
        runId: 'pre-fix',
      }),
    }).catch(() => {});
  }
  // #endregion
  if (absent && data) {
    data = data.map((row) => patchOverrideNulls(row as Record<string, unknown>));
  } else if (!absent && error && isInterviewAttemptsMissingOverrideColumnsError(error)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    const legacy = await supabase
      .from('interview_attempts')
      .select(INTERVIEW_ATTEMPTS_FULL_SELECT_BASE)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    error = legacy.error;
    data = legacy.data?.map((row) => patchOverrideNulls(row as Record<string, unknown>)) ?? null;
  }
  if (error) {
    console.error('Admin panel fetchLatestFullAttemptForUser:', error);
    return { attempts: [], errorMessage: error.message };
  }
  if (!absent && !error && data?.length) void markInterviewAttemptOverrideColumnsPresent();
  return { attempts: (data ?? []) as AttemptRow[], errorMessage: null };
}

function formatConstruct(key: string): string {
  const row = PILLAR_ROWS.find((r) => r.id === key || r.constructKey === key);
  return row?.label ?? key?.replace(/_/g, ' ') ?? '—';
}

function getPassWord(attempt: AttemptSummary | AttemptRow | null): 'pass' | 'fail' | 'none' {
  if (!attempt || attempt.passed == null) return 'none';
  return attempt.passed ? 'pass' : 'fail';
}

function getPassColor(value: 'pass' | 'fail' | 'none'): string {
  if (value === 'pass') return '#2A8C6A';
  if (value === 'fail') return '#E87A7A';
  return '#7A9ABE';
}

/** Human-readable admin pass/fail override for UI (avoids "false" / "true"). */
function formatAdminPassFailLabel(v: boolean | null | undefined): string {
  if (v === true) return 'Pass';
  if (v === false) return 'Fail';
  return 'none';
}

/**
 * Admin Pass/Fail chips: show for any finished attempt without attempt-level `override_status`.
 * (Previously gated to 48h after completion; that hid buttons after backdating `completed_at` for QA or when
 * correcting accounts recreated after an admin override — profile row still gates via `interview_passed_admin_override`.)
 */
function adminShowEarlyRevealPassFail(a: AttemptSummary | null | undefined): boolean {
  if (!a) return false;
  const finishedAt = a.completed_at ?? a.created_at;
  if (!finishedAt) return false;
  if (a.override_status === true || a.override_status === false) return false;
  const t = new Date(finishedAt).getTime();
  return Number.isFinite(t);
}

function getAlmostPassColor(): string {
  return '#D97A3A';
}

/** Pillar map for gate recompute: list rows use DB only; drill-down merges AI reasoning like the app. */
function pillarScoresForGate(a: AttemptSummary | AttemptRow | null): Record<string, number> {
  if (!a) return {};
  if ('ai_reasoning' in a && (a as AttemptRow).ai_reasoning !== undefined) {
    return getResolvedPillarScores(a as AttemptRow);
  }
  return normalizePillarScoresMap((a as AttemptSummary).pillar_scores) ?? {};
}

function scenarioFloorBreachSummaryFromComposites(scenarioComposites: unknown): string | null {
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
  'scenario_floor',
  'mentalizing_floor',
  'repair_floor',
];

function inferGateFailCodesFromLegacyReason(text: string | null): GateFailCode[] {
  if (!text) return [];
  const found: GateFailCode[] = [];
  if (text.includes('weighted_score:') || text.includes('weighted_below_threshold:')) {
    found.push('weighted_score');
  }
  if (text.includes('scenario_floor:')) found.push('scenario_floor');
  if (text.includes('mentalizing_floor:')) found.push('mentalizing_floor');
  if (text.includes('repair_floor:')) found.push('repair_floor');
  return STORED_GATE_FAIL_ORDER.filter((c) => found.includes(c));
}

function normalizeGateFailCodesFromAttempt(attempt: AttemptSummary | AttemptRow): GateFailCode[] {
  const raw = attempt.gate_fail_reasons;
  if (Array.isArray(raw)) {
    return STORED_GATE_FAIL_ORDER.filter((c) => raw.includes(c));
  }
  return inferGateFailCodesFromLegacyReason(attempt.gate_fail_reason ?? null);
}

function parseGateFailDetailRow(attempt: AttemptSummary | AttemptRow): GateFailDetailJson | null {
  const d = attempt.gate_fail_detail;
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  return d as GateFailDetailJson;
}

function buildStoredGateFailureLines(attempt: AttemptSummary | AttemptRow): string[] {
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

  if (lines.length === 0 && attempt.gate_fail_reason) {
    return attempt.gate_fail_reason.split(';').map((s) => s.trim()).filter(Boolean);
  }
  return lines;
}

function mentalizingRepairGrandfatherLine(attempt: AttemptSummary | AttemptRow): string | null {
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

function getAdminOutcomeDisplay(attempt: AttemptSummary | AttemptRow | null): {
  word: string;
  color: string;
  detail: string | null;
  outcomeLabel: AdminGateOutcomeLabel;
} {
  if (!attempt) {
    return { word: '—', color: '#7A9ABE', detail: null, outcomeLabel: 'none' };
  }

  const gateFailReason = attempt.gate_fail_reason ?? null;
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
    const storedLines = buildStoredGateFailureLines(attempt);
    const detailStr =
      storedLines.length > 0 ? storedLines.join(' · ') : gateFailReason ?? null;
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
    const w = pw === 'none' ? '—' : pw;
    return {
      word: w,
      color: pw === 'none' ? getPassColor('none') : getPassColor(pw),
      detail: mergeDetail(null),
      outcomeLabel: 'none',
    };
  }
  const gate = computeGateResultCore(scores);
  const { label, detailLines } = classifyAdminGateOutcome(scores, gate);
  if (label === 'pass') {
    return {
      word: 'pass',
      color: getPassColor('pass'),
      detail: mergeDetail(null),
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
function getEffectiveAdminForcedPassFail(
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

function resolveAdminPrimaryOutcomeDisplay(
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

function formatAttemptDate(attempt: AttemptSummary | AttemptRow): string {
  const raw = attempt.completed_at ?? attempt.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString('en-GB');
}

function formatAttemptTabLabel(attempt: AttemptSummary | AttemptRow): string {
  const raw = attempt.completed_at ?? attempt.created_at;
  const aiPending =
    'ai_reasoning' in attempt
      ? !!(parseObject((attempt as AttemptRow).ai_reasoning) as { _reasoningPending?: boolean } | null)
          ?._reasoningPending
      : false;
  const pending = attempt.reasoning_pending === true || aiPending;
  const suffix = pending ? ' · AI narrative pending' : '';
  if (!raw) return `Test ${attempt.attempt_number}${suffix}`;
  return (
    new Date(raw).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + suffix
  );
}

function getAttemptsSorted(attempts: AttemptRow[] | null | undefined): AttemptRow[] {
  if (!Array.isArray(attempts)) return [];
  return [...attempts].sort((a, b) => {
    const tb = new Date(b.created_at).getTime();
    const ta = new Date(a.created_at).getTime();
    if (tb !== ta) return tb - ta;
    return b.attempt_number - a.attempt_number;
  });
}

/** Cohort list filter — derived from live interview state + latest attempt gate display. */
type AdminUserStatusFilter =
  | 'all'
  | 'incomplete'
  | 'in_progress'
  | 'pass'
  | 'fail'
  | 'almost'
  | 'no_result';

function getString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

type LiveTranscriptMsg = { role: string; content?: string; scenarioNumber?: number };

function parseUserTranscript(raw: unknown): LiveTranscriptMsg[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as LiveTranscriptMsg[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as LiveTranscriptMsg[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/** True when the account has an unfinished interview with a transcript snapshot on `users` (live sync or checkpoint). */
function userHasInProgressInterview(user: UserRow): boolean {
  if (user.interview_completed === true) return false;
  return parseUserTranscript(user.interview_transcript).length > 0;
}

function classifyAdminUserListStatus(g: UserGroup): AdminUserStatusFilter {
  if (userHasInProgressInterview(g.user)) return 'in_progress';
  const o = resolveAdminPrimaryOutcomeDisplay(g.user, g.latestAttempt);
  if (o.outcomeLabel === 'pass') return 'pass';
  if (o.outcomeLabel === 'fail') return 'fail';
  if (o.outcomeLabel === 'almost') return 'almost';
  return 'no_result';
}

function formatUserInterviewDateLine(g: UserGroup): string {
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

function computeCohortHeaderStats(groups: UserGroup[]) {
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

function escapeCsvField(raw: string): string {
  const s = raw ?? '';
  // Quote if tab present so delimiter-separated parsers keep phone/email text in one column
  if (/[",\r\n\t]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Phone numbers must be forced to text or Sheets/Excel show scientific notation (e.g. 6.2E+10).
 * Uses the same `="..."` text formula pattern Excel writes for numeric-looking text cells.
 */
function escapeCsvPhoneForSpreadsheet(display: string): string {
  if (display === '—') return escapeCsvField(display);
  const innerEscaped = display.replace(/"/g, '""');
  const excelTextFormula = `="${innerEscaped}"`;
  return `"${excelTextFormula.replace(/"/g, '""')}"`;
}

/** Matches UserCard status line (Pass / Fail / Almost / — / In progress). */
function adminCohortExportStatusLine(g: UserGroup): string {
  if (userHasInProgressInterview(g.user)) return 'In progress';
  const o = resolveAdminPrimaryOutcomeDisplay(g.user, g.latestAttempt);
  const w = o.word;
  if (w === '—') return '—';
  if (w === 'pass') return 'Pass';
  if (w === 'fail') return 'Fail';
  if (w === 'almost') return 'Almost';
  return w;
}

/** Local calendar date for cohort activity (same instant as time-range filters). */
function adminCohortExportTestDateYmd(g: UserGroup): string {
  const ts = getCohortActivityTimestampMs(g);
  if (ts <= 0) return '—';
  return formatYmdLocal(new Date(ts));
}

const ADMIN_EXPORT_SCORE_KEYS = [
  'mentalizing',
  'accountability',
  'contempt',
  'repair',
  'regulation',
  'attunement',
  'appreciation',
  'commitment_threshold',
] as const;

function buildAdminCohortExportCsv(groups: UserGroup[]): string {
  const headers = [
    'Name',
    'Email',
    'Phone',
    'Status',
    'Date test was taken',
    'Overall Score',
    'Mentalizing',
    'Accountability / Defensiveness',
    'Contempt / Criticism',
    'Repair',
    'Emotional Regulation',
    'Attunement',
    'Appreciation',
    'Commitment',
  ];
  const lines: string[] = [headers.map(escapeCsvField).join(',')];
  for (const g of groups) {
    const latest = g.latestAttempt;
    const pillars = pillarScoresForGate(latest);
    const phoneDisplay = trimLaunchNotificationPhone(g.user.launch_notification_phone) ?? '—';
    const cells: string[] = [
      escapeCsvField(resolveAdminInterviewIntroDisplayName(g.user)),
      escapeCsvField(g.user.email ?? '—'),
      escapeCsvPhoneForSpreadsheet(phoneDisplay),
      escapeCsvField(adminCohortExportStatusLine(g)),
      escapeCsvField(adminCohortExportTestDateYmd(g)),
      escapeCsvField(formatScoreCell(latest?.weighted_score)),
    ];
    for (const key of ADMIN_EXPORT_SCORE_KEYS) {
      cells.push(escapeCsvField(formatScoreCell(pillars[key])));
    }
    lines.push(cells.join(','));
  }
  return lines.join('\r\n');
}

function triggerAdminCohortCsvDownload(filename: string, csvBody: string): void {
  const payload = `\uFEFF${csvBody}`;
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    try {
      // UTF-8 BOM + CSV: opens cleanly in Google Sheets (File → Import) and Excel
      const blob = new Blob([payload], {
        type: 'text/csv;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not download CSV.';
      Alert.alert('Export failed', msg);
    }
    return;
  }
  void Share.share({ title: filename, message: payload }).catch(() => {
    Alert.alert('Export failed', 'Could not share the CSV.');
  });
}

/** Best-effort scenario indicator when `interview_last_checkpoint` is not selected or missing on older DBs. */
function inferLatestScenarioFromTranscript(lines: LiveTranscriptMsg[]): number | null {
  let max: number | null = null;
  for (const m of lines) {
    const n = m.scenarioNumber;
    if (typeof n === 'number' && n >= 1 && n <= 3) {
      max = max == null ? n : Math.max(max, n);
    }
  }
  return max;
}

function InProgressTranscriptSection({
  user,
  onRefresh,
}: {
  user: UserRow;
  onRefresh: () => void;
}) {
  if (!userHasInProgressInterview(user)) return null;
  const lines = parseUserTranscript(user.interview_transcript);
  const inferredScenario = inferLatestScenarioFromTranscript(lines);
  return (
    <View style={styles.inProgressSection}>
      <View style={styles.inProgressHeaderRow}>
        <Text style={styles.inProgressTitle}>In-progress interview</Text>
        <TouchableOpacity onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Refresh transcript">
          <Text style={styles.refreshLink}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.inProgressMeta}>
        {inferredScenario != null ? `Latest scenario in snapshot: ${inferredScenario} · ` : ''}
        {lines.length} message{lines.length === 1 ? '' : 's'}
      </Text>
      {lines.length === 0 ? (
        <Text style={styles.blockText}>
          No transcript rows yet — live sync runs every few seconds during the interview, or appears after the first
          scenario checkpoint.
        </Text>
      ) : (
        <ScrollView style={styles.inProgressScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {lines.map((m, idx) => (
            <Text key={`live-${m.role}-${idx}`} style={styles.transcriptLine}>
              {m.role}
              {m.scenarioNumber != null ? ` (s${m.scenarioNumber})` : ''}: {m.content ?? ''}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function UserCard({
  userData,
  onPress,
  onDelete,
  canDelete,
  deleting,
  reviewed,
  onToggleReviewed,
  onRefreshList,
}: {
  userData: UserGroup;
  onPress: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleting: boolean;
  reviewed: boolean;
  onToggleReviewed: (next: boolean) => void;
  onRefreshList: () => Promise<void>;
}) {
  const [overrideBusy, setOverrideBusy] = useState(false);
  const latest = userData.latestAttempt;
  const outcome = resolveAdminPrimaryOutcomeDisplay(userData.user, latest);
  const override = userData.user.interview_passed_admin_override;
  /** Attempt `override_status` or profile `interview_passed_admin_override` means admin already committed — hide chips until cleared (e.g. SQL / recreated user row). */
  const showRevealButtons = adminShowEarlyRevealPassFail(latest) && typeof override !== 'boolean';
  const launchPhone = trimLaunchNotificationPhone(userData.user.launch_notification_phone);

  const applyRevealOverride = async (pass: boolean) => {
    if (!latest?.id || !userData.user.id) return;
    setOverrideBusy(true);
    try {
      const absentAtStart = await getInterviewAttemptOverrideColumnsAbsent();
      let attemptUpdateFailedMissingColumns = false;
      if (!absentAtStart) {
        const nowIso = new Date().toISOString();
        const { error: attErr } = await supabase
          .from('interview_attempts')
          .update({ override_status: pass, override_set_at: nowIso })
          .eq('id', latest.id);
        if (attErr && isInterviewAttemptsMissingOverrideColumnsError(attErr)) {
          await rememberInterviewAttemptOverrideColumnsAbsent();
          attemptUpdateFailedMissingColumns = true;
        } else if (attErr) {
          throw new Error(attErr.message);
        }
      }
      const { error: userErr } = await supabase
        .from('users')
        .update({ interview_passed: pass, interview_passed_admin_override: pass })
        .eq('id', userData.user.id);
      if (userErr) throw new Error(userErr.message);
      await onRefreshList();
      if (attemptUpdateFailedMissingColumns) {
        Alert.alert(
          'Profile updated',
          'Pass/fail was saved on the user. This project does not have interview_attempts override columns yet (apply migration 20260430220000_interview_attempts_override_reveal), so the attempt row was not updated.',
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed';
      Alert.alert('Could not apply override', msg);
    } finally {
      setOverrideBusy(false);
    }
  };

  return (
    <View style={styles.userCardRow}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.userCard, styles.userCardFlex, pressed && styles.userCardPressed]}
      >
        <Text style={styles.userCardIntroName}>{resolveAdminInterviewIntroDisplayName(userData.user)}</Text>
        <Text style={styles.userCardEmail}>{userData.user.email ?? '—'}</Text>
        {launchPhone ? (
          <Text style={styles.userCardEmail} selectable>
            Phone: <Text style={styles.launchNotificationPhoneBold}>{launchPhone}</Text>
          </Text>
        ) : null}
        <Text style={styles.userCardDateLine}>{formatUserInterviewDateLine(userData)}</Text>
        <View style={styles.userCardMetaRow}>
          <View style={styles.userCardMetaLeft}>
            <Text style={[styles.userCardStatus, { color: outcome.color }]}>{outcome.word}</Text>
            {outcome.detail ? (
              <Text style={styles.userCardGateDetail} numberOfLines={5}>
                {outcome.detail}
              </Text>
            ) : null}
            {override != null ? (
              <Text style={styles.userCardOverrideHint}>
                Admin override: {formatAdminPassFailLabel(override)}
              </Text>
            ) : null}
            {userHasInProgressInterview(userData.user) ? (
              <Text style={styles.userCardInProgress}>In progress</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.userCardSideCol}>
        <View style={styles.reviewedToggleRow}>
          <Text style={styles.reviewedLabel}>Reviewed</Text>
          <Switch
            value={reviewed}
            onValueChange={(v) => onToggleReviewed(v)}
            trackColor={{ false: 'rgba(82,142,220,0.2)', true: 'rgba(42,140,106,0.5)' }}
            thumbColor={reviewed ? '#2A8C6A' : '#7A9ABE'}
          />
        </View>
        {showRevealButtons ? (
          <View style={styles.overrideButtonRow}>
            <TouchableOpacity
              style={[styles.overrideChip, overrideBusy && { opacity: 0.5 }]}
              disabled={overrideBusy}
              onPress={() => void applyRevealOverride(true)}
              accessibilityRole="button"
              accessibilityLabel="Pass applicant now"
            >
              <Text style={styles.overrideChipText}>Pass</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.overrideChip, overrideBusy && { opacity: 0.5 }]}
              disabled={overrideBusy}
              onPress={() => void applyRevealOverride(false)}
              accessibilityRole="button"
              accessibilityLabel="Fail applicant now"
            >
              <Text style={styles.overrideChipText}>Fail</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {canDelete ? (
          <TouchableOpacity
            style={styles.userCardDelete}
            onPress={() => void onDelete()}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
          >
            <Text style={[styles.userCardDeleteText, deleting && styles.userCardDeleteTextDisabled]}>
              {deleting ? '…' : 'Delete'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function functionInvokeBodyError(data: unknown): string | null {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === 'string' && e.trim()) return e.trim();
  }
  return null;
}

function SummaryTab({
  attempt,
  onAttemptMutated,
  candidateUser,
}: {
  attempt: AttemptRow;
  onAttemptMutated?: () => void;
  /** User row for confirmation dialog (optional when viewing attempt outside cohort drill-down). */
  candidateUser?: UserRow | null;
}) {
  const [styleProfile, setStyleProfile] = useState<CommunicationStyleProfileRow | null>(null);
  const [styleStatus, setStyleStatus] = useState<'idle' | 'loading' | 'reprocessing'>('idle');
  const [stylePipelineErrorDisplay, setStylePipelineErrorDisplay] = useState<string | null>(
    attempt.communication_style_error ?? null
  );
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [adminSessionUserId, setAdminSessionUserId] = useState<string | null>(null);
  const [adminSessionEmail, setAdminSessionEmail] = useState<string | null>(null);

  useEffect(() => {
    setStylePipelineErrorDisplay(attempt.communication_style_error ?? null);
  }, [attempt.id, attempt.communication_style_error]);

  const loadStyleProfile = async () => {
    setStyleStatus('loading');
    try {
      const { data, error } = await supabase
        .from('communication_style_profiles')
        .select('*')
        .eq('user_id', attempt.user_id)
        .maybeSingle();
      if (error) {
        console.error('[Admin] loadStyleProfile', error);
        setStyleProfile(null);
        return;
      }
      const row = data as CommunicationStyleProfileRow | null | undefined;
      setStyleProfile(row ?? null);
    } catch (e) {
      console.error('[Admin] loadStyleProfile failed', e);
      setStyleProfile(null);
    } finally {
      setStyleStatus('idle');
    }
  };

  useEffect(() => {
    void loadStyleProfile();
  }, [attempt.user_id]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setAdminSessionUserId(session?.user?.id ?? null);
      setAdminSessionEmail(session?.user?.email ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(attempt)) return;
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        hypothesisId: 'verify-gap-banner',
        location: 'AdminInterviewDashboard.tsx:SummaryTab',
        message: 'holisticOnlyScenarioGapBannerShown',
        data: {
          attemptId: attempt.id,
          userTail: attempt.user_id?.slice(-8),
        },
        timestamp: Date.now(),
        runId: 'post-fix',
      }),
    }).catch(() => {});
    // #endregion
  }, [
    attempt.id,
    attempt.user_id,
    attempt.scenario_1_scores,
    attempt.scenario_2_scores,
    attempt.scenario_3_scores,
    attempt.pillar_scores,
    attempt.ai_reasoning,
  ]);

  const reprocessStyle = async () => {
    setStyleStatus('reprocessing');
    const errs: string[] = [];
    try {
      const textRes = await supabase.functions.invoke('analyze-interview-text', {
        body: { user_id: attempt.user_id, attempt_id: attempt.id },
      });
      if (textRes.error) {
        console.error('[Admin] analyze-interview-text invoke failed', textRes.error);
        errs.push(formatEdgeFunctionInvokeFailure('analyze-interview-text', textRes));
      } else {
        const be = functionInvokeBodyError(textRes.data);
        if (be) errs.push(`analyze-interview-text: ${be}`);
      }
      const audioRes = await supabase.functions.invoke('analyze-interview-audio', {
        body: {
          action: 'finalize_session',
          user_id: attempt.user_id,
          attempt_id: attempt.id,
        },
      });
      if (audioRes.error) {
        console.error('[Admin] analyze-interview-audio invoke failed', audioRes.error);
        errs.push(formatEdgeFunctionInvokeFailure('analyze-interview-audio', audioRes));
      } else {
        const be = functionInvokeBodyError(audioRes.data);
        if (be) errs.push(`analyze-interview-audio: ${be}`);
      }

      const errorText = errs.length > 0 ? errs.join(' | ') : null;
      const { error: updateErr } = await supabase
        .from('interview_attempts')
        .update({ communication_style_error: errorText })
        .eq('id', attempt.id)
        .eq('user_id', attempt.user_id);
      if (updateErr) {
        console.error('[Admin] communication_style_error update failed', updateErr);
      } else {
        setStylePipelineErrorDisplay(errorText);
      }

      await loadStyleProfile();
    } catch (e) {
      console.error('[Admin] reprocessStyle failed', e);
    } finally {
      setStyleStatus('idle');
    }
  };

  const totalScoresStored = getResolvedPillarScores(attempt);
  const aggregate = computeMarkerAggregateFromAttempt(attempt);
  const totalScores: Record<string, number> = {};
  MARKER_IDS.forEach((id) => {
    totalScores[id] = aggregate.scores[id] ?? totalScoresStored[id];
  });
  const scenario1Details = getScoreBundleDetails(attempt.scenario_1_scores);
  const scenario2Details = getScoreBundleDetails(attempt.scenario_2_scores);
  const scenario3Details = getScoreBundleDetails(attempt.scenario_3_scores);
  const moment4Bundle = getMomentScoreBundle(attempt, 4);
  const moment5Bundle = getMomentScoreBundle(attempt, 5);
  const moment4Details = getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_4_scores));
  const moment5Details = getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_5_scores));
  // #region agent log
  void (() => {
    const rawShape = (raw: unknown): string => {
      if (raw == null) return 'null';
      if (typeof raw === 'string') return `string(len=${raw.length})`;
      if (typeof raw !== 'object') return typeof raw;
      const o = raw as Record<string, unknown>;
      return `keys:${Object.keys(o).slice(0, 12).join(',')}`;
    };
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'c61a43' },
      body: JSON.stringify({
        sessionId: 'c61a43',
        hypothesisId: 'H1-H2-H5',
        location: 'AdminInterviewDashboard.tsx:SummaryTab',
        message: 'parsed scenario score bundles',
        data: {
          attemptId: attempt.id,
          userTail: attempt.user_id?.slice(-8),
          s1Raw: rawShape(attempt.scenario_1_scores),
          s2Raw: rawShape(attempt.scenario_2_scores),
          s3Raw: rawShape(attempt.scenario_3_scores),
          s1ParsedKeys: scenario1Details.scores ? Object.keys(scenario1Details.scores).length : 0,
          s2ParsedKeys: scenario2Details.scores ? Object.keys(scenario2Details.scores).length : 0,
          s3ParsedKeys: scenario3Details.scores ? Object.keys(scenario3Details.scores).length : 0,
          totalPillarResolved: Object.keys(totalScores).filter((k) => totalScores[k] != null).length,
        },
        timestamp: Date.now(),
        runId: 'pre-fix',
      }),
    }).catch(() => {});
  })();
  // #endregion
  const perScenario = [
    { key: 'scenario_1', label: 'Scenario 1', scores: scenario1Details.scores, summary: buildMomentOrScenarioSummary('Scenario 1', scenario1Details) },
    { key: 'scenario_2', label: 'Scenario 2', scores: scenario2Details.scores, summary: buildMomentOrScenarioSummary('Scenario 2', scenario2Details) },
    { key: 'scenario_3', label: 'Scenario 3', scores: scenario3Details.scores, summary: buildMomentOrScenarioSummary('Scenario 3', scenario3Details) },
    { key: 'moment_4', label: 'Moment 4', scores: moment4Bundle.scores, summary: buildMomentOrScenarioSummary('Moment 4', moment4Details, moment4Bundle.summary) },
    { key: 'moment_5', label: 'Moment 5', scores: moment5Bundle.scores, summary: buildMomentOrScenarioSummary('Moment 5', moment5Details, moment5Bundle.summary) },
  ];
  const outcome = resolveAdminPrimaryOutcomeDisplay(candidateUser ?? null, attempt);
  const gateScores = pillarScoresForGate(attempt);
  const gate = computeGateResultCore(gateScores);
  const gateFailureLines =
    !gate.pass && outcome.outcomeLabel !== 'none' ? formatGateFailureLines(gate, gateScores) : [];
  const reasoningPendingSummary = adminAiNarrativeStillPending(attempt);
  const holisticOnlyScenarioDataGap = adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(attempt);

  const [commFloorDismissOpen, setCommFloorDismissOpen] = useState(false);
  const [commFloorDismissNote, setCommFloorDismissNote] = useState('');
  const [commFloorDismissBusy, setCommFloorDismissBusy] = useState(false);

  const communicationFloorNeedsReview =
    attempt.communication_floor_flag === true && !attempt.communication_floor_dismissed_at;
  const communicationFloorDismissed =
    attempt.communication_floor_flag === true && !!attempt.communication_floor_dismissed_at;

  const isAdminViewer = isAmoraeaAdminConsoleEmail(adminSessionEmail);
  const recalculateScoresDisabled =
    !isAdminViewer ||
    recalcBusy ||
    attempt.reasoning_pending === true ||
    !attempt.completed_at;

  const runRecalculateScores = async () => {
    const displayName = candidateUser
      ? resolveAdminInterviewIntroDisplayName(candidateUser)
      : '—';
    const emailLine = candidateUser?.email ?? '—';
    const weightDisplay =
      attempt.weighted_score != null && Number.isFinite(attempt.weighted_score)
        ? attempt.weighted_score.toFixed(2)
        : '—';
    const passDisplay =
      attempt.passed === true ? 'Pass' : attempt.passed === false ? 'Fail' : 'none / withheld';
    const confirmMsg = [
      `Attempt ID: ${attempt.id}`,
      `User: ${displayName} (${emailLine})`,
      `User ID: ${attempt.user_id}`,
      '',
      `Original weighted score: ${weightDisplay}`,
      `Original verdict: ${passDisplay}`,
      '',
      'This will overwrite pillar_scores, weighted_score, passed, gate fields, and scenario_composites on this row with values recomputed from stored scenario slices using the current rubric (transcript reconciliation + aggregation + gate only).',
      '',
      'A snapshot of the previous scoring fields will be stored in original_scores.',
    ].join('\n');
    const ok = await confirmAsync({
      title: 'Recalculate scores?',
      message: confirmMsg,
      confirmText: 'Recalculate',
    });
    if (!ok) return;
    setRecalcBusy(true);
    try {
      const snap = snapshotAttemptScoresForAudit(attempt);
      const oldPillars = normalizePillarScoresMap(attempt.pillar_scores) ?? {};
      const result = recalculateAttemptScoresFromStoredSlices({
        transcript: attempt.transcript,
        scenario_1_scores: attempt.scenario_1_scores,
        scenario_2_scores: attempt.scenario_2_scores,
        scenario_3_scores: attempt.scenario_3_scores,
        scenario_specific_patterns: attempt.scenario_specific_patterns,
      });
      const nowIso = new Date().toISOString();

      if (result.kind === 'success') {
        const delta = computePillarScoreDelta(oldPillars, result.pillar_scores);
        const { error } = await supabase
          .from('interview_attempts')
          .update({
            original_scores: snap,
            pillar_scores: result.pillar_scores,
            weighted_score: result.gate.weightedScore,
            passed: result.gate.pass,
            gate_fail_reason: result.gate.failReason,
            gate_fail_reasons: result.gate.failReasonCodes ?? [],
            gate_fail_detail: result.gate.failReasonDetail ?? null,
            scenario_composites: result.scenarioCompositesJson,
            incomplete_reason: null,
            recalculated_at: nowIso,
            recalculation_delta: delta,
            recalculation_notes: result.notes,
          })
          .eq('id', attempt.id)
          .eq('user_id', attempt.user_id);
        if (error) {
          Alert.alert('Recalculation failed', error.message);
          return;
        }
        void remoteLog('[RECALCULATE_SCORES]', {
          triggeredByUserId: adminSessionUserId,
          triggeredByEmail: adminSessionEmail,
          attemptId: attempt.id,
          affectedUserId: attempt.user_id,
          weightedScoreBefore: attempt.weighted_score,
          weightedScoreAfter: result.gate.weightedScore,
          delta,
        });
        onAttemptMutated?.();
      } else {
        const { error } = await supabase
          .from('interview_attempts')
          .update({
            original_scores: snap,
            incomplete_reason: result.completionFailure.incomplete_reason,
            weighted_score: null,
            passed: null,
            gate_fail_reason: result.gate.failReason,
            gate_fail_reasons: [],
            gate_fail_detail: null,
            scenario_composites: null,
            recalculated_at: nowIso,
            recalculation_delta: {},
            recalculation_notes: result.notes,
          })
          .eq('id', attempt.id)
          .eq('user_id', attempt.user_id);
        if (error) {
          Alert.alert('Recalculation failed', error.message);
          return;
        }
        void remoteLog('[RECALCULATE_SCORES]', {
          triggeredByUserId: adminSessionUserId,
          triggeredByEmail: adminSessionEmail,
          attemptId: attempt.id,
          affectedUserId: attempt.user_id,
          outcome: 'incomplete',
          notes: result.notes,
        });
        Alert.alert(
          'Incomplete data',
          'Completion gate failed — weighted score and pass/fail were cleared. Fix stored scenario / moment JSON before a full recalculation.',
        );
        onAttemptMutated?.();
      }
    } finally {
      setRecalcBusy(false);
    }
  };

  return (
    <ScrollView style={styles.innerTabContent}>
      {reasoningPendingSummary ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#D4A84B', marginBottom: 12 }]}>
          <Text style={[styles.blockTitle, { color: '#E8D49A' }]}>AI narrative not ready</Text>
          <Text style={styles.blockText}>
            Scores are saved; long-form AI reasoning is still pending or failed. Open Tab 2 (AI Reasoning) to retry
            generation.
          </Text>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>Overall</Text>
      {isAdminViewer ? (
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            style={[styles.overrideChip, recalculateScoresDisabled && { opacity: 0.45 }]}
            onPress={() => void runRecalculateScores()}
            disabled={recalculateScoresDisabled}
            accessibilityRole="button"
            accessibilityLabel="Recalculate scores from stored scenario slices"
          >
            <Text style={styles.overrideChipText}>{recalcBusy ? 'Recalculating…' : 'Recalculate Scores'}</Text>
          </TouchableOpacity>
          {attempt.reasoning_pending === true ? (
            <Text style={[styles.blockText, { marginTop: 6 }]}>
              Recalculate is disabled while reasoning_pending is true.
            </Text>
          ) : !attempt.completed_at ? (
            <Text style={[styles.blockText, { marginTop: 6 }]}>
              Recalculate is only available for completed attempts.
            </Text>
          ) : null}
        </View>
      ) : null}
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date</Text>
        <Text style={styles.metaValue}>{formatAttemptDate(attempt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Time elapsed</Text>
        <Text style={styles.metaValue}>{formatAttemptElapsedDisplay(attempt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Result</Text>
        <Text style={[styles.metaValue, { color: outcome.color, textTransform: 'lowercase' }]}>{outcome.word}</Text>
      </View>
      {outcome.outcomeLabel === 'almost' ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Review</Text>
          <Text style={[styles.metaValue, { color: getAlmostPassColor(), fontSize: 12 }]}>
            Close to passing — human review suggested
          </Text>
        </View>
      ) : null}
      {gateFailureLines.length > 0 ? (
        <View style={[styles.block, { marginTop: 4, marginBottom: 8, paddingVertical: 8 }]}>
          <Text style={[styles.blockTitle, { marginBottom: 6 }]}>Why the gate failed</Text>
          {gateFailureLines.map((line, i) => (
            <Text key={`gate-${i}`} style={styles.blockText}>
              • {line}
            </Text>
          ))}
        </View>
      ) : null}
      {communicationFloorNeedsReview ? (
        <View
          style={[
            styles.block,
            {
              marginTop: 4,
              marginBottom: 10,
              paddingVertical: 10,
              borderLeftWidth: 4,
              borderLeftColor: '#D4A84B',
              backgroundColor: 'rgba(212, 168, 75, 0.08)',
            },
          ]}
        >
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={[styles.commFloorReviewBadge, { backgroundColor: '#E8C96B', color: '#3D3319' }]}>Review</Text>
            <Text style={[styles.blockTitle, { marginBottom: 0, color: '#E8D49A' }]}>communication_floor</Text>
          </View>
          <Text style={styles.blockText}>
            Average unprompted word count (scenarios A–C + moments 4–5) is{' '}
            <Text style={{ fontWeight: '600', color: '#F2E6BF' }}>
              {attempt.communication_floor_avg_unprompted_words != null
                ? attempt.communication_floor_avg_unprompted_words.toFixed(2)
                : '—'}
            </Text>{' '}
            — below the {COMMUNICATION_FLOOR_MIN_AVG_WORDS}-word admin review threshold. This is not a gate failure and
            does not change pass/fail.
          </Text>
          <TouchableOpacity
            style={styles.commFloorDismissButton}
            onPress={() => {
              setCommFloorDismissNote('');
              setCommFloorDismissOpen(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Dismiss communication floor review flag"
          >
            <Text style={styles.commFloorDismissButtonText}>Dismiss flag…</Text>
          </TouchableOpacity>
        </View>
      ) : communicationFloorDismissed ? (
        <View
          style={[
            styles.block,
            {
              marginTop: 4,
              marginBottom: 10,
              paddingVertical: 10,
              borderLeftWidth: 3,
              borderLeftColor: 'rgba(122, 154, 190, 0.45)',
              backgroundColor: 'rgba(122, 154, 190, 0.06)',
            },
          ]}
        >
          <Text style={[styles.blockTitle, { color: '#A8C4F0', marginBottom: 6 }]}>communication_floor (dismissed)</Text>
          <Text style={styles.blockText}>
            Avg unprompted words when flagged:{' '}
            {attempt.communication_floor_avg_unprompted_words != null
              ? attempt.communication_floor_avg_unprompted_words.toFixed(2)
              : '—'}{' '}
            · Threshold: {COMMUNICATION_FLOOR_MIN_AVG_WORDS}
          </Text>
          <Text style={styles.blockText} selectable>
            Dismissed:{' '}
            {attempt.communication_floor_dismissed_at
              ? new Date(attempt.communication_floor_dismissed_at).toLocaleString()
              : '—'}{' '}
            · Reviewer id: {attempt.communication_floor_dismissed_by ?? '—'}
          </Text>
          {attempt.communication_floor_dismiss_note ? (
            <Text style={styles.blockText} selectable>
              Note: {attempt.communication_floor_dismiss_note}
            </Text>
          ) : null}
        </View>
      ) : null}
      <Modal visible={commFloorDismissOpen} transparent animationType="fade">
        <View style={styles.commFloorModalBackdrop}>
          <View style={styles.commFloorModalCard}>
            <Text style={styles.commFloorModalTitle}>Dismiss communication_floor flag</Text>
            <Text style={styles.blockText}>
              Optional note for the audit log (why transcript style looked acceptable).
            </Text>
            <TextInput
              value={commFloorDismissNote}
              onChangeText={setCommFloorDismissNote}
              placeholder="Note"
              placeholderTextColor="rgba(122, 154, 190, 0.45)"
              multiline
              style={styles.commFloorModalInput}
            />
            <View style={styles.commFloorModalActions}>
              <TouchableOpacity
                style={styles.commFloorModalCancel}
                onPress={() => !commFloorDismissBusy && setCommFloorDismissOpen(false)}
                disabled={commFloorDismissBusy}
              >
                <Text style={styles.commFloorModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.commFloorModalConfirm}
                disabled={commFloorDismissBusy}
                onPress={() => {
                  void (async () => {
                    setCommFloorDismissBusy(true);
                    try {
                      const { data: authData, error: authErr } = await supabase.auth.getUser();
                      if (authErr || !authData?.user?.id) {
                        Alert.alert('Not signed in', authErr?.message ?? 'Could not read admin session.');
                        return;
                      }
                      const { error } = await supabase
                        .from('interview_attempts')
                        .update({
                          communication_floor_dismissed_at: new Date().toISOString(),
                          communication_floor_dismissed_by: authData.user.id,
                          communication_floor_dismiss_note: commFloorDismissNote.trim() || null,
                        })
                        .eq('id', attempt.id)
                        .eq('user_id', attempt.user_id);
                      if (error) {
                        Alert.alert('Could not save', error.message);
                        return;
                      }
                      setCommFloorDismissOpen(false);
                      onAttemptMutated?.();
                    } finally {
                      setCommFloorDismissBusy(false);
                    }
                  })();
                }}
              >
                <Text style={styles.commFloorModalConfirmText}>{commFloorDismissBusy ? 'Saving…' : 'Dismiss flag'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Weighted score</Text>
        <Text style={styles.metaValue}>{formatScoreCell(attempt.weighted_score)}</Text>
      </View>

      <Text style={styles.sectionTitle}>8 Traits (Total)</Text>
      {PILLAR_ROWS.map((p) => (
        <View key={p.id} style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>{p.label}</Text>
          <Text style={styles.scoreValue}>
            {formatScoreCell(totalScores[p.id])}
            {(aggregate.contributorCounts[p.id] ?? 0) > 0 &&
            (aggregate.contributorCounts[p.id] ?? 0) < 2
              ? ' *'
              : ''}
          </Text>
        </View>
      ))}
      <Text style={styles.blockText}>* score based on limited evidence (single contributing moment)</Text>

      {holisticOnlyScenarioDataGap ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#6B8CDB', marginBottom: 12 }]}>
          <Text style={[styles.blockTitle, { color: '#A8C4F0' }]}>Per-scenario scores not on file</Text>
          <Text style={styles.blockText}>
            This row has combined trait scores (holistic merge), but the per-scenario JSON columns
            (scenario_1/2/3_scores) are empty—common after deferred completion that only persisted merged scores. The
            breakdown below cannot show real slice-level numbers until those columns are backfilled from the stored
            transcript (engineering) or the interview is re-run with slice persistence.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Scenario Breakdown</Text>
      {perScenario.map((item) => (
        <View key={item.label} style={styles.block}>
          <Text style={styles.blockTitle}>{item.label}</Text>
          <Text style={styles.blockText}>{item.summary}</Text>
          {PILLAR_ROWS.map((p) => (
            <View key={`${item.label}-${p.id}`} style={styles.scoreRow}>
              <Text style={styles.scoreLabel}>{p.short}</Text>
              <Text style={styles.scoreValue}>
                {markerIsAssessedInSection(item.key, p.id)
                  ? formatScoreCell(
                      p.id === 'contempt'
                        ? sliceContemptDisplayValue(item.scores)
                        : item.scores?.[p.id],
                    )
                  : '—'}
              </Text>
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.sectionTitle}>Communication Style</Text>
      {stylePipelineErrorDisplay ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#E87A7A', paddingLeft: 10 }]}>
          <Text style={[styles.blockTitle, { color: '#B33A3A' }]}>Style pipeline error (stored on attempt)</Text>
          <Text style={styles.blockText}>{stylePipelineErrorDisplay}</Text>
        </View>
      ) : null}
      <View style={styles.block}>
        <Text style={[styles.blockText, styles.styleTranslationNote]}>
          Translation thresholds are defined in src/utilities/styleTranslations.ts and can be adjusted as calibration
          data accumulates.
        </Text>
        <Text style={styles.blockText}>
          Processing status:{' '}
          {styleProfile
            ? styleProfile.text_confidence != null && styleProfile.audio_confidence != null
              ? 'available'
              : 'partial'
            : styleStatus === 'loading'
              ? 'loading'
              : 'not processed'}
        </Text>
        <Text style={styles.blockText}>Text confidence: {formatScoreCell((styleProfile?.text_confidence ?? null) !== null ? Number(styleProfile?.text_confidence) * 10 : null)}</Text>
        <Text style={styles.blockText}>Audio confidence: {formatScoreCell((styleProfile?.audio_confidence ?? null) !== null ? Number(styleProfile?.audio_confidence) * 10 : null)}</Text>
        <Text style={styles.blockText}>Overall confidence: {formatScoreCell((styleProfile?.overall_confidence ?? null) !== null ? Number(styleProfile?.overall_confidence) * 10 : null)}</Text>

        {(() => {
          const live =
            styleProfile != null
              ? translateStyleProfile(styleProfileFromDbRow(styleProfile as unknown as Record<string, unknown>))
              : null;
          const primaryStored = styleProfile?.style_labels_primary;
          const secondaryStored = styleProfile?.style_labels_secondary;
          const summaryStored = styleProfile?.matchmaker_summary;
          const lowNoteStored = styleProfile?.low_confidence_note;
          const primaryForDisplay = Array.isArray(primaryStored)
            ? primaryStored
            : Array.isArray(live?.primary)
              ? live.primary
              : [];
          const secondaryForDisplay = Array.isArray(secondaryStored)
            ? secondaryStored
            : Array.isArray(live?.secondary)
              ? live.secondary
              : [];
          return (
            <>
              {primaryForDisplay.length > 0 ? (
                <Text style={styles.blockText}>Primary labels: {primaryForDisplay.join(', ')}</Text>
              ) : null}
              {secondaryForDisplay.length > 0 ? (
                <Text style={styles.blockText}>Secondary labels: {secondaryForDisplay.join(', ')}</Text>
              ) : null}
              {(live?.matchmaker_summary || summaryStored) ? (
                <Text style={styles.blockText}>
                  Matchmaker summary: {live?.matchmaker_summary ?? summaryStored}
                </Text>
              ) : null}
              {(lowNoteStored || live?.low_confidence_note) ? (
                <Text style={styles.blockText}>Low confidence: {lowNoteStored ?? live?.low_confidence_note}</Text>
              ) : null}
            </>
          );
        })()}

        {(
          [
            ['Emotional vs Analytical', styleProfile?.emotional_analytical_score, describeEmotionalAnalyticalAxis],
            ['Narrative vs Conceptual', styleProfile?.narrative_conceptual_score, describeNarrativeConceptualAxis],
            ['Certainty vs Ambiguity', styleProfile?.certainty_ambiguity_score, describeCertaintyAmbiguityAxis],
            ['Relational vs Individual', styleProfile?.relational_individual_score, describeRelationalIndividualAxis],
          ] as const
        ).map(([label, value, describe]) => {
          const n = coerceScoreNumber(value) ?? null;
          const exp =
            n == null
              ? ''
              : label === 'Emotional vs Analytical'
                ? describeEmotionalAnalyticalAxis(n, styleProfile as unknown as Record<string, unknown> | null)
                : describe(n);
          return (
            <View key={label} style={styles.styleBarRow}>
              <Text style={styles.scoreLabel}>{label}</Text>
              <View style={styles.styleBarTrack}>
                <View style={[styles.styleBarFill, { width: `${Math.max(0, Math.min(100, (n ?? 0) * 100))}%` }]} />
              </View>
              <View style={styles.styleBarValueCol}>
                <Text style={styles.scoreValue}>{n == null ? '—' : n.toFixed(2)}</Text>
                {n != null ? <Text style={styles.styleExperienceLabel}>→ {exp}</Text> : null}
              </View>
            </View>
          );
        })}
        {[
          ['Warmth', styleProfile?.warmth_score],
          ['Expressiveness', styleProfile?.emotional_expressiveness],
        ].map(([label, value]) => {
          const n = coerceScoreNumber(value) ?? null;
          const ac = coerceScoreNumber(styleProfile?.audio_confidence) ?? null;
          const exp =
            label === 'Warmth'
              ? describeWarmthAxis(n, ac ?? null)
              : describeExpressivenessAxis(n, ac ?? null);
          return (
            <View key={String(label)} style={styles.styleBarRow}>
              <Text style={styles.scoreLabel}>{label}</Text>
              <View style={styles.styleBarTrack}>
                <View style={[styles.styleBarFill, { width: `${Math.max(0, Math.min(100, (n ?? 0) * 100))}%` }]} />
              </View>
              <View style={styles.styleBarValueCol}>
                <Text style={styles.scoreValue}>{n == null ? '—' : n.toFixed(2)}</Text>
                {n != null ? <Text style={styles.styleExperienceLabel}>→ {exp}</Text> : null}
              </View>
            </View>
          );
        })}

        <Pressable
          onPress={() => void reprocessStyle()}
          style={({ pressed }) => [styles.reprocessButton, pressed && styles.reprocessButtonPressed]}
          disabled={styleStatus === 'reprocessing'}
        >
          <Text style={styles.reprocessButtonText}>
            {styleStatus === 'reprocessing' ? 'Reprocessing...' : 'Reprocess style pipelines'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function ReasoningTab({
  attempt,
  onRefreshAfterReasoning,
}: {
  attempt: AttemptRow;
  onRefreshAfterReasoning?: () => void;
}) {
  const [reasoningRetrying, setReasoningRetrying] = useState(false);
  const [reasoningRetryError, setReasoningRetryError] = useState<string | null>(null);
  const reasoningPending = adminAiNarrativeStillPending(attempt);

  const reasoning = parseObject(attempt.ai_reasoning);
  if (!reasoning && !reasoningPending) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>AI reasoning is not available for this test.</Text>
      </View>
    );
  }
  const scenarioObservations = parseObject(reasoning?.scenario_observations);
  const breakdown = parseObject(reasoning?.construct_breakdown);
  const holisticOnlyScenarioDataGap = adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(attempt);

  const scenarioBundles = [
    {
      key: 'scenario_1',
      label: 'Scenario 1',
      details: getScoreBundleDetails(attempt.scenario_1_scores),
    },
    {
      key: 'scenario_2',
      label: 'Scenario 2',
      details: getScoreBundleDetails(attempt.scenario_2_scores),
    },
    {
      key: 'scenario_3',
      label: 'Scenario 3',
      details: getScoreBundleDetails(attempt.scenario_3_scores),
    },
    {
      key: 'moment_4',
      label: 'Moment 4',
      details: getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_4_scores)),
    },
    {
      key: 'moment_5',
      label: 'Moment 5',
      details: getScoreBundleDetails(parseObject(parseObject(attempt.scenario_specific_patterns)?.moment_5_scores)),
    },
  ];

  return (
    <ScrollView style={styles.innerTabContent}>
      {reasoningPending ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#D4A84B', marginBottom: 12 }]}>
          <Text style={[styles.blockTitle, { color: '#E8D49A' }]}>Narrative reasoning pending or failed</Text>
          <Text style={styles.blockText}>
            Scores and transcript were saved, but the full AI narrative was not generated in-session
            {reasoning?.last_error != null ? ` (${String(reasoning.last_error)})` : ''}. Retry to call the model again
            from this dashboard.
          </Text>
          <TouchableOpacity
            disabled={reasoningRetrying}
            onPress={() => {
              setReasoningRetryError(null);
              setReasoningRetrying(true);
              void (async () => {
                const r = await adminRetryAIReasoningForAttempt(attempt.id);
                setReasoningRetrying(false);
                if ('error' in r) setReasoningRetryError(r.error);
                else onRefreshAfterReasoning?.();
              })();
            }}
            style={styles.reprocessButton}
          >
            <Text style={styles.reprocessButtonText}>{reasoningRetrying ? 'Generating…' : 'Retry AI reasoning'}</Text>
          </TouchableOpacity>
          {reasoningRetryError ? (
            <Text style={[styles.blockText, { color: '#E87A7A', marginTop: 8 }]}>{reasoningRetryError}</Text>
          ) : null}
        </View>
      ) : null}

      {holisticOnlyScenarioDataGap ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#6B8CDB', marginBottom: 12 }]}>
          <Text style={[styles.blockTitle, { color: '#A8C4F0' }]}>Per-scenario score data missing</Text>
          <Text style={styles.blockText}>
            Scenario pillar explanations below need slice scores on the attempt row. This run only has merged scores—see
            the Summary tab for the same notice.
          </Text>
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Scenario Reasoning</Text>
      {['scenario_1', 'scenario_2', 'scenario_3'].map((key, idx) => {
        const obs = parseObject(scenarioObservations?.[key]);
        return (
          <View key={key} style={styles.block}>
            <Text style={styles.blockTitle}>{getString(obs?.name) ?? `Scenario ${idx + 1}`}</Text>
            <Text style={styles.blockText}>{getString(obs?.what_happened) ?? 'No scenario reasoning recorded.'}</Text>
            <Text style={styles.blockText}>{getString(obs?.what_it_revealed) ?? ''}</Text>
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Scenario Pillar Explanations</Text>
      {scenarioBundles.map((bundle) => {
        const obs = parseObject(scenarioObservations?.[bundle.key]);
        const title = getString(obs?.name) ?? bundle.label;
        const scoredPillars = PILLAR_ROWS.filter(
          (p) =>
            markerIsAssessedInSection(bundle.key, p.id) &&
            coerceScoreNumber(bundle.details.scores?.[p.id]) != null
        );
        return (
          <View key={bundle.key} style={styles.block}>
            <Text style={styles.blockTitle}>{title}</Text>
            {scoredPillars.length === 0 ? (
              <Text style={styles.blockText}>No per-pillar scenario evidence was recorded for this section.</Text>
            ) : (
              scoredPillars.map((p) => {
                const score = formatScoreCell(bundle.details.scores?.[p.id]);
                const confidence = bundle.details.confidence[p.id] ?? 'unspecified confidence';
                const evidence = bundle.details.evidence[p.id] ?? 'No specific evidence was captured in this run.';
                return (
                  <Text key={`${bundle.key}-${p.id}`} style={styles.blockText}>
                    {p.label} was rated {score}/10 ({confidence}) because {evidence}.
                  </Text>
                );
              })
            )}
          </View>
        );
      })}

      <Text style={styles.sectionTitle}>Pillar-by-Pillar Reasoning</Text>
      {PILLAR_ROWS.map((p) => {
        const pillar = parseObject(breakdown?.[p.id]);
        return (
          <View key={p.id} style={styles.block}>
            <Text style={styles.blockTitle}>{p.label}</Text>
            <Text style={styles.blockText}>Score: {formatScoreCell(pillar?.score)}</Text>
            <Text style={styles.blockText}>{getString(pillar?.summary) ?? 'No summary recorded.'}</Text>
            <Text style={styles.blockText}>{getString(pillar?.where_you_struggled) ?? ''}</Text>
            <Text style={styles.blockText}>{getString(pillar?.what_you_did_well) ?? ''}</Text>
          </View>
        );
      })}
    </ScrollView>
  );
}

function TranscriptTab({ attempt }: { attempt: AttemptRow }) {
  const transcript = attempt.transcript ?? [];
  if (transcript.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No transcript available for this test.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.innerTabContent}>
      {transcript.map((m, idx) => (
        <Text key={`${m.role}-${idx}`} style={styles.transcriptLine}>
          {m.role}: {m.content ?? ''}
        </Text>
      ))}
    </ScrollView>
  );
}

function FeedbackTab({ attempt }: { attempt: AttemptRow }) {
  const perConstruct = parseObject(attempt.per_construct_ratings) ?? {};
  const hasPerConstruct = Object.keys(perConstruct).length > 0;
  if (!attempt.user_analysis_comment && attempt.user_analysis_rating == null && !hasPerConstruct) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No user feedback submitted for this test.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.innerTabContent}>
      <Text style={styles.sectionTitle}>User Feedback</Text>
      <Text style={styles.blockText}>Overall rating: {attempt.user_analysis_rating ?? '—'}</Text>
      <Text style={styles.blockText}>{attempt.user_analysis_comment ?? 'No overall comment.'}</Text>
      {hasPerConstruct && (
        <View style={styles.block}>
          <Text style={styles.blockTitle}>Question-by-question feedback</Text>
          {Object.entries(perConstruct).map(([key, value]) => {
            const row = parseObject(value);
            const label = USER_FEEDBACK_LABELS[key] ?? formatConstruct(key);
            const comment = getString(row?.comment);
            const rating = coerceScoreNumber(row?.rating);
            return (
              <View key={key} style={styles.block}>
                <Text style={styles.blockTitle}>{label}</Text>
                {rating !== undefined ? <Text style={styles.blockText}>Rating: {rating}</Text> : null}
                <Text style={styles.blockText}>{comment ?? 'No comment.'}</Text>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

function UserDetails({
  userData,
  fullAttempts,
  attemptsLoading,
  attemptsError,
  onBack,
  onDeleteAccount,
  canDelete,
  deleting,
  onRefreshData,
}: {
  userData: UserGroup;
  /** Latest run only (full attempt row). */
  fullAttempts: AttemptRow[];
  attemptsLoading: boolean;
  attemptsError: string | null;
  onBack: () => void;
  onDeleteAccount: () => void;
  canDelete: boolean;
  deleting: boolean;
  onRefreshData: () => void;
}) {
  const attempts = getAttemptsSorted(fullAttempts);
  const [activeInnerTab, setActiveInnerTab] = useState<'summary' | 'reasoning' | 'transcript' | 'feedback'>('summary');
  const [overrideBusy, setOverrideBusy] = useState(false);

  const selectedAttempt = attempts[0] ?? null;
  const u = userData.user;
  const detailLaunchPhone = trimLaunchNotificationPhone(u.launch_notification_phone);

  const applyPassOverride = useCallback(
    async (mode: 'pass' | 'fail' | 'clear') => {
      if (!u.id) return;
      setOverrideBusy(true);
      try {
        if (mode === 'clear') {
          const { error } = await supabase
            .from('users')
            .update({
              interview_passed_admin_override: null,
              interview_passed: u.interview_passed_computed ?? null,
            })
            .eq('id', u.id);
          if (error) {
            Alert.alert('Update failed', error.message);
            return;
          }
          onRefreshData();
          return;
        }
        const pass = mode === 'pass';
        const { error } = await supabase
          .from('users')
          .update({
            interview_passed_admin_override: pass,
            interview_passed: pass,
          })
          .eq('id', u.id);
        if (error) {
          Alert.alert('Update failed', error.message);
          return;
        }
        onRefreshData();
      } finally {
        setOverrideBusy(false);
      }
    },
    [onRefreshData, u.id, u.interview_passed_computed],
  );

  return (
    <View style={styles.fullScreen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <TouchableOpacity onPress={onBack}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          {canDelete ? (
            <TouchableOpacity
              onPress={() => void onDeleteAccount()}
              disabled={deleting}
              accessibilityRole="button"
              accessibilityLabel="Delete account"
            >
              <Text style={[styles.headerDeleteText, deleting && styles.userCardDeleteTextDisabled]}>
                {deleting ? 'Deleting…' : 'Delete account'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.headerTitle}>{resolveAdminInterviewIntroDisplayName(u)}</Text>
        <Text style={styles.headerSub}>{u.email ?? '—'}</Text>
        {detailLaunchPhone ? (
          <Text style={styles.headerSub} selectable>
            Phone: <Text style={styles.launchNotificationPhoneBold}>{detailLaunchPhone}</Text>
          </Text>
        ) : null}
        <Text style={styles.headerSub}>{formatUserInterviewDateLine(userData)}</Text>
        <Text style={styles.headerPassMeta} selectable>
          Gate (computed): {u.interview_passed_computed == null ? '—' : String(u.interview_passed_computed)} ·
          Admin override: {formatAdminPassFailLabel(u.interview_passed_admin_override)} ·
          Effective routing: {u.interview_passed == null ? '—' : String(u.interview_passed)}
        </Text>
        <View style={styles.overrideButtonRow}>
          <TouchableOpacity
            style={styles.overrideChip}
            onPress={() => void applyPassOverride('pass')}
            disabled={overrideBusy}
            accessibilityRole="button"
            accessibilityLabel="Force pass"
          >
            <Text style={styles.overrideChipText}>Force pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overrideChip}
            onPress={() => void applyPassOverride('fail')}
            disabled={overrideBusy}
            accessibilityRole="button"
            accessibilityLabel="Force fail"
          >
            <Text style={styles.overrideChipText}>Force fail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overrideChip}
            onPress={() => void applyPassOverride('clear')}
            disabled={overrideBusy}
            accessibilityRole="button"
            accessibilityLabel="Clear override"
          >
            <Text style={styles.overrideChipText}>Use gate only</Text>
          </TouchableOpacity>
        </View>
      </View>

      <InProgressTranscriptSection user={userData.user} onRefresh={onRefreshData} />

      {attemptsLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading interview data…</Text>
        </View>
      ) : attemptsError ? (
        <View style={styles.emptyState}>
          <Text style={styles.listErrorTitle}>Could not load tests</Text>
          <Text style={styles.listErrorDetail} selectable>
            {attemptsError}
          </Text>
        </View>
      ) : attempts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {userHasInProgressInterview(userData.user)
              ? 'No completed tests yet — transcript above updates while they interview.'
              : 'No tests found for this user.'}
          </Text>
          {userData.user.latest_attempt_id || userData.user.interview_completed ? (
            <Text style={styles.emptyHint}>
              Interview data exists for this account — a retake is usually not needed. If attempts stay empty after
              refreshing, apply{' '}
              <Text style={styles.emptyHintMono}>20260423150000_admin_rls_is_amoraea_admin_function.sql</Text> (admin
              check via <Text style={styles.emptyHintMono}>auth.users</Text> email — JWT email in RLS is unreliable), and
              ensure <Text style={styles.emptyHintMono}>20260423140000_interview_attempts_rls_admin_and_own.sql</Text>{' '}
              policies exist for <Text style={styles.emptyHintMono}>interview_attempts</Text>.
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={styles.detailsLayoutSingle}>
          <View style={styles.detailsPaneFull}>
            <View style={styles.innerTabsRow}>
              {[
                { id: 'summary' as const, label: 'Tab 1: Summary' },
                { id: 'reasoning' as const, label: 'Tab 2: AI Reasoning' },
                { id: 'transcript' as const, label: 'Tab 3: Transcript' },
                { id: 'feedback' as const, label: 'Tab 4: User Feedback' },
              ].map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.innerTab, activeInnerTab === t.id && styles.innerTabActive]}
                  onPress={() => setActiveInnerTab(t.id)}
                >
                  <Text style={[styles.innerTabText, activeInnerTab === t.id && styles.innerTabTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {selectedAttempt && activeInnerTab === 'summary' && (
              <SummaryTab attempt={selectedAttempt} onAttemptMutated={onRefreshData} candidateUser={u} />
            )}
            {selectedAttempt && activeInnerTab === 'reasoning' && (
              <ReasoningTab attempt={selectedAttempt} onRefreshAfterReasoning={onRefreshData} />
            )}
            {selectedAttempt && activeInnerTab === 'transcript' && <TranscriptTab attempt={selectedAttempt} />}
            {selectedAttempt && activeInnerTab === 'feedback' && <FeedbackTab attempt={selectedAttempt} />}
          </View>
        </View>
      )}
    </View>
  );
}

export function AdminAttemptTabsView({
  attemptId,
  userId,
  showFeedbackTab = true,
  candidateUser,
}: {
  attemptId: string | null;
  userId?: string;
  showFeedbackTab?: boolean;
  candidateUser?: UserRow | null;
}) {
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeInnerTab, setActiveInnerTab] = useState<'summary' | 'reasoning' | 'transcript' | 'feedback'>('summary');

  const refreshAttempt = useCallback(async () => {
    try {
      if (attemptId) {
        const { data } = await supabase.from('interview_attempts').select('*').eq('id', attemptId).maybeSingle();
        setAttempt((data as AttemptRow | null) ?? null);
      } else if (userId) {
        const { data } = await supabase
          .from('interview_attempts')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        setAttempt((data as AttemptRow | null) ?? null);
      }
    } catch {
      setAttempt(null);
    }
  }, [attemptId, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (attemptId) {
          const { data } = await supabase
            .from('interview_attempts')
            .select('*')
            .eq('id', attemptId)
            .maybeSingle();
          if (!cancelled) setAttempt((data as AttemptRow | null) ?? null);
        } else if (userId) {
          const { data } = await supabase
            .from('interview_attempts')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (!cancelled) setAttempt((data as AttemptRow | null) ?? null);
        } else {
          if (!cancelled) setAttempt(null);
        }
      } catch {
        if (!cancelled) setAttempt(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attemptId, userId]);

  if (loading) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>Loading test details...</Text>
      </View>
    );
  }

  if (!attempt) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No test details available yet.</Text>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', maxWidth: 980 }}>
      <View style={styles.innerTabsRow}>
        {[
          { id: 'summary' as const, label: 'Tab 1: Summary' },
          { id: 'reasoning' as const, label: 'Tab 2: AI Reasoning' },
          { id: 'transcript' as const, label: 'Tab 3: Transcript' },
          ...(showFeedbackTab ? [{ id: 'feedback' as const, label: 'Tab 4: User Feedback' }] : []),
        ].map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.innerTab, activeInnerTab === t.id && styles.innerTabActive]}
            onPress={() => setActiveInnerTab(t.id)}
          >
            <Text style={[styles.innerTabText, activeInnerTab === t.id && styles.innerTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeInnerTab === 'summary' && (
        <SummaryTab attempt={attempt} onAttemptMutated={refreshAttempt} candidateUser={candidateUser ?? null} />
      )}
      {activeInnerTab === 'reasoning' && <ReasoningTab attempt={attempt} onRefreshAfterReasoning={refreshAttempt} />}
      {activeInnerTab === 'transcript' && <TranscriptTab attempt={attempt} />}
      {showFeedbackTab && activeInnerTab === 'feedback' && <FeedbackTab attempt={attempt} />}
    </View>
  );
}

const STATUS_FILTER_OPTIONS: { id: AdminUserStatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'incomplete', label: 'Incomplete' },
  { id: 'in_progress', label: 'In progress' },
  { id: 'pass', label: 'Pass' },
  { id: 'fail', label: 'Fail' },
  { id: 'almost', label: 'Almost' },
  { id: 'no_result', label: 'No result' },
];

const TIME_RANGE_OPTIONS: { id: TimeRangeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: '24h' },
  { id: 'week', label: '7d' },
  { id: 'month', label: '30d' },
  { id: 'custom', label: 'Custom' },
];

const REVIEWED_COHORT_OPTIONS: { id: ReviewedCohortFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'reviewed', label: 'On' },
  { id: 'unreviewed', label: 'Off' },
];

export function AdminInterviewDashboard({ onClose }: { onClose: () => void }) {
  const [adminMainView, setAdminMainView] = useState<'cohort' | 'feedback'>('cohort');
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');
  const [customTimeFrom, setCustomTimeFrom] = useState('');
  const [customTimeTo, setCustomTimeTo] = useState('');
  const [reviewedCohortFilter, setReviewedCohortFilter] = useState<ReviewedCohortFilter>('all');
  const [hideIncomplete, setHideIncomplete] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [detailAttempts, setDetailAttempts] = useState<AttemptRow[] | null>(null);
  const [detailAttemptsLoading, setDetailAttemptsLoading] = useState(false);
  const [detailAttemptsError, setDetailAttemptsError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      const { groups, errorMessage } = await fetchAdminUsersList();
      setUsers(groups);
      setListError(errorMessage);
      if (selectedUserId) {
        const g = groups.find((x) => x.user.id === selectedUserId);
        const { attempts, errorMessage: detailErr } = await fetchLatestFullAttemptForUser(
          selectedUserId,
          g?.user.latest_attempt_id,
        );
        if (detailErr) {
          setDetailAttemptsError(detailErr);
          setDetailAttempts([]);
        } else {
          setDetailAttemptsError(null);
          setDetailAttempts(attempts);
        }
      }
    } catch (err) {
      console.error('Admin panel fetch failed:', err);
      setUsers([]);
      setListError(err instanceof Error ? err.message : 'Fetch failed');
    }
  }, [selectedUserId]);

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setCurrentUserId(session?.user?.id ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { groups, errorMessage } = await fetchAdminUsersList();
        if (!cancelled) {
          setUsers(groups);
          setListError(errorMessage);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Admin panel fetch failed:', err);
          setUsers([]);
          setListError(err instanceof Error ? err.message : 'Fetch failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const canDeleteUser = useCallback(
    (row: UserRow) => {
      if (!row?.id) return false;
      if (currentUserId != null && row.id === currentUserId) return false;
      if ((row.email ?? '').toLowerCase() === ADMIN_CONSOLE_EMAIL) return false;
      return true;
    },
    [currentUserId],
  );

  const handleDeleteUser = useCallback(
    async (row: UserRow) => {
      if (!canDeleteUser(row)) return;
      const label = row.email ?? row.id;
      const ok = await confirmDeleteAccount(
        `Permanently delete account ${label}? All interview data for this user will be removed. This cannot be undone.`,
      );
      if (!ok) return;
      setDeletingUserId(row.id);
      try {
        const result = await deleteUserAccountViaEdge(row.id);
        if ('error' in result) {
          Alert.alert('Delete failed', result.error);
          return;
        }
        await refreshUsers();
        setSelectedUserId((prev) => {
          if (prev === row.id) {
            setDetailAttempts(null);
            setDetailAttemptsError(null);
            return null;
          }
          return prev;
        });
      } finally {
        setDeletingUserId(null);
      }
    },
    [canDeleteUser, refreshUsers],
  );

  useEffect(() => {
    if (selectedUserId && !users.some((g) => g.user.id === selectedUserId)) {
      setSelectedUserId(null);
      setDetailAttempts(null);
      setDetailAttemptsError(null);
    }
  }, [users, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) {
      setDetailAttempts(null);
      setDetailAttemptsError(null);
      setDetailAttemptsLoading(false);
      return;
    }
    let cancelled = false;
    setDetailAttemptsLoading(true);
    setDetailAttemptsError(null);
    const latestId = users.find((g) => g.user.id === selectedUserId)?.user.latest_attempt_id;
    void fetchLatestFullAttemptForUser(selectedUserId, latestId).then(({ attempts, errorMessage: detailErr }) => {
      if (cancelled) return;
      setDetailAttemptsLoading(false);
      if (detailErr) {
        setDetailAttemptsError(detailErr);
        setDetailAttempts([]);
      } else {
        setDetailAttemptsError(null);
        setDetailAttempts(attempts);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedUserId, users]);

  const selectedGroup = selectedUserId ? users.find((g) => g.user.id === selectedUserId) : null;

  const pipelineFiltered = useMemo(() => {
    let list = users;
    list = list.filter((g) => userMatchesTimeRange(g, timeRangeFilter, customTimeFrom, customTimeTo));
    if (reviewedCohortFilter === 'reviewed') {
      list = list.filter((g) => g.user.interview_cohort_admin_reviewed === true);
    } else if (reviewedCohortFilter === 'unreviewed') {
      list = list.filter((g) => !g.user.interview_cohort_admin_reviewed);
    }
    // "Only done" excludes non-completed interviews; skip when explicitly filtering Incomplete (in progress | no result).
    if (hideIncomplete && statusFilter !== 'incomplete') {
      list = list.filter((g) => g.user.interview_completed === true);
    }
    if (statusFilter !== 'all') {
      list = list.filter((g) => {
        const s = classifyAdminUserListStatus(g);
        if (statusFilter === 'incomplete') return s === 'in_progress' || s === 'no_result';
        return s === statusFilter;
      });
    }
    return list;
  }, [users, timeRangeFilter, customTimeFrom, customTimeTo, reviewedCohortFilter, hideIncomplete, statusFilter]);

  const cohortStats = useMemo(() => computeCohortHeaderStats(pipelineFiltered), [pipelineFiltered]);

  const handleExportCsv = useCallback(() => {
    if (pipelineFiltered.length === 0) {
      Alert.alert('No users to export');
      return;
    }
    const body = buildAdminCohortExportCsv(pipelineFiltered);
    const today = formatYmdLocal(new Date());
    triggerAdminCohortCsvDownload(`amoraea_users_${today}.csv`, body);
  }, [pipelineFiltered]);

  const setUserCohortReviewed = useCallback(async (userId: string, next: boolean) => {
    const { error } = await supabase
      .from('users')
      .update({ interview_cohort_admin_reviewed: next })
      .eq('id', userId);
    if (error) {
      Alert.alert('Could not save', error.message);
      return;
    }
    await refreshUsers();
  }, [refreshUsers]);

  if (selectedUserId && selectedGroup) {
    return (
      <UserDetails
        userData={selectedGroup}
        fullAttempts={detailAttempts ?? []}
        attemptsLoading={detailAttemptsLoading}
        attemptsError={detailAttemptsError}
        onBack={() => {
          setSelectedUserId(null);
          setDetailAttempts(null);
          setDetailAttemptsError(null);
          setDetailAttemptsLoading(false);
        }}
        canDelete={canDeleteUser(selectedGroup.user)}
        deleting={deletingUserId === selectedGroup.user.id}
        onDeleteAccount={() => void handleDeleteUser(selectedGroup.user)}
        onRefreshData={() => void refreshUsers()}
      />
    );
  }

  return (
    <View style={styles.fullScreen}>
      <View style={styles.header}>
        <View style={styles.headerTopRow}>
          <Text style={styles.headerTitle}>Admin Panel</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.backText}>← Back to interview</Text>
          </TouchableOpacity>
        </View>
        {adminMainView === 'cohort' ? (
          <View style={styles.headerExportRow}>
            <TouchableOpacity
              style={[styles.exportCsvButton, (loading || !!listError) && styles.exportCsvButtonDisabled]}
              onPress={handleExportCsv}
              disabled={loading || !!listError}
              accessibilityRole="button"
              accessibilityLabel="Export CSV"
            >
              <Text style={styles.exportCsvButtonText}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, adminMainView === 'cohort' && styles.filterChipActive]}
            onPress={() => setAdminMainView('cohort')}
            accessibilityRole="button"
            accessibilityState={{ selected: adminMainView === 'cohort' }}
          >
            <Text style={[styles.filterChipText, adminMainView === 'cohort' && styles.filterChipTextActive]}>
              Cohort
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, adminMainView === 'feedback' && styles.filterChipActive]}
            onPress={() => setAdminMainView('feedback')}
            accessibilityRole="button"
            accessibilityState={{ selected: adminMainView === 'feedback' }}
          >
            <Text style={[styles.filterChipText, adminMainView === 'feedback' && styles.filterChipTextActive]}>
              Feedback
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      {adminMainView === 'feedback' ? (
        <AdminFeedbackPanel />
      ) : (
        <>
          <View style={styles.cohortToolbar}>
            <View style={styles.cohortStatsRowInline}>
              <View style={styles.cohortStatPill}>
                <Text style={styles.cohortStatValSmall}>{cohortStats.started}</Text>
                <Text style={styles.cohortStatLblSmall}>Started</Text>
              </View>
              <View style={styles.cohortStatPill}>
                <Text style={styles.cohortStatValSmall}>{cohortStats.passed}</Text>
                <Text style={styles.cohortStatLblSmall}>Passed</Text>
              </View>
              <View style={styles.cohortStatPill}>
                <Text style={styles.cohortStatValSmall}>{cohortStats.failed}</Text>
                <Text style={styles.cohortStatLblSmall}>Failed</Text>
              </View>
            </View>
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Time</Text>
              {TIME_RANGE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChipCompact, timeRangeFilter === opt.id && styles.filterChipActive]}
                  onPress={() => {
                    if (opt.id === 'custom') {
                      setTimeRangeFilter('custom');
                      setCustomTimeFrom((f) => {
                        if (f) return f;
                        const t = new Date();
                        const from = new Date(t);
                        from.setDate(from.getDate() - 7);
                        return formatYmdLocal(from);
                      });
                      setCustomTimeTo((t) => (t ? t : formatYmdLocal(new Date())));
                    } else {
                      setTimeRangeFilter(opt.id);
                    }
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: timeRangeFilter === opt.id }}
                >
                  <Text
                    style={[
                      styles.filterChipTextCompact,
                      timeRangeFilter === opt.id && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {timeRangeFilter === 'custom' ? (
              <View style={styles.filterCustomRangeRow}>
                <Text style={styles.filterClusterLabel}>From</Text>
                <TextInput
                  value={customTimeFrom}
                  onChangeText={setCustomTimeFrom}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(122, 154, 190, 0.45)"
                  style={styles.customDateInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessible
                  accessibilityLabel="Custom range start date"
                />
                <Text style={styles.filterClusterLabel}>To</Text>
                <TextInput
                  value={customTimeTo}
                  onChangeText={setCustomTimeTo}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="rgba(122, 154, 190, 0.45)"
                  style={styles.customDateInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessible
                  accessibilityLabel="Custom range end date"
                />
                <Text style={styles.filterCustomHint}>Local dates · activity time</Text>
              </View>
            ) : null}
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Reviewed</Text>
              {REVIEWED_COHORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChipCompact, reviewedCohortFilter === opt.id && styles.filterChipActive]}
                  onPress={() => setReviewedCohortFilter(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: reviewedCohortFilter === opt.id }}
                >
                  <Text
                    style={[
                      styles.filterChipTextCompact,
                      reviewedCohortFilter === opt.id && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Complete</Text>
              <TouchableOpacity
                style={[styles.filterChipCompact, !hideIncomplete && styles.filterChipActive]}
                onPress={() => setHideIncomplete(false)}
                accessibilityRole="button"
                accessibilityState={{ selected: !hideIncomplete }}
              >
                <Text style={[styles.filterChipTextCompact, !hideIncomplete && styles.filterChipTextActive]}>
                  Any
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterChipCompact, hideIncomplete && styles.filterChipActive]}
                onPress={() => setHideIncomplete(true)}
                accessibilityRole="button"
                accessibilityState={{ selected: hideIncomplete }}
              >
                <Text style={[styles.filterChipTextCompact, hideIncomplete && styles.filterChipTextActive]}>
                  Only done
                </Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.filterCluster, styles.filterClusterGrow]}>
              <Text style={styles.filterClusterLabel}>Status</Text>
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChipCompact, statusFilter === opt.id && styles.filterChipActive]}
                  onPress={() => setStatusFilter(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: statusFilter === opt.id }}
                >
                  <Text
                    style={[styles.filterChipTextCompact, statusFilter === opt.id && styles.filterChipTextActive]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.cardsContainer}>
            {loading ? (
              <Text style={styles.emptyText}>Loading users...</Text>
            ) : listError ? (
              <View style={styles.listErrorBlock}>
                <Text style={styles.listErrorTitle}>Could not load data</Text>
                <Text style={styles.listErrorDetail} selectable>
                  {listError}
                </Text>
                <Text style={styles.listErrorHint}>
                  If the list is empty but users exist in the database, apply the Supabase migration that grants
                  admin@amoraea.com SELECT on public.users (see migrations/20260423120000_admin_select_all_users.sql),
                  then refresh.
                </Text>
              </View>
            ) : users.length === 0 ? (
              <Text style={styles.emptyText}>No users found.</Text>
            ) : pipelineFiltered.length === 0 ? (
              <Text style={styles.emptyText}>No users match these filters.</Text>
            ) : (
              pipelineFiltered.map((userData) => (
                <UserCard
                  key={userData.user.id}
                  userData={userData}
                  onPress={() => {
                    setSelectedUserId(userData.user.id);
                    setDetailAttempts(null);
                    setDetailAttemptsError(null);
                    setDetailAttemptsLoading(true);
                  }}
                  canDelete={canDeleteUser(userData.user)}
                  deleting={deletingUserId === userData.user.id}
                  onDelete={() => void handleDeleteUser(userData.user)}
                  reviewed={userData.user.interview_cohort_admin_reviewed === true}
                  onToggleReviewed={(next) => void setUserCohortReviewed(userData.user.id, next)}
                  onRefreshList={refreshUsers}
                />
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#05060D',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 4,
  },
  headerTitle: {
    color: '#C8E4FF',
    fontSize: 22,
    fontWeight: '300',
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
  },
  headerSub: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  launchNotificationPhoneBold: {
    fontWeight: '700',
  },
  headerPassMeta: {
    color: '#9BB0CC',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
  overrideButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  overrideChip: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(30,111,217,0.12)',
  },
  overrideChipText: {
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '600',
  },
  cohortToolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 10,
    rowGap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.1)',
  },
  cohortStatsRowInline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  cohortStatPill: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 72,
  },
  cohortStatValSmall: {
    color: '#C8E4FF',
    fontSize: 16,
    fontWeight: '600',
  },
  cohortStatLblSmall: {
    color: '#7A9ABE',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 1,
  },
  filterCluster: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  filterClusterGrow: {
    flexBasis: 220,
    flexGrow: 1,
  },
  filterClusterLabel: {
    color: '#5C7A9E',
    fontSize: 9,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  filterChipCompact: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  filterChipTextCompact: {
    color: '#7A9ABE',
    fontSize: 11,
    fontWeight: '500',
  },
  filterCustomRangeRow: {
    width: '100%' as const,
    flexBasis: '100%' as const,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 6,
    rowGap: 4,
    marginTop: 1,
  },
  customDateInput: {
    minWidth: 108,
    maxWidth: 120,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.3)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    color: '#E8F0F8',
    fontSize: 11,
    backgroundColor: 'rgba(5,6,13,0.4)',
  },
  filterCustomHint: {
    color: '#5C7A9E',
    fontSize: 9,
    flexBasis: '100%' as const,
  },
  backText: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  cardsContainer: {
    padding: 20,
    gap: 12,
  },
  filterChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    alignItems: 'center',
    paddingBottom: 2,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  filterChipActive: {
    backgroundColor: 'rgba(30,111,217,0.2)',
    borderColor: 'rgba(82,142,220,0.45)',
  },
  filterChipText: {
    color: '#7A9ABE',
    fontSize: 12,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#C8E4FF',
  },
  userCardRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  userCardFlex: {
    flex: 1,
    minWidth: 0,
  },
  userCardDelete: {
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(82,142,220,0.12)',
  },
  userCardDeleteText: {
    color: '#E87A7A',
    fontSize: 12,
    fontWeight: '600',
  },
  userCardDeleteTextDisabled: {
    opacity: 0.5,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    marginBottom: 4,
  },
  headerExportRow: {
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  exportCsvButton: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(30,111,217,0.15)',
  },
  exportCsvButtonDisabled: {
    opacity: 0.45,
  },
  exportCsvButtonText: {
    color: '#C8E4FF',
    fontSize: 13,
    fontWeight: '600',
  },
  headerDeleteText: {
    color: '#E87A7A',
    fontSize: 12,
    fontWeight: '600',
  },
  userCard: {
    backgroundColor: 'rgba(13,17,32,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 10,
    padding: 14,
  },
  userCardPressed: {
    backgroundColor: 'rgba(30,111,217,0.08)',
  },
  userCardName: {
    color: '#E8F0F8',
    fontSize: 18,
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
  },
  userCardIntroName: {
    color: '#E8F0F8',
    fontSize: 18,
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
  },
  userCardEmail: {
    color: '#7A9ABE',
    fontSize: 12,
    marginTop: 2,
  },
  userCardDateLine: {
    color: '#9BB0CC',
    fontSize: 11,
    marginTop: 4,
  },
  userCardOverrideHint: {
    color: '#D4A84B',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  userCardSideCol: {
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(82,142,220,0.12)',
    minWidth: 100,
  },
  reviewedToggleRow: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  reviewedLabel: {
    color: '#7A9ABE',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  userCardMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
    minWidth: 0,
  },
  userCardInProgress: {
    color: '#D4A84B',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userCardStatus: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  userCardGateDetail: {
    marginTop: 4,
    color: '#9BB0CC',
    fontSize: 11,
    lineHeight: 15,
  },
  userCardTests: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  detailsLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  detailsLayoutSingle: {
    flex: 1,
    flexDirection: 'row',
  },
  detailsPaneFull: {
    flex: 1,
    minWidth: 0,
  },
  attemptTabsColumn: {
    flex: 1,
    minWidth: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(82,142,220,0.12)',
    backgroundColor: 'rgba(13,17,32,0.6)',
    alignSelf: 'stretch',
  },
  attemptTab: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  attemptTabActive: {
    backgroundColor: 'rgba(30,111,217,0.14)',
  },
  attemptTabLabel: {
    color: '#C8E4FF',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  attemptTabOutcome: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'lowercase',
    marginTop: 4,
    letterSpacing: 0.2,
  },
  attemptTabElapsed: {
    color: '#7A9ABE',
    fontSize: 10,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  detailsPane: {
    flex: 3,
    minWidth: 0,
  },
  innerTabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  innerTab: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.18)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: 'center',
  },
  innerTabActive: {
    backgroundColor: 'rgba(30,111,217,0.16)',
    borderColor: 'rgba(82,142,220,0.4)',
  },
  innerTabText: {
    color: '#7A9ABE',
    fontSize: 11,
  },
  innerTabTextActive: {
    color: '#C8E4FF',
  },
  innerTabContent: {
    flex: 1,
    padding: 14,
  },
  sectionTitle: {
    color: '#C8E4FF',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  metaLabel: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  metaValue: {
    color: '#E8F0F8',
    fontSize: 12,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  scoreLabel: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  scoreValue: {
    color: '#C8E4FF',
    fontSize: 12,
  },
  block: {
    marginTop: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 8,
    backgroundColor: 'rgba(13,17,32,0.5)',
  },
  blockTitle: {
    color: '#C8E4FF',
    fontSize: 13,
    marginBottom: 6,
  },
  blockText: {
    color: '#7A9ABE',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  transcriptLine: {
    color: '#E8F0F8',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 6,
  },
  inProgressSection: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(212,168,75,0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(212,168,75,0.06)',
    maxHeight: Platform.OS === 'web' ? 360 : 400,
  },
  inProgressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  inProgressTitle: {
    color: '#E8D49A',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  refreshLink: {
    color: '#7A9ABE',
    fontSize: 12,
    textDecorationLine: 'underline',
  },
  inProgressMeta: {
    color: '#7A9ABE',
    fontSize: 11,
    marginBottom: 8,
  },
  inProgressScroll: {
    maxHeight: 260,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyText: {
    color: '#7A9ABE',
    fontSize: 13,
  },
  emptyHint: {
    color: '#9BB8D9',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 14,
    maxWidth: 520,
  },
  emptyHintMono: {
    fontFamily: Platform.OS === 'web' ? 'ui-monospace, monospace' : 'monospace',
    fontSize: 11,
    color: '#C8E4FF',
  },
  listErrorBlock: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
    backgroundColor: 'rgba(248,113,113,0.08)',
    gap: 10,
  },
  listErrorTitle: {
    color: '#fecaca',
    fontSize: 15,
    fontWeight: '600',
  },
  listErrorDetail: {
    color: 'rgba(254,226,226,0.92)',
    fontSize: 12,
    lineHeight: 18,
  },
  listErrorHint: {
    color: '#7A9ABE',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  styleTranslationNote: {
    marginBottom: 8,
    fontStyle: 'italic',
    opacity: 0.95,
  },
  styleBarRow: {
    marginTop: 8,
  },
  styleBarValueCol: {
    marginTop: 4,
    alignItems: 'flex-start',
  },
  styleExperienceLabel: {
    fontSize: 11,
    color: '#9BB8D9',
    marginTop: 2,
    flexShrink: 1,
  },
  styleBarTrack: {
    marginTop: 4,
    width: '100%',
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(82,142,220,0.15)',
    overflow: 'hidden',
  },
  styleBarFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#5BA8E8',
  },
  reprocessButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.5)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(30,111,217,0.14)',
    alignItems: 'center',
  },
  reprocessButtonPressed: {
    backgroundColor: 'rgba(30,111,217,0.24)',
  },
  reprocessButtonText: {
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '600',
  },
  commFloorReviewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  commFloorDismissButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 75, 0.55)',
    backgroundColor: 'rgba(212, 168, 75, 0.12)',
  },
  commFloorDismissButtonText: {
    color: '#F2E6BF',
    fontSize: 12,
    fontWeight: '600',
  },
  commFloorModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  commFloorModalCard: {
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'rgba(18,22,38,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
  },
  commFloorModalTitle: {
    color: '#C8E4FF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  commFloorModalInput: {
    marginTop: 10,
    minHeight: 88,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 8,
    padding: 10,
    color: '#E8F0F8',
    fontSize: 13,
    textAlignVertical: 'top',
  },
  commFloorModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  commFloorModalCancel: {
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  commFloorModalCancelText: {
    color: '#7A9ABE',
    fontSize: 13,
    fontWeight: '600',
  },
  commFloorModalConfirm: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(212, 168, 75, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(212, 168, 75, 0.45)',
  },
  commFloorModalConfirmText: {
    color: '#F2E6BF',
    fontSize: 13,
    fontWeight: '700',
  },
});
