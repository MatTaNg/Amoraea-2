/**
 * Alpha-only: Admin panel — cohort overview and individual user drill-down.
 * Visible only to admin@amoraea.com. Remove before production.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  fetchCompatibilityTestSeedUserIds,
  isCompatibilityTestSeedUser,
} from '@features/compatibility/compatibilityTestSeedUser';
import * as Clipboard from 'expo-clipboard';
import {
  INTERVIEW_ATTEMPTS_SUMMARY_SELECT,
  INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE,
} from '@data/supabase/interviewAttemptSelects';
import { COMMUNICATION_STYLE_PROFILE_SELECT } from '@data/supabase/tableSelects';
import {
  adminInterviewAttemptsFullSelect,
  getInterviewAttemptDefenseCrossReferenceColumnAbsent,
  getInterviewAttemptGamingCorrectionColumnsAbsent,
  getInterviewAttemptOverrideColumnsAbsent,
  isInterviewAttemptsMissingOverrideColumnsError,
  markInterviewAttemptDefenseCrossReferenceColumnPresent,
  markInterviewAttemptGamingCorrectionColumnsPresent,
  markInterviewAttemptOverrideColumnsPresent,
  rememberInterviewAttemptOverrideColumnsAbsent,
  rememberInterviewAttemptSelectColumnAbsences,
  updateInterviewAttemptRevealOverride,
} from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { formatEdgeFunctionInvokeFailure } from '@utilities/runCommunicationStylePipeline';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  type DefensePatternsJson,
  type DefensePatternTranscriptMsg,
  type MarkerScoreSlice,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import { formatTranscriptTurnContentForDisplay } from '@features/aria/interviewTranscriptTurns';
import { enrichScenarioSliceWithContemptHeuristic } from '@features/aria/contemptExpressionScenarioHeuristic';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import {
  extractPersonalMomentEmotionalVocabFromSlice,
  scenarioEmotionalVocabDensityPercentFromTranscript,
} from '@features/aria/personalMomentEmotionalVocab';
import {
  describeCertaintyAmbiguityAxis,
  describeEmotionalAnalyticalAxis,
  describeExpressivenessAxis,
  describeNarrativeConceptualAxis,
  describeRelationalIndividualAxis,
  describeWarmthAxis,
  styleProfileFromDbRow,
  translateStyleProfile,
  type TranslateStyleProfileOptions,
} from '@utilities/styleTranslations';
import { userTurnContentsFromInterviewTranscript } from '../../../supabase/functions/_shared/interviewStyleMarkers';
import {
  parseInterviewTranscriptMessages,
  splitUserCorpusScenarioVsPersonal,
  userTurnStringsScenarioMainAnalysis,
  userTurnStringsScenarioSegment,
} from '../../../supabase/functions/_shared/splitInterviewUserCorpus';
import { ADMIN_CONSOLE_EMAIL, isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import {
  adminRetryNarrativeWithClientFallback,
  fetchAttemptNarrativeState,
} from '@utilities/adminRetryNarrativeWithClientFallback';
import {
  interviewAiReasoningIsSubstantive,
  recoverFailedReasoningWithContent,
} from '@utilities/kickClientInterviewNarrativeIfPending';
import { confirmAsync } from '@utilities/alerts/confirmDialog';
import { COMMUNICATION_FLOOR_MIN_AVG_WORDS } from '@features/aria/communicationFloorFromTranscript';
import {
  computeGateResultCore,
  GATE_PASS_WEIGHTED_MIN,
  REFERRAL_WEIGHTED_PASS_MIN,
  type ComputeGateResultOptions,
  type GateFailCode,
  type GateFailDetailJson,
} from '@features/aria/computeGateResultCore';
import {
  EMOTION_INTERVIEW_MODAL_ITEMS,
  EMOTION_ITEM_CORRECT_ANSWERS,
  EXPECTED_EMOTION_RECOGNITION_ITEMS,
  countAnsweredEmotionItems,
  emotionRecognitionCorrectCount,
  hydrateEmotionResponsesFromStorage,
  isEmotionRecognitionBatteryComplete,
  storedEmotionCorrectCountFromRaw,
  isLegacyEmotionRecognitionFloorOnlyFail,
  LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE,
  emotionRecognitionDisplayPercentFromAttemptsRow,
  resolveEmotionRecognitionRawScoreForGate,
} from '@features/aria/emotionRecognitionInterview';
import { DEFAULT_DEFENSE_PATTERNS } from '@features/aria/defensePatternsDetection';
import { MENTALIZING_REPAIR_SCENARIO_PASS_MIN } from '@features/aria/mentalizingRepairScenarioFloor';
import { SCENARIO_COMPOSITE_PASS_MIN } from '@features/aria/scenarioCompositeFloor';
import {
  classifyAdminGateOutcome,
  formatGateFailureLines,
  summarizeGateForAdmin,
  type AdminGateOutcomeLabel,
} from '@features/aria/adminGateDisplay';
import { AdminFeedbackPanel } from '@/components/admin/AdminFeedbackPanel';
import { OverviewTab } from '@features/admin/OverviewTab';
import { CompatibilityTab } from '@features/admin/CompatibilityTab';
import { UncertaintyScoreCard, uncertaintyBadgeColor, uncertaintyBadgeLabel } from '@features/admin/UncertaintyScoreCard';
import { GamingCorrectionBanner, GamingCorrectionCard } from '@features/admin/GamingCorrectionCard';
import { ScoreReceiptCard } from '@features/admin/ScoreReceiptCard';
import { UNCERTAINTY_ROUTING_THRESHOLD } from '@features/psychometrics/computeUncertaintyScore';
import type { DefenseCrossReferenceResult } from '@features/psychometrics/crossReferenceDefenseDetection';
import { backfillMissingUncertaintyScores } from '@features/psychometrics/backfillMissingUncertaintyScores';
import { applyPsychometricModifierToAttempt } from '@features/psychometrics/applyPsychometricModifier';
import { PSYCHOMETRICS_ENABLED } from '@features/psychometrics/interviewCompletionStatus';
import { normalizeGateFailDetailForPersist } from '@features/psychometrics/gateFailDetailForPersist';
import { preparePsychometricFloorGateState } from '@features/psychometrics/preparePsychometricFloorGateState';
import { allowInterviewRetakeByAdmin } from '@features/interview/interviewRetake';
import {
  formatPsychometricGateFailDescription,
  extractPsychometricFloorsFromGateDetail,
  getRetroactivePsychometricFloorReviews,
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  psychometricFloorScoreForUser,
  userNeedsPsychometricFloorReview,
} from '@features/psychometrics/psychometricFloorBreaches';
import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import {
  computePillarScoreDelta,
  recalculateAttemptScoresFromStoredSlices,
  snapshotAttemptScoresForAudit,
} from '@features/aria/adminRecalculateAttemptScores';
import { remoteLog } from '@utilities/remoteLog';
import {
  fetchAdminUserProfile,
  FullAssessmentTab,
  isRecoverableUsersSelectError,
  ProfileIntentTab,
  type AdminUserProfileRecord,
} from '@app/screens/admin/AdminProfileAssessmentTabs';

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
  /** Admin-only human judgment; null = follow current gate outcome in UI. Does not change routing. */
  admin_human_verified_pass?: boolean | null;
  interview_completed_at?: string | null;
  interview_retake_admin_allowed_at?: string | null;
  interview_attempt_count?: number | null;
  /** Optional SMS number from post-interview flow (`users.launch_notification_phone`). */
  launch_notification_phone?: string | null;
  psychometrics_sd3_narcissism_score?: number | null;
  psychometric_straight_line_flags?: unknown;
  psychometrics_rfq_score?: number | null;
  psychometrics_gasp_score?: number | null;
  psychometrics_dweck_score?: number | null;
  psychometrics_scs_sf_score?: number | null;
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
  ego_development_level?: number | null;
  review_flags?: unknown;
  score_modifier?: number | null;
  depth_signal_modifier?: number | null;
  modified_weighted_score?: number | null;
  psychometric_modifier_applied?: number | null;
  corrected_psychometric_modifier?: number | null;
  gaming_correction?: import('@features/psychometrics/computeGamingCorrection').GamingCorrectionResult | null;
  modified_weighted_score_with_psychometrics?: number | null;
  final_gate_pass?: boolean | null;
  mentalizing_overcertainty_count?: number | null;
  defense_patterns?: DefensePatternsJson | null;
  moment_4_concreteness?: string | null;
  moment_5_concreteness?: string | null;
  personal_moment_emotional_vocab_low?: boolean | null;
  personal_moment_emotional_vocab_density?: number | null;
  disclosure_calibration?: string | null;
  emotion_recognition_raw_score?: number | null;
  emotion_recognition_score?: number | null;
  emotion_recognition_responses?: string[] | null;
  /** Not yet persisted on all rows — optional for forward compatibility. */
  closing_integration?: string | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  uncertainty_score?: number | null;
  uncertainty_breakdown?: import('@features/psychometrics/computeUncertaintyScore').UncertaintyBreakdown | null;
  defense_cross_reference?: DefenseCrossReferenceResult | null;
  requires_clarification_battery?: boolean | null;
  post_clarification_uncertainty_score?: number | null;
  uncertainty_pending_admin_review?: boolean | null;
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
  | 'scenario_composites'
  | 'scenario_floor_grandfather_review'
  | 'gate_fail_reasons'
  | 'gate_fail_detail'
  | 'mentalizing_repair_floor_grandfather_review'
  | 'review_flags'
  | 'score_modifier'
  | 'depth_signal_modifier'
  | 'modified_weighted_score'
  | 'psychometric_modifier_applied'
  | 'modified_weighted_score_with_psychometrics'
  | 'final_gate_pass'
  | 'ego_development_level'
  | 'defense_patterns'
  | 'moment_4_concreteness'
  | 'moment_5_concreteness'
  | 'personal_moment_emotional_vocab_low'
  | 'disclosure_calibration'
  | 'mentalizing_overcertainty_count'
  | 'emotion_recognition_raw_score'
  | 'emotion_recognition_score'
  | 'emotion_recognition_responses'
  | 'uncertainty_score'
  | 'requires_clarification_battery'
  | 'post_clarification_uncertainty_score'
  | 'uncertainty_pending_admin_review'
>;

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

const COMMUNICATION_STYLE_INITIAL_POLL_ATTEMPTS = 8;
const COMMUNICATION_STYLE_INITIAL_POLL_DELAY_MS = 1200;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasNonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim().length > 0);
}

function communicationStyleRowHasDisplayData(
  row: CommunicationStyleProfileRow | null,
  expectedAttemptId?: string | null
): boolean {
  if (!row) return false;
  if (expectedAttemptId && row.source_attempt_id && row.source_attempt_id !== expectedAttemptId) {
    return false;
  }
  return (
    hasNonEmptyStringArray(row.style_labels_primary) ||
    hasNonEmptyStringArray(row.style_labels_secondary) ||
    (typeof row.matchmaker_summary === 'string' && row.matchmaker_summary.trim().length > 0)
  );
}

/** Used by SummaryTab + reprocess; keep one query shape so admin UI stays in sync with DB. */
async function fetchCommunicationStyleProfileRowForAdmin(
  userId: string
): Promise<CommunicationStyleProfileRow | null> {
  const { data, error } = await supabase
    .from('communication_style_profiles')
    .select(COMMUNICATION_STYLE_PROFILE_SELECT)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Admin] communication_style_profiles select', error);
    return null;
  }
  return (data as CommunicationStyleProfileRow | null | undefined) ?? null;
}

async function fetchCommunicationStyleProfileRowForAdminWithInitialPoll(
  userId: string,
  expectedAttemptId: string,
  shouldContinue: () => boolean
): Promise<CommunicationStyleProfileRow | null> {
  let latest: CommunicationStyleProfileRow | null = null;
  for (let i = 0; i < COMMUNICATION_STYLE_INITIAL_POLL_ATTEMPTS; i += 1) {
    if (!shouldContinue()) return latest;
    latest = await fetchCommunicationStyleProfileRowForAdmin(userId);
    if (communicationStyleRowHasDisplayData(latest, expectedAttemptId)) {
      return latest;
    }
    if (i < COMMUNICATION_STYLE_INITIAL_POLL_ATTEMPTS - 1) {
      await delay(COMMUNICATION_STYLE_INITIAL_POLL_DELAY_MS);
    }
  }
  return latest;
}

function buildCommunicationStyleTranscriptOptionsForAdmin(
  transcript: AttemptRow['transcript']
): TranslateStyleProfileOptions | undefined {
  const userTurns = userTurnContentsFromInterviewTranscript(transcript);
  const userCorpus = userTurns.join(' ').toLowerCase();
  if (!userCorpus.trim()) return undefined;
  const parsedTx = parseInterviewTranscriptMessages(transcript);
  const { scenarioCorpus, personalCorpus } = splitUserCorpusScenarioVsPersonal(parsedTx);
  const scenarioUserTurns = userTurnStringsScenarioSegment(parsedTx);
  const scenarioMainAnalysisUserTurns = userTurnStringsScenarioMainAnalysis(parsedTx);
  return {
    userCorpus,
    userTurns,
    scenarioUserCorpus: scenarioCorpus.length > 0 ? scenarioCorpus : undefined,
    scenarioUserTurns: scenarioUserTurns.length > 0 ? scenarioUserTurns : undefined,
    scenarioMainAnalysisUserTurns:
      scenarioMainAnalysisUserTurns.length > 0 ? scenarioMainAnalysisUserTurns : undefined,
    personalUserCorpus: personalCorpus.length > 0 ? personalCorpus : undefined,
  };
}

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
  return interviewAiReasoningIsSubstantive(ar);
}

/**
 * True when the attempt is still missing long-form AI narrative, not only when `reasoning_pending` / _reasoningPending
 * flags are set (they can be stale after a successful retry or backfill).
 * `_narrativeFailed` / `_completionHeld` mean narrative is absent but not "in flight" — Tab 2 retry still applies.
 */
function adminAiNarrativeStillPending(attempt: AttemptRow): boolean {
  const ar = parseObject(attempt.ai_reasoning);
  if (adminAttemptHasSubstantiveAiReasoning(ar)) return false;
  const narrativeFailed = !!(ar as { _narrativeFailed?: boolean } | null)?._narrativeFailed;
  const completionHeld = !!(ar as { _completionHeld?: boolean } | null)?._completionHeld;
  const flagPending =
    attempt.reasoning_pending === true || !!(ar as { _reasoningPending?: boolean } | null)?._reasoningPending;
  return flagPending || narrativeFailed || completionHeld;
}

/** Debounce auto-retry kicks per attempt within one SPA session (full page refresh clears). */
const adminNarrativeAutoRetryInFlight = new Set<string>();
/** One automatic narrative retry per attempt per page load (manual Tab 2 retry still allowed). */
const adminNarrativeAutoRetryFinishedAttempts = new Set<string>();

const adminStyleAutoReprocessLastKickMs = new Map<string, number>();
const adminStyleAutoReprocessInFlight = new Set<string>();
const ADMIN_STYLE_AUTO_REPROCESS_COOLDOWN_MS = 120_000;

function adminAttemptEligibleForNarrativeAutoRetry(attempt: AttemptRow): boolean {
  if (!adminAiNarrativeStillPending(attempt)) return false;
  const pillars = normalizePillarScoresMap(attempt.pillar_scores);
  if (!pillars || Object.keys(pillars).length === 0) return false;
  if (attempt.weighted_score == null || !Number.isFinite(attempt.weighted_score)) return false;
  const transcript = attempt.transcript;
  return Array.isArray(transcript) && transcript.length > 0;
}

async function reconcileStaleReasoningPendingOnAdminView(attempt: AttemptRow): Promise<boolean> {
  const ar = parseObject(attempt.ai_reasoning);
  if (!adminAttemptHasSubstantiveAiReasoning(ar)) return false;
  const failedButHasContent =
    ar?._generationFailed === true || ar?._narrativeFailed === true;
  if (failedButHasContent) {
    const recovered = await recoverFailedReasoningWithContent(attempt.id);
    if (recovered) return true;
  }
  if (attempt.reasoning_pending !== true && !ar?._reasoningPending) return false;
  const { error } = await supabase
    .from('interview_attempts')
    .update({
      reasoning_pending: false,
      ai_reasoning: {
        ...(ar ?? {}),
        _reasoningPending: false,
      },
    })
    .eq('id', attempt.id);
  if (error) {
    console.warn('[Admin] reconcile reasoning_pending failed', error.message);
    return false;
  }
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
  const obj = parseObject(raw);
  const slice = extractAggregateSlice(raw);
  if (!slice?.pillarScores) return slice;
  const sanitized = sanitizePersonalMomentScoresForAggregate({
    pillarScores: slice.pillarScores as Record<string, number | null>,
    keyEvidence: slice.keyEvidence,
  });
  if (!sanitized?.pillarScores) return slice;
  const ev = extractPersonalMomentEmotionalVocabFromSlice(obj ?? sanitized);
  return {
    pillarScores: sanitized.pillarScores,
    keyEvidence: sanitized.keyEvidence,
    mentalizing_overcertainty: obj?.mentalizing_overcertainty === true,
    response_concreteness: typeof obj?.response_concreteness === 'string' ? obj.response_concreteness : undefined,
    emotional_vocab_count: ev.emotional_vocab_count,
    emotional_vocab_words: ev.emotional_vocab_words.length > 0 ? ev.emotional_vocab_words : undefined,
    user_slice_word_count: ev.user_slice_word_count,
  };
}

function extractSanitizedMoment5Slice(raw: unknown): MarkerScoreSlice {
  const obj = parseObject(raw);
  const slice = extractAggregateSlice(raw);
  if (!slice?.pillarScores) return slice;
  const sanitized = sanitizeMoment5PersonalScoresForAggregate({
    pillarScores: slice.pillarScores as Record<string, number | null>,
    keyEvidence: slice.keyEvidence,
  });
  if (!sanitized?.pillarScores) return slice;
  const ev = extractPersonalMomentEmotionalVocabFromSlice(obj ?? sanitized);
  return {
    pillarScores: sanitized.pillarScores,
    keyEvidence: sanitized.keyEvidence,
    mentalizing_overcertainty: obj?.mentalizing_overcertainty === true,
    response_concreteness: typeof obj?.response_concreteness === 'string' ? obj.response_concreteness : undefined,
    emotional_vocab_count: ev.emotional_vocab_count,
    emotional_vocab_words: ev.emotional_vocab_words.length > 0 ? ev.emotional_vocab_words : undefined,
    user_slice_word_count: ev.user_slice_word_count,
  };
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
  const agg = aggregatePillarScoresWithCommitmentMergeDetailed(slices, {
    defensePatternTranscript: Array.isArray(tx) ? (tx as DefensePatternTranscriptMsg[]) : null,
    disclosureCalibrationTranscript: Array.isArray(tx)
      ? (tx as Array<{ role?: string; content?: string; interviewMoment?: number }>)
      : null,
    scenarioEmotionalVocabDensityPercent: scenarioEmotionalVocabDensityPercentFromTranscript(
      Array.isArray(tx) ? (tx as Array<{ role?: string; content?: string; scenarioNumber?: number | null }>) : [],
    ),
    communicationStyleEmotionalVocabDensityPercent: (() => {
      const lm = attempt.language_markers as Record<string, unknown> | null | undefined;
      const v = lm?.emotional_vocab_density;
      return typeof v === 'number' && Number.isFinite(v) ? v : null;
    })(),
  });
  return { scores: agg.scores, counts: agg.contributorCounts };
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

/** Sum per-turn latency + recording duration from `interview_attempts.response_timings` (active engagement, not wall clock). */
function sumResponseTimingsActiveMs(
  timings: Array<{ latency_ms?: number; duration_ms?: number }> | null | undefined,
): number | null {
  if (!Array.isArray(timings) || timings.length === 0) return null;
  let sum = 0;
  for (const t of timings) {
    const lat = typeof t.latency_ms === 'number' && Number.isFinite(t.latency_ms) ? Math.max(0, t.latency_ms) : 0;
    const dur = typeof t.duration_ms === 'number' && Number.isFinite(t.duration_ms) ? Math.max(0, t.duration_ms) : 0;
    sum += lat + dur;
  }
  return Number.isFinite(sum) && sum > 0 ? sum : null;
}

function formatDurationMsHuman(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Prefer summed active time from `response_timings` when present; otherwise wall clock from
 * `created_at` to `completed_at` (or now), labeled so admins are not misled by overnight gaps.
 */
function formatAttemptElapsedDisplay(attempt: {
  created_at: string;
  completed_at: string | null;
  response_timings?: Array<{ latency_ms?: number; duration_ms?: number }> | null;
}): string {
  const activeMs = sumResponseTimingsActiveMs(attempt.response_timings ?? null);
  if (activeMs != null) {
    const core = formatDurationMsHuman(activeMs);
    return attempt.completed_at ? `${core} active` : `${core} active · in progress`;
  }
  const end = attempt.completed_at ?? new Date().toISOString();
  const wall = formatAdminAttemptElapsed(attempt.created_at, end);
  return attempt.completed_at ? `${wall} (wall clock)` : `${wall} · in progress (wall clock)`;
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

type TimeRangeFilter = 'all' | 'day' | 'three_days' | 'week' | 'month' | 'custom';
type BookmarkCohortFilter = 'all' | 'bookmarked' | 'not_bookmarked';
type HumanVerifiedCohortFilter = 'all' | 'pass' | 'fail' | 'unset';

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

function hasStartedInterviewCohort(g: UserGroup): boolean {
  if (userHasInProgressInterview(g.user, g.latestAttempt)) return true;
  if (g.latestAttempt != null) return true;
  return !!g.user.latest_attempt_id;
}

type FetchAdminUsersListResult = { groups: UserGroup[]; errorMessage: string | null };

const ADMIN_USERS_LIST_SELECT = `
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
      psychometrics_scs_sf_score
    `;

/** When 20260628140000_users_psychometrics_sd3_narcissism.sql has not been applied yet. */
const ADMIN_USERS_LIST_SELECT_WITHOUT_SD3_RFQ = `
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
      psychometrics_scs_sf_score
    `;

/** Users + lightweight attempt rows for list (counts, pass badge, tab labels). No transcript / scores jsonb. */
async function fetchAdminUsersList(): Promise<FetchAdminUsersListResult> {
  let usersError: { message: string; code?: string } | null = null;
  let allUsers: UserRow[] | null = null;

  for (const select of [ADMIN_USERS_LIST_SELECT_WITHOUT_SD3_RFQ, ADMIN_USERS_LIST_SELECT]) {
    const result = await supabase.from('users').select(select).order('created_at', { ascending: false });
    if (!result.error && result.data) {
      allUsers = result.data as UserRow[];
      usersError = null;
      break;
    }
    usersError = result.error;
    if (result.error && !isRecoverableUsersSelectError(result.error)) {
      break;
    }
  }

  if (usersError || !allUsers) {
    console.error('Admin panel users fetch error:', usersError);
    return { groups: [], errorMessage: usersError?.message ?? 'Failed to load users' };
  }

  const seedUserIds = await fetchCompatibilityTestSeedUserIds(supabase);
  const users = allUsers.filter(
    (user) => !isCompatibilityTestSeedUser({ id: user.id, email: user.email }, seedUserIds),
  );

  const overrideColsAbsent = await getInterviewAttemptOverrideColumnsAbsent();

  const attemptsResp = (await supabase
    .from('interview_attempts')
    .select(
      overrideColsAbsent ? INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE : INTERVIEW_ATTEMPTS_SUMMARY_SELECT,
    )
    .or('is_phantom.eq.false,is_phantom.is.null')
    .order('created_at', { ascending: false })) as {
    data: AttemptSummary[] | null;
    error: { message: string; code?: string } | null;
  };
  let { data: allAttempts, error: attemptsError } = attemptsResp;

  if (overrideColsAbsent && allAttempts) {
    allAttempts = allAttempts.map((row) => ({
      ...row,
      override_status: null as boolean | null,
      override_set_at: null as string | null,
    })) as AttemptSummary[];
  }

  if (!overrideColsAbsent && attemptsError && isInterviewAttemptsMissingOverrideColumnsError(attemptsError)) {
    await rememberInterviewAttemptOverrideColumnsAbsent();
    const legacy = (await supabase
      .from('interview_attempts')
      .select(INTERVIEW_ATTEMPTS_SUMMARY_SELECT_BASE)
      .or('is_phantom.eq.false,is_phantom.is.null')
      .order('created_at', { ascending: false })) as {
      data: AttemptSummary[] | null;
      error: { message: string; code?: string } | null;
    };
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

/** All interview runs for a user (newest first) — retakes keep prior attempt rows. */
async function fetchAllFullAttemptsForUser(
  userId: string,
): Promise<{ attempts: AttemptRow[]; errorMessage: string | null }> {
  const patchOptionalNulls = (row: Record<string, unknown>): AttemptRow =>
    ({
      ...row,
      override_status: row.override_status ?? null,
      override_set_at: row.override_set_at ?? null,
      corrected_psychometric_modifier: row.corrected_psychometric_modifier ?? null,
      gaming_correction: row.gaming_correction ?? null,
    }) as AttemptRow;

  for (let attempt = 0; attempt < 4; attempt++) {
    const select = await adminInterviewAttemptsFullSelect();
    const { data, error } = await supabase
      .from('interview_attempts')
      .select(select)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    if (!error) {
      if (!(await getInterviewAttemptGamingCorrectionColumnsAbsent())) {
        void markInterviewAttemptGamingCorrectionColumnsPresent();
      }
      if (!(await getInterviewAttemptDefenseCrossReferenceColumnAbsent())) {
        void markInterviewAttemptDefenseCrossReferenceColumnPresent();
      }
      if (!(await getInterviewAttemptOverrideColumnsAbsent())) {
        void markInterviewAttemptOverrideColumnsPresent();
      }
      const rows = (data as AttemptRow[] | null)?.map((row) =>
        patchOptionalNulls(row as Record<string, unknown>),
      ) ?? [];
      return { attempts: rows, errorMessage: null };
    }
    if (!(await rememberInterviewAttemptSelectColumnAbsences(error))) {
      console.error('Admin panel fetchAllFullAttemptsForUser:', error);
      return { attempts: [], errorMessage: error.message };
    }
  }

  return { attempts: [], errorMessage: 'Failed to load attempts after column fallback retries' };
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

const PASS_FLAGGED_COLOR = '#C9A227';

function reviewFlagsFromStoredAttempt(attempt: AttemptSummary | AttemptRow | null): string[] {
  if (!attempt) return [];
  const raw = attempt.review_flags;
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string' && x.length > 0);
}

function passWithReviewFlagsDetail(flags: string[]): string {
  return `Review flags: ${flags.join(', ')}`;
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
  'ego_development_floor',
  'scenario_floor',
  'mentalizing_floor',
  'repair_floor',
];

function normalizeGateFailCodesFromAttempt(attempt: AttemptSummary | AttemptRow): GateFailCode[] {
  const raw = attempt.gate_fail_reasons;
  if (Array.isArray(raw)) {
    return STORED_GATE_FAIL_ORDER.filter((c) => raw.includes(c));
  }
  return [];
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
  if (parts.length > 0) return `Legacy pass — mentalizing/repair review: ${parts.join(' Â· ')}`;
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
    return parts.length > 0 ? parts.join(' Â· ') : null;
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
    const detailStr = storedLines.length > 0 ? storedLines.join(' Â· ') : null;
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
      detailLines.length > 0 ? detailLines.join(' Â· ') : summarizeGateForAdmin(scores, gate);
    return {
      word: 'almost',
      color: getAlmostPassColor(),
      detail: mergeDetail(detail ?? null),
      outcomeLabel: 'almost',
    };
  }
  if (label === 'fail') {
    const detail = detailLines.length > 0 ? detailLines.join(' Â· ') : null;
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
  let pending = attempt.reasoning_pending === true;
  if ('ai_reasoning' in attempt) {
    const ar = parseObject((attempt as AttemptRow).ai_reasoning);
    pending =
      pending ||
      !!(ar as { _reasoningPending?: boolean } | null)?._reasoningPending ||
      !!(ar as { _narrativeFailed?: boolean } | null)?._narrativeFailed ||
      !!(ar as { _completionHeld?: boolean } | null)?._completionHeld;
  }
  const suffix = pending ? ' · AI narrative pending' : '';
  const unc =
    'uncertainty_score' in attempt && typeof attempt.uncertainty_score === 'number'
      ? attempt.uncertainty_score
      : null;
  const uncSuffix =
    unc != null
      ? ` · U:${unc.toFixed(2)}`
      : '';
  if (!raw) return `Test ${attempt.attempt_number}${suffix}${uncSuffix}`;
  return (
    new Date(raw).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }) + suffix + uncSuffix
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
  | 'no_result'
  | 'flagged'
  | 'er_floor_review'
  | 'sd3_narcissism_floor_review'
  | 'psychometric_floor_review';

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

/** True when the account has an unfinished interview (active attempt row, not yet completed on `users`). */
function userHasInProgressInterview(
  user: UserRow,
  latestAttempt?: AttemptSummary | null,
): boolean {
  if (user.interview_completed === true) return false;
  if (latestAttempt != null && latestAttempt.completed_at == null) return true;
  return !!user.latest_attempt_id;
}

function asAdminStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string');
}

function userGroupNeedsPsychometricFloorReview(g: UserGroup): boolean {
  return userNeedsPsychometricFloorReview(
    g.latestAttempt,
    {
      rfqScore: typeof g.user.psychometrics_rfq_score === 'number' ? g.user.psychometrics_rfq_score : null,
      gaspScore: typeof g.user.psychometrics_gasp_score === 'number' ? g.user.psychometrics_gasp_score : null,
      dweckScore: typeof g.user.psychometrics_dweck_score === 'number' ? g.user.psychometrics_dweck_score : null,
      scsSfScore: typeof g.user.psychometrics_scs_sf_score === 'number' ? g.user.psychometrics_scs_sf_score : null,
      sd3NarcissismScore: typeof g.user.psychometrics_sd3_narcissism_score === 'number' ? g.user.psychometrics_sd3_narcissism_score : null,
    },
    asAdminStringArray(g.user.psychometric_straight_line_flags),
  );
}

function classifyAdminUserListStatus(g: UserGroup): AdminUserStatusFilter {
  if (userHasInProgressInterview(g.user, g.latestAttempt)) return 'in_progress';
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
    return `Started ${new Date(raw).toLocaleString('en-GB')} Â· not completed`;
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
  if (userHasInProgressInterview(g.user, g.latestAttempt)) return 'In progress';
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

function collectFilteredUserEmails(groups: UserGroup[]): string[] {
  const seen = new Set<string>();
  const emails: string[] = [];
  for (const g of groups) {
    const raw = g.user.email?.trim();
    if (!raw || !raw.includes('@')) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    emails.push(raw);
  }
  return emails;
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

/** Best-effort scenario indicator from live transcript message tags. */
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
  latestAttempt,
  liveTranscript,
  onRefresh,
}: {
  user: UserRow;
  latestAttempt?: AttemptSummary | null;
  liveTranscript?: unknown;
  onRefresh: () => void;
}) {
  if (!userHasInProgressInterview(user, latestAttempt)) return null;
  const lines = parseUserTranscript(liveTranscript);
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
        {inferredScenario != null ? `Latest scenario in snapshot: ${inferredScenario} Â· ` : ''}
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
              {m.scenarioNumber != null ? ` (s${m.scenarioNumber})` : ''}:{' '}
              {formatTranscriptTurnContentForDisplay(m.role, m.content)}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

type UserListSort = 'date' | 'uncertainty';

function sortUserGroups(list: UserGroup[], sort: UserListSort): UserGroup[] {
  if (sort === 'date') return list;
  return [...list].sort((a, b) => {
    const sa = a.latestAttempt?.uncertainty_score;
    const sb = b.latestAttempt?.uncertainty_score;
    const na = sa != null && Number.isFinite(sa) ? sa : -1;
    const nb = sb != null && Number.isFinite(sb) ? sb : -1;
    return nb - na;
  });
}

function userMatchesHumanVerifiedCohortFilter(
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

type UncertaintyBandFilter = 'all' | 'low' | 'medium' | 'high';

function userMatchesUncertaintyFilter(g: UserGroup, filter: UncertaintyBandFilter): boolean {
  if (filter === 'all') return true;
  const score = g.latestAttempt?.uncertainty_score;
  if (score == null || !Number.isFinite(score)) return false;
  if (filter === 'low') return score < 0.4;
  if (filter === 'medium') return score >= 0.4 && score < UNCERTAINTY_ROUTING_THRESHOLD;
  return score >= UNCERTAINTY_ROUTING_THRESHOLD;
}

function normalizePhoneSearchDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function userGroupMatchesSearchQuery(g: UserGroup, rawQuery: string): boolean {
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

function AdminCheckbox({
  label,
  checked,
  onPress,
  accent,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.adminCheckboxRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.adminCheckboxBox,
          checked && { borderColor: accent, backgroundColor: `${accent}33` },
        ]}
      >
        {checked ? <Text style={[styles.adminCheckboxMark, { color: accent }]}>✓</Text> : null}
      </View>
      <Text style={styles.adminCheckboxLabel}>{label}</Text>
    </Pressable>
  );
}

function HumanVerifiedCheckboxes({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
}) {
  const passChecked = value === true;
  const failChecked = value === false;

  return (
    <View style={styles.humanVerifiedCol}>
      <Text style={styles.humanVerifiedLabel}>Human verified</Text>
      <View style={styles.humanVerifiedCheckboxRow}>
        <AdminCheckbox
          label="Pass"
          checked={passChecked}
          accent="#2A8C6A"
          onPress={() => onChange(passChecked ? null : true)}
        />
        <AdminCheckbox
          label="Fail"
          checked={failChecked}
          accent="#E85D5D"
          onPress={() => onChange(failChecked ? null : false)}
        />
      </View>
    </View>
  );
}

function UserCard({
  userData,
  onPress,
  onDelete,
  canDelete,
  deleting,
  bookmarked,
  onToggleBookmarked,
  onSetHumanVerified,
  onRefreshList,
}: {
  userData: UserGroup;
  onPress: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleting: boolean;
  bookmarked: boolean;
  onToggleBookmarked: (next: boolean) => void;
  onSetHumanVerified: (pass: boolean | null) => void;
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
      const attemptResult = await updateInterviewAttemptRevealOverride(latest.id, pass);
      if (!attemptResult.ok && !attemptResult.columnsMissing) {
        throw new Error(attemptResult.errorMessage);
      }
      const { error: userErr } = await supabase
        .from('users')
        .update({ interview_passed: pass, interview_passed_admin_override: pass })
        .eq('id', userData.user.id);
      if (userErr) throw new Error(userErr.message);
      await onRefreshList();
      if (latest?.id) {
        void supabase.functions.invoke('send-results-email', {
          body: { userId: userData.user.id, attemptId: latest.id },
        });
      }
      if (attemptResult.columnsMissing) {
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
        <View style={styles.userCardNameRow}>
          <Text style={styles.userCardIntroName}>{resolveAdminInterviewIntroDisplayName(userData.user)}</Text>
          {(() => {
            const rf = reviewFlagsFromStoredAttempt(latest);
            if (rf.length === 0) return null;
            return (
              <Text style={styles.userCardFlagMark} accessibilityLabel={`${rf.length} review flags`}>
                ⚑{rf.length > 1 ? rf.length : ''}
              </Text>
            );
          })()}
        </View>
        <Text style={styles.userCardEmail}>{userData.user.email ?? '—'}</Text>
        {launchPhone ? (
          <Text style={styles.userCardEmail} selectable>
            Phone: <Text style={styles.launchNotificationPhoneBold}>{launchPhone}</Text>
          </Text>
        ) : null}
        <Text style={styles.userCardDateLine}>{formatUserInterviewDateLine(userData)}</Text>
        {userData.attempts.length > 1 ? (
          <Text style={styles.userCardTests}>{userData.attempts.length} interview runs</Text>
        ) : null}
        {latest && !userHasInProgressInterview(userData.user, userData.latestAttempt) ? (
          <View style={styles.userCardSignalRow}>
            {typeof latest.ego_development_level === 'number' &&
            Number.isFinite(latest.ego_development_level) &&
            latest.ego_development_level >= 1 &&
            latest.ego_development_level <= 5 ? (
              <View
                style={[
                  styles.userCardMicroChip,
                  { borderColor: egoLevelAdminColor(latest.ego_development_level), backgroundColor: 'rgba(0,0,0,0.2)' },
                ]}
              >
                <Text style={[styles.userCardMicroChipText, { color: egoLevelAdminColor(latest.ego_development_level) }]}>
                  ED:{Math.round(latest.ego_development_level)}
                </Text>
              </View>
            ) : null}
            {(() => {
              const unc = latest?.uncertainty_score;
              if (unc == null || !Number.isFinite(unc)) return null;
              const color = uncertaintyBadgeColor(unc);
              return (
                <View
                  style={[
                    styles.userCardMicroChip,
                    { borderColor: color, backgroundColor: `${color}22` },
                  ]}
                >
                  <Text style={[styles.userCardMicroChipText, { color }]}>
                    U:{unc.toFixed(2)}
                  </Text>
                </View>
              );
            })()}
            {(() => {
              const resp = hydrateEmotionResponsesFromStorage(latest.emotion_recognition_responses);
              const answered = countAnsweredEmotionItems(resp);
              if (answered > 0 && answered < EXPECTED_EMOTION_RECOGNITION_ITEMS) {
                return (
                  <View style={styles.userCardMicroChip}>
                    <Text style={styles.userCardMicroChipText}>ER:incomplete</Text>
                  </View>
                );
              }
              let c = emotionRecognitionCorrectCount(resp);
              if (c == null && isEmotionRecognitionBatteryComplete(resp)) {
                c = storedEmotionCorrectCountFromRaw(
                  typeof latest.emotion_recognition_raw_score === 'number' &&
                    Number.isFinite(latest.emotion_recognition_raw_score)
                    ? latest.emotion_recognition_raw_score
                    : null,
                );
              }
              if (c == null) return null;
              return (
                <View style={styles.userCardMicroChip}>
                  <Text style={styles.userCardMicroChipText}>
                    ER:{c}/3
                  </Text>
                </View>
              );
            })()}
            {(() => {
              if (!isLegacyEmotionRecognitionFloorOnlyFail(latest)) return null;
              return (
                <View
                  style={[
                    styles.userCardMicroChip,
                    { borderColor: '#D4A84B', backgroundColor: 'rgba(212,168,75,0.15)' },
                  ]}
                >
                  <Text style={[styles.userCardMicroChipText, { color: '#D4A84B' }]}>ER floor review</Text>
                </View>
              );
            })()}
            {(() => {
              if (!userGroupNeedsPsychometricFloorReview(userData)) return null;
              return (
                <View
                  style={[
                    styles.userCardMicroChip,
                    { borderColor: '#D4A84B', backgroundColor: 'rgba(212,168,75,0.15)' },
                  ]}
                >
                  <Text style={[styles.userCardMicroChipText, { color: '#D4A84B' }]}>
                    Psych floor review
                  </Text>
                </View>
              );
            })()}
            {(() => {
              const sm = latest.score_modifier;
              const mod = latest.modified_weighted_score;
              if (typeof sm === 'number' && sm < 0 && typeof mod === 'number' && Number.isFinite(mod)) {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={styles.userCardScoreStrike}>
                      {formatScoreCell(latest.weighted_score)}
                    </Text>
                    <Text style={styles.userCardScoreModified}>{formatScoreCell(mod)}</Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>
        ) : null}
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
            {userHasInProgressInterview(userData.user, userData.latestAttempt) ? (
              <Text style={styles.userCardInProgress}>In progress</Text>
            ) : null}
          </View>
        </View>
      </Pressable>
      <View style={styles.userCardSideCol}>
        <View style={styles.bookmarkToggleRow}>
          <Text style={styles.bookmarkLabel}>Bookmark</Text>
          <Switch
            value={bookmarked}
            onValueChange={(v) => onToggleBookmarked(v)}
            trackColor={{ false: 'rgba(82,142,220,0.2)', true: 'rgba(42,140,106,0.5)' }}
            thumbColor={bookmarked ? '#2A8C6A' : '#7A9ABE'}
          />
        </View>
        <HumanVerifiedCheckboxes
          value={userData.user.admin_human_verified_pass}
          onChange={(next) => onSetHumanVerified(next)}
        />
        {showRevealButtons ? (
          <View style={styles.userCardOverrideRow}>
            <TouchableOpacity
              style={[styles.userCardOverrideChip, overrideBusy && { opacity: 0.5 }]}
              disabled={overrideBusy}
              onPress={() => void applyRevealOverride(true)}
              accessibilityRole="button"
              accessibilityLabel="Pass applicant now"
            >
              <Text style={styles.overrideChipText}>Pass</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userCardOverrideChip, overrideBusy && { opacity: 0.5 }]}
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

type AdminAttemptInnerTabId =
  | 'profile_intent'
  | 'summary'
  | 'reasoning'
  | 'transcript'
  | 'depth'
  | 'full_assessment';

function adminDetailTabs(): { id: AdminAttemptInnerTabId; label: string }[] {
  return [
    { id: 'summary', label: 'Tab 1: Summary' },
    { id: 'reasoning', label: 'Tab 2: AI Reasoning' },
    { id: 'transcript', label: 'Tab 3: Transcript' },
    { id: 'depth', label: 'Tab 4: Depth Signals' },
    { id: 'profile_intent', label: 'Profile & Intent' },
    { id: 'full_assessment', label: 'Full Assessment' },
  ];
}

const EMPTY_ADMIN_USER_PROFILE = (userId: string): AdminUserProfileRecord => ({
  id: userId,
  market_research_completed_at: null,
  market_research_referral_source: null,
  market_research_referral_other: null,
  market_research_relationship_seriousness: null,
  market_research_search_duration: null,
  market_research_dating_status: null,
  market_research_max_spend: null,
  market_research_spend_context: null,
  psychometrics_completed_at: null,
  psychometrics_brs_score: null,
  psychometrics_scs_sf_score: null,
  psychometrics_scs_sf_self_kindness_score: null,
  psychometrics_scs_sf_common_humanity_score: null,
  psychometrics_scs_sf_mindfulness_score: null,
  psychometrics_gasp_score: null,
  psychometrics_dweck_score: null,
  psychometrics_aaq2_score: null,
  psychometrics_rses_score: null,
  psychometrics_scs_public_score: null,
  psychometrics_scs_private_score: null,
  psychometrics_mspss_score: null,
  psychometrics_mspss_family_score: null,
  psychometrics_mspss_friends_score: null,
  psychometrics_sd3_narcissism_score: null,
  psychometrics_rfq_score: null,
  psychometrics_sexual_communication_score: null,
  psychometrics_sexual_communication_completed_at: null,
  psychometric_modifier: null,
  psychometric_consistency_flags: null,
  psychometric_straight_line_flags: null,
});

function renderAdminDetailTabContent(
  activeInnerTab: AdminAttemptInnerTabId,
  opts: {
    profileUser: AdminUserProfileRecord;
    profileLoading: boolean;
    selectedAttempt: AttemptRow | null;
    onRefreshData: () => void;
    candidateUser: UserRow;
  },
): React.ReactNode {
  const { profileUser, profileLoading, selectedAttempt, onRefreshData, candidateUser } = opts;

  if (activeInnerTab === 'profile_intent') {
    if (profileLoading) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading profile & intent…</Text>
        </View>
      );
    }
    return <ProfileIntentTab user={profileUser} />;
  }

  if (!selectedAttempt) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No completed interview attempt for this tab yet.</Text>
      </View>
    );
  }

  switch (activeInnerTab) {
    case 'summary':
      return (
        <SummaryTab
          attempt={selectedAttempt}
          onAttemptMutated={onRefreshData}
          candidateUser={candidateUser}
          profileUser={profileUser}
        />
      );
    case 'reasoning':
      return <ReasoningTab attempt={selectedAttempt} onRefreshAfterReasoning={onRefreshData} />;
    case 'transcript':
      return <TranscriptTab attempt={selectedAttempt} />;
    case 'depth':
      return <DepthSignalsTab attempt={selectedAttempt} user={profileLoading ? null : profileUser} />;
    case 'full_assessment':
      if (profileLoading) {
        return (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Loading full assessment…</Text>
          </View>
        );
      }
      return <FullAssessmentTab attempt={selectedAttempt} user={profileUser} />;
    default:
      return null;
  }
}

const ADMIN_REVIEW_FLAG_DESCRIPTIONS: Record<string, string> = {
  ego_development_review: 'Ego development level 1 but weighted score passing — review recommended',
  defense_pattern_review: 'Two immature defense patterns detected — review recommended',
  emotion_recognition_review: 'Low emotion recognition score — review recommended',
  personal_moment_concreteness_review: 'Both personal moments abstract with borderline score — review recommended',
  overdisclosure_review: 'Overdisclosure pattern detected',
  closing_integration_absent: 'Closing integration absent with low ego development',
  mentalizing_overcertainty: 'Mentalizing overcertainty detected across multiple scenarios',
  projection_self_report_contradiction:
    'Projection detected in interview but self-report profile contradicts — possible false positive',
  rationalization_self_report_contradiction:
    'Rationalization detected but self-report suggests strong self-awareness — possible false positive',
  splitting_self_report_contradiction:
    'Splitting detected but self-report profile contradicts — possible false positive',
  denial_self_report_contradiction:
    'Denial detected but self-report profile contradicts — possible false positive',
  defense_possible_false_negative:
    'Psychometric profile suggests possible missed defense detection — no behavioral detection occurred',
  projection_insufficient_psychometric_data:
    'Projection detected but psychometric data insufficient for cross-reference validation',
  rationalization_insufficient_psychometric_data:
    'Rationalization detected but psychometric data insufficient for cross-reference validation',
  splitting_insufficient_psychometric_data:
    'Splitting detected but psychometric data insufficient for cross-reference validation',
  denial_insufficient_psychometric_data:
    'Denial detected but psychometric data insufficient for cross-reference validation',
  projection_self_report_confirmed: 'Projection detection confirmed by self-report psychometric profile',
  rationalization_self_report_confirmed:
    'Rationalization detection confirmed by self-report psychometric profile',
  splitting_self_report_confirmed: 'Splitting detection confirmed by self-report psychometric profile',
  denial_self_report_confirmed: 'Denial detection confirmed by self-report psychometric profile',
  projection_self_report_neutral: 'Projection detected — self-report profile neither confirms nor contradicts',
  rationalization_self_report_neutral:
    'Rationalization detected — self-report profile neither confirms nor contradicts',
  splitting_self_report_neutral: 'Splitting detected — self-report profile neither confirms nor contradicts',
  denial_self_report_neutral: 'Denial detected — self-report profile neither confirms nor contradicts',
  legacy_psychometric_pass_flip_review:
    'Psychometric modifier applied after interview completion would change pass to fail — held for admin review',
};

function normalizeEmotionResponseLetters(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'string' ? x.trim().toUpperCase() : String(x ?? '').trim().toUpperCase()))
    .filter((s) => s.length > 0);
}

function egoLevelAdminColor(level: number | null | undefined): string {
  if (level == null || !Number.isFinite(level)) return '#7A9ABE';
  const n = Math.round(Number(level));
  if (n <= 2) return '#E87A7A';
  if (n === 3) return '#D4A84B';
  return '#2A8C6A';
}

function concretenessAdminColor(level: string | null | undefined): string {
  const t = (level ?? '').toLowerCase();
  if (t === 'absent' || t === 'low') return '#E87A7A';
  if (t === 'moderate') return '#D4A84B';
  if (t === 'high') return '#2A8C6A';
  return '#7A9ABE';
}

function disclosureAdminColor(cal: string | null | undefined): string {
  const t = (cal ?? '').toLowerCase();
  if (t === 'calibrated') return '#2A8C6A';
  if (t === 'underdisclosure' || t === 'overdisclosure') return '#D4A84B';
  return '#7A9ABE';
}

function extractAdminScenarioSliceMeta(raw: unknown): { mentalizing_overcertainty?: boolean } | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  const ps = obj.pillarScores ?? obj.pillar_scores;
  const ke = obj.keyEvidence ?? obj.key_evidence;
  if (ps == null && ke == null) return null;
  return { mentalizing_overcertainty: obj.mentalizing_overcertainty === true };
}

function adminMentalizingOvercertaintyLabels(attempt: AttemptRow): string[] {
  const labels: string[] = [];
  const s1 = extractAdminScenarioSliceMeta(attempt.scenario_1_scores);
  const s2 = extractAdminScenarioSliceMeta(attempt.scenario_2_scores);
  const s3 = extractAdminScenarioSliceMeta(attempt.scenario_3_scores);
  if (s1?.mentalizing_overcertainty) labels.push('Scenario 1');
  if (s2?.mentalizing_overcertainty) labels.push('Scenario 2');
  if (s3?.mentalizing_overcertainty) labels.push('Scenario 3');
  const p = parseObject(attempt.scenario_specific_patterns);
  const m4 = parseObject(p?.moment_4_scores);
  const m5 = parseObject(p?.moment_5_scores);
  if (m4?.mentalizing_overcertainty === true) labels.push('Moment 4');
  if (m5?.mentalizing_overcertainty === true) labels.push('Moment 5');
  return labels;
}

function buildAdminGateComputeOptions(attempt: AttemptRow): ComputeGateResultOptions {
  const rawSkip = attempt.skip_penalty_total;
  const skipNum =
    typeof rawSkip === 'number' && Number.isFinite(rawSkip) ? rawSkip : Number(rawSkip);
  const skipPenaltyTotal = Number.isFinite(skipNum) ? skipNum : 0;
  const responses = hydrateEmotionResponsesFromStorage(attempt.emotion_recognition_responses);
  const correctOpt = emotionRecognitionCorrectCount(responses);
  const rawEmotion = resolveEmotionRecognitionRawScoreForGate({
    emotionRecognitionRawScore: attempt.emotion_recognition_raw_score,
    emotionRecognitionCorrectCount: correctOpt,
    emotionRecognitionResponses: attempt.emotion_recognition_responses,
  });
  return {
    skipPenaltyTotal,
    skipAutoFail: attempt.auto_failed === true,
    egoDevelopmentLevel: attempt.ego_development_level ?? null,
    defensePatterns: attempt.defense_patterns ?? DEFAULT_DEFENSE_PATTERNS,
    moment4Concreteness: attempt.moment_4_concreteness ?? null,
    moment5Concreteness: attempt.moment_5_concreteness ?? null,
    emotionRecognitionRawScore: rawEmotion ?? undefined,
    emotionRecognitionCorrectCount: correctOpt ?? undefined,
    emotionRecognitionResponses: attempt.emotion_recognition_responses,
    mentalizingOvercertaintyCount: attempt.mentalizing_overcertainty_count ?? null,
    disclosureCalibration: attempt.disclosure_calibration ?? null,
    closingIntegration: attempt.closing_integration ?? null,
    personalMomentEmotionalVocabLow: attempt.personal_moment_emotional_vocab_low === true,
  };
}

const EGO_LEVEL_ADMIN_SHORT_DESC: Record<number, string> = {
  1: 'Concrete and rule-based',
  2: 'Multiple perspectives, simplified resolution',
  3: 'Holds complexity, recognizes patterns',
  4: 'Integrates contradictions, genuine depth',
  5: 'Systemic relational understanding',
};

function defenseCrossRefConfidenceColor(level: 'high' | 'moderate' | 'low'): string {
  if (level === 'high') return '#2A8C6A';
  if (level === 'moderate') return '#D4A84B';
  return '#E87A7A';
}

function defenseCrossRefConsistencyLabel(consistent: boolean | null): string {
  if (consistent === true) return 'Consistent';
  if (consistent === false) return 'Contradicting';
  return 'Neutral / insufficient data';
}

function DepthSignalsTab({
  attempt,
  user,
}: {
  attempt: AttemptRow;
  user?: AdminUserProfileRecord | null;
}) {
  const pillars = pillarScoresForGate(attempt);
  const gateEcho = computeGateResultCore(pillars, null, buildAdminGateComputeOptions(attempt));
  const dp = attempt.defense_patterns ?? DEFAULT_DEFENSE_PATTERNS;
  const defenseActiveCount = [
    dp.projection_detected,
    dp.rationalization_detected,
    dp.splitting_detected,
    dp.denial_detected,
  ].filter(Boolean).length;
  const flags = reviewFlagsFromStoredAttempt(attempt);
  const hasFlags = flags.length > 0;
  const legacyErFloorReview = isLegacyEmotionRecognitionFloorOnlyFail(attempt);
  const responses = hydrateEmotionResponsesFromStorage(attempt.emotion_recognition_responses);
  const emotionBatteryComplete = isEmotionRecognitionBatteryComplete(responses);
  const correctN = emotionRecognitionCorrectCount(responses);
  const pct = emotionRecognitionDisplayPercentFromAttemptsRow({
    emotion_recognition_raw_score: attempt.emotion_recognition_raw_score,
    emotion_recognition_responses: attempt.emotion_recognition_responses,
  });
  const egoLevel =
    typeof attempt.ego_development_level === 'number' && Number.isFinite(attempt.ego_development_level)
      ? Math.round(attempt.ego_development_level)
      : null;
  const depthModifier =
    attempt.depth_signal_modifier ?? attempt.score_modifier ?? gateEcho.depthSignalModifier ?? gateEcho.scoreModifier;
  const psychometricModifier = attempt.psychometric_modifier_applied;
  const correctedPsychometricModifier =
    attempt.corrected_psychometric_modifier ?? psychometricModifier;
  const finalModified =
    attempt.modified_weighted_score_with_psychometrics ??
    attempt.modified_weighted_score ??
    attempt.weighted_score;
  const sm = depthModifier;
  const scoreModNonZero = typeof sm === 'number' && Number.isFinite(sm) && sm !== 0;
  const defenseCrossRef = attempt.defense_cross_reference ?? null;
  const gateEchoDepthModifier =
    gateEcho.depthSignalModifier ?? gateEcho.scoreModifier ?? 0;
  const crossRefModifierAdjustment = defenseCrossRef?.modifierAdjustment ?? 0;
  const wReq = parseGateFailDetailRow(attempt)?.weighted_score?.requiredMin;
  const detailThreshold =
    typeof wReq === 'number' && Number.isFinite(wReq) ? wReq : GATE_PASS_WEIGHTED_MIN;
  const overcertaintyLabels = adminMentalizingOvercertaintyLabels(attempt);

  return (
    <ScrollView style={styles.innerTabContent}>
      <ScoreReceiptCard attempt={attempt} user={user} variant="dark" />
      <GamingCorrectionBanner gamingCorrection={attempt.gaming_correction ?? null} />
      <UncertaintyScoreCard
        uncertaintyScore={attempt.uncertainty_score ?? null}
        breakdown={
          (attempt.uncertainty_breakdown as import('@features/psychometrics/computeUncertaintyScore').UncertaintyBreakdown | null) ??
          null
        }
      />
      <Text style={styles.sectionTitle}>Section A — Score modifiers</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Raw weighted score</Text>
        <Text style={styles.metaValue}>{formatScoreCell(attempt.weighted_score)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Depth signal modifier</Text>
        <Text
          style={[
            styles.metaValue,
            { color: typeof depthModifier === 'number' && depthModifier < 0 ? '#E87A7A' : typeof depthModifier === 'number' && depthModifier === 0 ? '#2A8C6A' : '#f4f4f5' },
          ]}
        >
          {typeof depthModifier === 'number' && Number.isFinite(depthModifier) ? depthModifier.toFixed(2) : '—'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Psychometric modifier (raw)</Text>
        <Text style={styles.metaValue}>
          {psychometricModifier != null && Number.isFinite(psychometricModifier)
            ? psychometricModifier.toFixed(2)
            : 'pending'}
        </Text>
      </View>
      {correctedPsychometricModifier != null &&
      psychometricModifier != null &&
      correctedPsychometricModifier !== psychometricModifier ? (
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Psychometric modifier (corrected)</Text>
          <Text style={styles.metaValue}>{correctedPsychometricModifier.toFixed(2)}</Text>
        </View>
      ) : null}
      <GamingCorrectionCard
        gamingCorrection={attempt.gaming_correction ?? null}
        variant="dark"
      />
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Final score (with psychometrics)</Text>
        <Text style={styles.metaValue}>{formatScoreCell(finalModified)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Modified weighted score (interview only)</Text>
        <Text style={styles.metaValue}>{formatScoreCell(attempt.modified_weighted_score)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Threshold (this attempt)</Text>
        <Text style={styles.metaValue}>
          {detailThreshold.toFixed(1)}
          {detailThreshold <= REFERRAL_WEIGHTED_PASS_MIN + 0.01 ? ' (referral band)' : ' (standard)'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Also</Text>
        <Text style={[styles.metaValue, { fontSize: 12, color: 'rgba(255,255,255,0.55)' }]}>
          Referral minimum {REFERRAL_WEIGHTED_PASS_MIN.toFixed(1)} · Standard {GATE_PASS_WEIGHTED_MIN.toFixed(1)}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Final gate</Text>
        <Text style={[styles.metaValue, { color: attempt.final_gate_pass === true ? '#2A8C6A' : attempt.final_gate_pass === false ? '#E87A7A' : '#7A9ABE' }]}>
          {attempt.final_gate_pass != null
            ? attempt.final_gate_pass
              ? 'PASS'
              : 'FAIL'
            : psychometricModifier != null
              ? 'pending psychometrics'
              : '—'}
        </Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Interview gate (pre-psychometric)</Text>
        <Text style={[styles.metaValue, { color: attempt.passed === true ? '#2A8C6A' : attempt.passed === false ? '#E87A7A' : '#7A9ABE' }]}>
          {attempt.passed === true ? 'PASS' : attempt.passed === false ? 'FAIL' : '—'}
        </Text>
      </View>
      {scoreModNonZero ? (
        <View style={[styles.block, { marginTop: 8 }]}>
          <Text style={styles.blockTitle}>Modifier breakdown (recomputed)</Text>
          <Text style={styles.blockText}>
            Ego development modifier:{' '}
            {gateEcho.egoDevelopmentModifier != null ? gateEcho.egoDevelopmentModifier.toFixed(2) : '—'}
          </Text>
          <Text style={styles.blockText}>
            Defense pattern modifier:{' '}
            {gateEcho.defensePatternScoreAdjustment != null ? gateEcho.defensePatternScoreAdjustment.toFixed(2) : '0.00'}
          </Text>
          <Text style={styles.blockText}>
            Personal moment concreteness modifier:{' '}
            {gateEcho.personalMomentConcretenessModifier != null
              ? gateEcho.personalMomentConcretenessModifier.toFixed(2)
              : '—'}
          </Text>
        </View>
      ) : null}
      <Text style={[styles.depthSignalFootnote, { marginTop: scoreModNonZero ? 6 : 10 }]}>
        Score modifiers are applied to the raw weighted score before the pass threshold comparison. They reflect
        structural features of the interview profile — defensive patterns, psychological maturity, and personal moment
        engagement quality — that the pillar scores don't fully capture individually.{'\n\n'}
        A passing weighted score can still result in a fail or review flag when modifiers are active. A borderline score
        can drop below threshold when multiple modifiers accumulate.
      </Text>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section B — Review flags</Text>
      <View
        style={[
          styles.block,
          hasFlags && {
            borderWidth: 1,
            borderColor: 'rgba(212, 168, 75, 0.55)',
            backgroundColor: 'rgba(212, 168, 75, 0.08)',
          },
        ]}
      >
        {!hasFlags ? (
          <Text style={styles.blockText}>No review flags.</Text>
        ) : (
          flags.map((f) => (
            <View key={f} style={{ marginBottom: 10 }}>
              <Text style={[styles.blockTitle, { fontSize: 13, marginBottom: 4 }]}>{f}</Text>
              <Text style={styles.blockText}>{ADMIN_REVIEW_FLAG_DESCRIPTIONS[f] ?? '—'}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section C — New pillar dimensions</Text>
      <View style={styles.block}>
        <Text style={styles.blockTitle}>Ego development level</Text>
        {egoLevel != null && egoLevel >= 1 && egoLevel <= 5 ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <View
                  key={n}
                  style={{
                    paddingHorizontal: 10,
                    paddingVertical: 6,
                    borderRadius: 8,
                    backgroundColor: n === egoLevel ? egoLevelAdminColor(egoLevel) : 'rgba(255,255,255,0.06)',
                    borderWidth: 1,
                    borderColor: n === egoLevel ? egoLevelAdminColor(egoLevel) : 'rgba(255,255,255,0.12)',
                  }}
                >
                  <Text style={{ color: n === egoLevel ? '#0a0a0f' : 'rgba(255,255,255,0.75)', fontWeight: '700', fontSize: 12 }}>
                    {n}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={[styles.blockText, { fontSize: 12, color: 'rgba(255,255,255,0.65)' }]}>
              {EGO_LEVEL_ADMIN_SHORT_DESC[egoLevel] ?? ''}
            </Text>
            <Text style={styles.depthSignalFootnote}>
              {`Holistic assessment of response sophistication across the full interview. Based on Loevinger's ego development framework — measures the complexity and maturity of how someone makes meaning of relational situations.\n\nLevel 1 — Concrete and rule-based. Black and white framing. Characters are simply right or wrong. No complexity held.\nLevel 2 — Aware of multiple perspectives but resolves them simplistically. "Both people need to communicate better." Gate modifier: -0.2.\nLevel 3 — Holds complexity without resolving it prematurely. Recognizes patterns. Uses psychological concepts naturally.\nLevel 4 — Integrates contradictions. Connects behavior to broader relational patterns. Tolerates ambiguity.\nLevel 5 — Systemic relational understanding. Recognizes how internal states drive patterns across relationships.\n\nLevel 1 with weighted score below 7.0 = gate fail. Level 1 with passing score = review flag. Level 2 = -0.2 score modifier applied.`}
            </Text>
          </>
        ) : (
          <Text style={styles.blockText}>—</Text>
        )}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Emotion recognition</Text>
        {legacyErFloorReview ? (
          <Text style={[styles.blockText, { color: '#D4A84B', marginBottom: 8 }]}>
            {LEGACY_EMOTION_RECOGNITION_FLOOR_REVIEW_NOTE}
          </Text>
        ) : null}
        <Text style={styles.depthSignalFootnote}>
          Ability-based test of emotion perception. Three multiple choice items — one per scenario — ask what a character
          is most likely feeling at a key moment. Scored against consensus correct answers. Tests whether the user can
          accurately read emotional states from situational context, independent of verbal fluency.{'\n\n'}
          Emotion recognition affects the depth signal modifier only (not a hard gate fail).{'\n\n'}
          Score guide:{'\n'}
          3/3 — Strong emotion perception{'\n'}
          2/3 — Adequate, review flag{'\n'}
          1/3 — Review flag: limited emotion reading accuracy{'\n'}
          0/3 — −0.20 depth modifier (no gate fail){'\n'}
          Incomplete battery (&lt; 3 responses) — scores nulled, no modifier
        </Text>
        <Text style={styles.blockText}>
          {!emotionBatteryComplete && countAnsweredEmotionItems(responses) > 0
            ? `Incomplete battery (${countAnsweredEmotionItems(responses)}/${EXPECTED_EMOTION_RECOGNITION_ITEMS} recorded)`
            : correctN != null
              ? `${correctN} of 3 correct`
              : countAnsweredEmotionItems(responses) === 0
                ? 'No responses recorded'
                : 'Incomplete battery'}
          {pct != null ? ` · ${pct}%` : emotionBatteryComplete ? '' : ''}
        </Text>
        {EMOTION_INTERVIEW_MODAL_ITEMS.map((_item, i) => {
          const userAns = responses[i]?.trim() ? responses[i]!.trim().toUpperCase() : '—';
          const correctLetter = EMOTION_ITEM_CORRECT_ANSWERS[i];
          const ok = userAns === correctLetter;
          const label = i === 0 ? 'Item 1 (Emma/Ryan)' : i === 1 ? 'Item 2 (Sarah/James)' : 'Item 3 (Sophie/Daniel)';
          return (
            <Text key={i} style={[styles.blockText, { marginTop: 6 }]}>
              {label}: User answered {userAns} — Correct: {correctLetter}{' '}
              {userAns === '—' ? '(missing)' : ok ? '✓' : '✗'}
            </Text>
          );
        })}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Personal moment concreteness</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Measures whether the user engaged with their own personal experience when asked about grudges and conflicts, or retreated to general philosophy.\n\nabsent — No personal example provided. Deflected or claimed no relevant experience.\nlow — Vague reference to a type of situation with no named person or specific event.\nmoderate — Specific person or situation named but thin on narrative detail or emotional content.\nhigh — Specific person named, concrete event described, emotional content present, personal reflection shown.\n\nBoth absent or low applies a score penalty. Users who give rich scenario responses but consistently avoid personal engagement are showing low private self-awareness.`}
        </Text>
        <Text style={[styles.blockText, { color: concretenessAdminColor(attempt.moment_4_concreteness ?? undefined) }]}>
          Moment 4: {attempt.moment_4_concreteness ?? '—'}
        </Text>
        <Text style={[styles.blockText, { color: concretenessAdminColor(attempt.moment_5_concreteness ?? undefined) }]}>
          Moment 5: {attempt.moment_5_concreteness ?? '—'}
        </Text>
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Mentalizing overcertainty</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Flags responses where the user states characters' internal states as facts rather than inferences. Genuine high-level mentalizing requires holding uncertainty about others' inner lives — "Ryan might be avoiding tension" is healthy inference; "Ryan clearly doesn't care" is overcertainty.\n\nTrigger examples: "clearly doesn't care," "he's never going to change," "definitely emotionally unavailable," "the type of person who can't," attachment diagnoses stated as fact.\n\nWhen flagged: mentalizing score capped at 7 for that scenario. Count of 2+ adds a review flag.`}
        </Text>
        <Text style={styles.blockText}>
          {typeof attempt.mentalizing_overcertainty_count === 'number'
            ? `${attempt.mentalizing_overcertainty_count} moments flagged for overcertainty`
            : '—'}
        </Text>
        {overcertaintyLabels.length > 0 ? (
          <Text style={[styles.blockText, { marginTop: 6 }]}>{overcertaintyLabels.join(' · ')}</Text>
        ) : null}
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Personal moment emotional vocabulary</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Measures whether the user uses emotional vocabulary words when describing their own personal experiences — words that name or characterize internal emotional states (angry, hurt, ashamed, proud, anxious, relieved, etc.).\n\nCompares emotional vocabulary density in personal moment responses against scenario responses. A significant gap — analytically rich in scenarios but emotionally flat in personal moments — signals possible alexithymia: difficulty accessing or describing one's own feelings.\n\nNormal — density is adequate or consistent with scenario responses.\nLow — personal moment emotional vocabulary significantly below scenario average. Review flag when combined with low concreteness.`}
        </Text>
        <Text style={styles.blockText}>
          {attempt.personal_moment_emotional_vocab_low === true ? 'Low ⚑' : 'Normal ✓'}
        </Text>
      </View>

      <View style={[styles.block, { marginTop: 12 }]}>
        <Text style={styles.blockTitle}>Disclosure calibration</Text>
        <Text style={styles.depthSignalFootnote}>
          {`Assesses whether the user's personal moment disclosures were appropriate for the interview context — neither too guarded nor overwhelming.\n\nCalibrated — personal disclosures were specific and emotionally honest without being either avoidant or excessive. No flag.\n\nUnderdisclosure — personal responses significantly shorter and less specific than scenario responses, with both moments at absent or low concreteness. The user engages analytically with fictional others but closes down when asked about their own experience. Signals low private self-awareness or experiential avoidance.\n\nOverdisclosure — personal responses exceeded appropriate scope: very high word count, unsolicited clinical trauma vocabulary, or extensive detail about third parties not relevant to the question. Signals poor social calibration or boundary awareness. Adds overdisclosure_review flag.`}
        </Text>
        <Text
          style={[
            styles.blockText,
            { color: disclosureAdminColor(attempt.disclosure_calibration ?? undefined), textTransform: 'capitalize' },
          ]}
        >
          {attempt.disclosure_calibration
            ? String(attempt.disclosure_calibration).replace(/_/g, ' ')
            : '—'}
        </Text>
      </View>

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Section D — Defense patterns</Text>
      <Text style={[styles.depthSignalFootnote, { marginTop: 4, marginBottom: 6 }]}>
        {`Cross-scenario detection of immature psychological defenses. Each flag fires when a consistent pattern is detected across the full interview. Individual flags apply a -0.1 score modifier. Three or more flags active simultaneously applies an additional penalty and triggers gate fail consideration.`}
      </Text>
      <View style={styles.defenseGrid}>
        {(
          [
            [
              'Projection',
              'projection_detected' as const,
              `User attributes qualities to fictional characters that their own personal moment responses demonstrate about themselves. e.g. calling Daniel conflict-avoidant while describing their own pattern of going quiet when overwhelmed.`,
            ],
            [
              'Rationalization',
              'rationalization_detected' as const,
              `User provides elaborate logical justifications for why repair isn't needed or why the accountable character bears no responsibility. Detected when repair refusal appears alongside extended explanatory content placing full blame elsewhere.`,
            ],
            [
              'Splitting',
              'splitting_detected' as const,
              `User consistently assigns all fault to one character across scenarios with no bilateral acknowledgment. One party is always entirely at fault, the other always blameless. Detected when accountability scores are consistently one-sided across all three scenarios.`,
            ],
            [
              'Denial',
              'denial_detected' as const,
              `User claims no conflicts, grudges, or negative experiences in personal moments while scenario responses show contemptuous or externalizing patterns. The gap between claimed equanimity and demonstrated contempt is the signal.`,
            ],
          ] as const
        ).map(([label, key, footnote]) => {
          const active = dp[key] === true;
          return (
            <View
              key={key}
              style={[
                styles.defenseGridCell,
                { borderColor: active ? 'rgba(232, 122, 122, 0.55)' : 'rgba(255,255,255,0.12)' },
              ]}
            >
              <Text style={styles.defenseGridTitle}>{label}</Text>
              <Text style={[styles.defenseGridState, { color: active ? '#E87A7A' : 'rgba(255,255,255,0.45)' }]}>
                {active ? 'DETECTED' : 'clear'}
              </Text>
              <Text style={styles.defenseCardFootnote}>{footnote}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.blockText, { marginTop: 10 }]}>
        {defenseActiveCount} of 4 immature defense patterns detected.
      </Text>
      {defenseActiveCount >= 3 ? (
        <View style={[styles.block, { marginTop: 10, borderLeftWidth: 4, borderLeftColor: '#E87A7A' }]}>
          <Text style={[styles.blockText, { color: '#F5A8A8', fontWeight: '600' }]}>
            High defense pattern load — automatic gate fail triggered.
          </Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { marginTop: 22 }]}>Defense cross-reference</Text>
      <Text style={[styles.depthSignalFootnote, { marginTop: 4, marginBottom: 6 }]}>
        Cross-validates NLP defense pattern detections against self-report psychometric scores. When
        behavioral detection and self-report diverge, modifier penalties may be partially reversed and
        admin review is recommended.
      </Text>
      {defenseCrossRef ? (
        <View style={styles.block}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Text style={styles.blockTitle}>Overall confidence</Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 8,
                backgroundColor: `${defenseCrossRefConfidenceColor(defenseCrossRef.overallConfidence)}22`,
                borderWidth: 1,
                borderColor: defenseCrossRefConfidenceColor(defenseCrossRef.overallConfidence),
              }}
            >
              <Text
                style={{
                  color: defenseCrossRefConfidenceColor(defenseCrossRef.overallConfidence),
                  fontWeight: '700',
                  fontSize: 12,
                  textTransform: 'uppercase',
                }}
              >
                {defenseCrossRef.overallConfidence}
              </Text>
            </View>
          </View>

          {defenseCrossRef.recommendAdminReview ? (
            <View
              style={{
                marginBottom: 12,
                padding: 10,
                borderRadius: 8,
                backgroundColor: 'rgba(212, 168, 75, 0.12)',
                borderWidth: 1,
                borderColor: 'rgba(212, 168, 75, 0.55)',
              }}
            >
              <Text style={{ color: '#D4A84B', fontWeight: '700', fontSize: 13 }}>
                Admin review recommended
              </Text>
            </View>
          ) : null}

          {crossRefModifierAdjustment !== 0 ? (
            <View style={{ marginBottom: 12 }}>
              <Text style={styles.blockTitle}>Modifier adjustment</Text>
              <Text style={styles.blockText}>
                Pre-cross-reference depth modifier: {gateEchoDepthModifier.toFixed(2)}
              </Text>
              <Text style={styles.blockText}>
                Cross-reference adjustment: +{crossRefModifierAdjustment.toFixed(2)}
              </Text>
              <Text style={styles.blockText}>
                Adjusted depth modifier: {typeof depthModifier === 'number' ? depthModifier.toFixed(2) : '—'}
              </Text>
            </View>
          ) : null}

          {defenseCrossRef.flags.length === 0 ? (
            <Text style={styles.blockText}>No cross-reference flags.</Text>
          ) : (
            defenseCrossRef.flags.map((flag) => (
              <View
                key={flag.flagName}
                style={{
                  marginBottom: 12,
                  paddingBottom: 12,
                  borderBottomWidth: 1,
                  borderBottomColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={[styles.blockTitle, { fontSize: 13 }]}>
                  {flag.defense.replace(/_/g, ' ')} · {flag.flagName}
                </Text>
                <Text style={styles.blockText}>
                  Detected: {flag.detected ? 'yes' : 'no'} · Self-report:{' '}
                  {defenseCrossRefConsistencyLabel(flag.selfReportConsistent)} · Confidence:{' '}
                  <Text style={{ color: defenseCrossRefConfidenceColor(flag.confidenceLevel) }}>
                    {flag.confidenceLevel}
                  </Text>
                </Text>
                <Text style={[styles.blockText, { marginTop: 4 }]}>{flag.description}</Text>
                {flag.flagName === 'defense_possible_false_negative' ? (
                  <Text style={[styles.blockText, { marginTop: 6, color: '#D4A84B' }]}>
                    Psychometric profile suggests possible missed defense detection in interview. No
                    behavioral detection occurred but self-report pattern warrants review.
                  </Text>
                ) : null}
              </View>
            ))
          )}
        </View>
      ) : (
        <View style={styles.block}>
          <Text style={styles.blockText}>Defense cross-reference not computed for this attempt.</Text>
        </View>
      )}
    </ScrollView>
  );
}

function SummaryTab({
  attempt,
  onAttemptMutated,
  candidateUser,
  profileUser,
}: {
  attempt: AttemptRow;
  onAttemptMutated?: () => void;
  /** User row for confirmation dialog (optional when viewing attempt outside cohort drill-down). */
  candidateUser?: UserRow | null;
  profileUser?: AdminUserProfileRecord | null;
}) {
  const [styleProfile, setStyleProfile] = useState<CommunicationStyleProfileRow | null>(null);
  const [styleStatus, setStyleStatus] = useState<'idle' | 'loading' | 'reprocessing'>('idle');
  const [stylePipelineErrorDisplay, setStylePipelineErrorDisplay] = useState<string | null>(
    attempt.communication_style_error ?? null
  );
  const [recalcBusy, setRecalcBusy] = useState(false);
  const [narrativeAutoRetrying, setNarrativeAutoRetrying] = useState(
    () =>
      adminAttemptEligibleForNarrativeAutoRetry(attempt) &&
      !adminNarrativeAutoRetryFinishedAttempts.has(attempt.id),
  );
  const [narrativeAutoRetryError, setNarrativeAutoRetryError] = useState<string | null>(null);
  const [resendingResultsEmail, setResendingResultsEmail] = useState(false);
  const [resendResultsEmailError, setResendResultsEmailError] = useState<string | null>(null);
  const [resendResultsEmailOk, setResendResultsEmailOk] = useState<string | null>(null);
  /** Fresh DB check on open — avoids flashing "not ready" when narrative already exists. */
  const [narrativeHydration, setNarrativeHydration] = useState<'loading' | 'ready' | 'pending'>('loading');
  const [styleAutoReprocessing, setStyleAutoReprocessing] = useState(false);
  const [adminSessionUserId, setAdminSessionUserId] = useState<string | null>(null);
  const [adminSessionEmail, setAdminSessionEmail] = useState<string | null>(null);
  const onAttemptMutatedRef = useRef(onAttemptMutated);
  onAttemptMutatedRef.current = onAttemptMutated;

  useEffect(() => {
    setStylePipelineErrorDisplay(attempt.communication_style_error ?? null);
  }, [attempt.id, attempt.communication_style_error]);

  useEffect(() => {
    const uid = typeof attempt.user_id === 'string' ? attempt.user_id.trim() : '';
    if (!uid) {
      setStyleProfile(null);
      setStyleStatus('idle');
      return;
    }
    let cancelled = false;
    setStyleStatus('loading');
    void fetchCommunicationStyleProfileRowForAdminWithInitialPoll(
      uid,
      attempt.id,
      () => !cancelled
    )
      .then((row) => {
        if (cancelled) return;
        setStyleProfile(row);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('[Admin] fetchCommunicationStyleProfileRowForAdmin failed', e);
        setStyleProfile(null);
      })
      .finally(() => {
        if (!cancelled) setStyleStatus('idle');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt.id, attempt.user_id]);

  useEffect(() => {
    const ar = parseObject(attempt.ai_reasoning);
    const primaryLabels = styleProfile?.style_labels_primary;
    const secondaryLabels = styleProfile?.style_labels_secondary;
    const labelCount =
      (Array.isArray(primaryLabels) ? primaryLabels.length : 0) +
      (Array.isArray(secondaryLabels) ? secondaryLabels.length : 0);
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b3376' },
      body: JSON.stringify({
        sessionId: '4b3376',
        hypothesisId: 'H_admin_attempt_view',
        location: 'AdminInterviewDashboard.tsx:SummaryTab',
        message: 'admin_attempt_loaded',
        data: {
          attemptId: attempt.id,
          reasoning_pending: attempt.reasoning_pending === true,
          narrativeStillPending: adminAiNarrativeStillPending(attempt),
          hasSubstantiveNarrative: adminAttemptHasSubstantiveAiReasoning(ar),
          aiReasoningKeys: ar ? Object.keys(ar).slice(0, 20) : [],
          _reasoningPending: !!(ar as { _reasoningPending?: boolean } | null)?._reasoningPending,
          _narrativeFailed: !!(ar as { _narrativeFailed?: boolean } | null)?._narrativeFailed,
          communication_style_error: attempt.communication_style_error ?? null,
          styleProfileSourceAttemptId: styleProfile?.source_attempt_id ?? null,
          styleLabelCount: labelCount,
          weighted_score: attempt.weighted_score ?? null,
          modified_weighted_score: attempt.modified_weighted_score ?? null,
          score_modifier: attempt.score_modifier ?? null,
          scoring_deferred:
            (attempt as { scoring_deferred?: boolean | null }).scoring_deferred === true,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, [
    attempt,
    attempt.id,
    attempt.ai_reasoning,
    attempt.reasoning_pending,
    attempt.communication_style_error,
    styleProfile,
    attempt.weighted_score,
    attempt.modified_weighted_score,
    attempt.score_modifier,
  ]);

  const transcriptReady =
    Array.isArray(attempt.transcript) && attempt.transcript.length > 0;

  useEffect(() => {
    let cancelled = false;
    setNarrativeHydration('loading');
    void (async () => {
      const fresh = await fetchAttemptNarrativeState(attempt.id);
      if (cancelled) return;
      if (fresh.substantive) {
        setNarrativeHydration('ready');
        const updated = await reconcileStaleReasoningPendingOnAdminView(attempt);
        if (!cancelled) onAttemptMutatedRef.current?.();
        return;
      }
      setNarrativeHydration(adminAiNarrativeStillPending(attempt) ? 'pending' : 'ready');
      const updated = await reconcileStaleReasoningPendingOnAdminView(attempt);
      if (!cancelled && updated) onAttemptMutatedRef.current?.();
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt.id]);

  useEffect(() => {
    const id = attempt.id;
    const ownerUserId = attempt.user_id;

    if (narrativeHydration === 'loading') {
      return;
    }

    if (adminNarrativeAutoRetryFinishedAttempts.has(id)) {
      setNarrativeAutoRetrying(false);
      return;
    }

    if (!transcriptReady) {
      return;
    }

    if (!adminAttemptEligibleForNarrativeAutoRetry(attempt)) {
      adminNarrativeAutoRetryFinishedAttempts.add(id);
      setNarrativeAutoRetrying(false);
      if (narrativeHydration === 'loading') {
        setNarrativeHydration(adminAiNarrativeStillPending(attempt) ? 'pending' : 'ready');
      }
      return;
    }

    if (adminNarrativeAutoRetryInFlight.has(id)) {
      return;
    }

    adminNarrativeAutoRetryInFlight.add(id);
    let cancelled = false;
    setNarrativeAutoRetrying(true);
    setNarrativeAutoRetryError(null);
    setNarrativeHydration('pending');
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b3376' },
      body: JSON.stringify({
        sessionId: '4b3376',
        hypothesisId: 'H_admin_auto_retry',
        location: 'AdminInterviewDashboard.tsx:SummaryTab',
        message: 'admin_auto_retry_start',
        data: { attemptId: id, ownerUserId },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    void (async () => {
      try {
        const r = await adminRetryNarrativeWithClientFallback(id, ownerUserId);
        if (cancelled) return;
        // #region agent log
        fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b3376' },
          body: JSON.stringify({
            sessionId: '4b3376',
            hypothesisId: 'H_admin_auto_retry',
            location: 'AdminInterviewDashboard.tsx:SummaryTab',
            message: 'admin_auto_retry_done',
            data: {
              attemptId: id,
              ok: 'ok' in r,
              via: 'ok' in r ? r.via : r.via,
              error: 'error' in r ? r.error : null,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
        if ('error' in r) {
          setNarrativeAutoRetryError(r.error);
          if (!cancelled) setNarrativeHydration('pending');
        } else {
          const fresh = await fetchAttemptNarrativeState(id);
          if (!cancelled) {
            setNarrativeHydration(fresh.substantive ? 'ready' : 'pending');
          }
        }
        onAttemptMutatedRef.current?.();
      } finally {
        adminNarrativeAutoRetryFinishedAttempts.add(id);
        if (!cancelled) setNarrativeAutoRetrying(false);
        adminNarrativeAutoRetryInFlight.delete(id);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [attempt.id, transcriptReady, narrativeHydration]);

  useEffect(() => {
    if (!narrativeAutoRetrying) return;
    const id = attempt.id;
    let cancelled = false;
    const tick = async () => {
      const fresh = await fetchAttemptNarrativeState(id);
      if (cancelled) return;
      if (fresh.substantive) {
        setNarrativeHydration('ready');
        setNarrativeAutoRetrying(false);
        onAttemptMutatedRef.current?.();
      }
    };
    void tick();
    const interval = setInterval(() => void tick(), 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [narrativeAutoRetrying, attempt.id]);

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

      const row = await fetchCommunicationStyleProfileRowForAdmin(attempt.user_id);
      setStyleProfile(row);
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
  const gateWithOpts = computeGateResultCore(gateScores, null, buildAdminGateComputeOptions(attempt));
  const gateFailureLines =
    !gate.pass && outcome.outcomeLabel !== 'none' ? formatGateFailureLines(gate, gateScores) : [];
  const gateFailReasons = asAdminStringArray(attempt.gate_fail_reasons);
  const storedPsychometricFloors = extractPsychometricFloorsFromGateDetail(
    parseGateFailDetailRow(attempt) as Record<string, unknown> | null,
  );
  const profileStraightLineFlags = asAdminStringArray(profileUser?.psychometric_straight_line_flags);
  const profilePsychometricScores = {
    rfqScore: profileUser?.psychometrics_rfq_score ?? null,
    gaspScore: profileUser?.psychometrics_gasp_score ?? null,
    dweckScore: profileUser?.psychometrics_dweck_score ?? null,
    scsSfScore: profileUser?.psychometrics_scs_sf_score ?? null,
    sd3NarcissismScore: profileUser?.psychometrics_sd3_narcissism_score ?? null,
    brsScore: profileUser?.psychometrics_brs_score ?? null,
    anxietyTraitScore: profileUser?.psychometrics_anxiety_trait_score ?? null,
    aaq2Score: profileUser?.psychometrics_aaq2_score ?? null,
    rsesScore: profileUser?.psychometrics_rses_score ?? null,
    scsPublicScore: profileUser?.psychometrics_scs_public_score ?? null,
    scsPrivateScore: profileUser?.psychometrics_scs_private_score ?? null,
  };
  const activePsychometricGateFails = gateFailReasons.filter((id) =>
    (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id),
  );
  const retroactivePsychometricFloorReviews = getRetroactivePsychometricFloorReviews(
    attempt,
    profilePsychometricScores,
    profileStraightLineFlags,
  );
  const reasoningPendingSummary =
    narrativeHydration === 'pending' ||
    (narrativeHydration === 'loading' && adminAttemptEligibleForNarrativeAutoRetry(attempt));
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
      'This will overwrite pillar_scores, weighted_score, pass/fail, depth modifiers, gate fields, and scenario_composites on this row with values recomputed from stored scenario slices using the current rubric (transcript reconciliation + aggregation + gate only).',
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
      let egoLevel = attempt.ego_development_level;
      if (egoLevel == null) {
        const { data: egoOut, error: egoFnErr } = await supabase.functions.invoke('repair-interview-ego', {
          body: { attemptId: attempt.id },
        });
        const repaired =
          egoOut != null && typeof egoOut === 'object' && typeof (egoOut as { ego?: unknown }).ego === 'number'
            ? (egoOut as { ego: number }).ego
            : null;
        if (!egoFnErr && repaired != null && repaired >= 1 && repaired <= 5) {
          egoLevel = repaired;
        }
      }
      const result = recalculateAttemptScoresFromStoredSlices({
        transcript: attempt.transcript,
        scenario_1_scores: attempt.scenario_1_scores,
        scenario_2_scores: attempt.scenario_2_scores,
        scenario_3_scores: attempt.scenario_3_scores,
        scenario_specific_patterns: attempt.scenario_specific_patterns,
        ego_development_level: egoLevel,
        language_markers: attempt.language_markers,
      });
      const nowIso = new Date().toISOString();

      if (result.kind === 'success') {
        const delta = computePillarScoreDelta(oldPillars, result.pillar_scores);
        const interviewGateFailReasons = result.gate.failReasonCodes ?? [];
        const interviewGateFailDetail = normalizeGateFailDetailForPersist(result.gate.failReasonDetail);
        let gateFailReasons = interviewGateFailReasons;
        let gateFailDetail = interviewGateFailDetail;
        if (PSYCHOMETRICS_ENABLED) {
          const floorPrep = await preparePsychometricFloorGateState(
            attempt.user_id,
            interviewGateFailReasons,
            interviewGateFailDetail,
            { forceApply: true, attemptId: attempt.id, userId: attempt.user_id },
          );
          if ('gateFailReasons' in floorPrep) {
            gateFailReasons = floorPrep.gateFailReasons;
            gateFailDetail = floorPrep.gateFailDetail;
          }
        }
        const passedAfterFloors =
          gateFailReasons.length === 0 ? result.gate.pass : false;
        const { error } = await supabase
          .from('interview_attempts')
          .update({
            original_scores: snap,
            pillar_scores: result.pillar_scores,
            weighted_score: result.gate.weightedScore,
            passed: passedAfterFloors,
            gate_fail_reasons: gateFailReasons,
            gate_fail_detail: gateFailDetail,
            scenario_composites: result.scenarioCompositesJson,
            incomplete_reason: null,
            recalculated_at: nowIso,
            recalculation_delta: delta,
            recalculation_notes: result.notes,
            review_flags: result.gate.reviewFlags ?? [],
            mentalizing_overcertainty_count: result.mentalizingOvercertaintyCount,
            defense_patterns: result.defense_patterns,
            moment_4_concreteness:
              result.moment_4_concreteness ?? result.gate.moment4Concreteness ?? null,
            moment_5_concreteness:
              result.moment_5_concreteness ?? result.gate.moment5Concreteness ?? null,
            personal_moment_emotional_vocab_density: result.personal_moment_emotional_vocab_density,
            personal_moment_emotional_vocab_low: result.personal_moment_emotional_vocab_low,
            depth_signal_modifier:
              result.gate.depthSignalModifier ?? result.gate.scoreModifier ?? null,
            score_modifier: result.gate.scoreModifier ?? result.gate.depthSignalModifier ?? null,
            modified_weighted_score: result.gate.modifiedWeightedScore ?? null,
            disclosure_calibration: result.disclosure_calibration,
            ego_development_level: result.ego_development_level ?? egoLevel ?? null,
          })
          .eq('id', attempt.id)
          .eq('user_id', attempt.user_id);
        if (error) {
          Alert.alert('Recalculation failed', error.message);
          return;
        }
        const psychApply = await applyPsychometricModifierToAttempt(attempt.user_id, attempt.id, {
          forceApply: true,
        });
        const rollupNote = result.notes.find((n) => n.startsWith('rollup_algorithm:'));
        const rollupVersion = rollupNote?.slice('rollup_algorithm:'.length) ?? 'unknown';
        const pillarPreview = Object.entries(result.pillar_scores)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        const psychWarning = psychApply.applied
          ? null
          : `Psychometric floors/modifier were not applied (${psychApply.skipReason ?? 'unknown'}).`;
        Alert.alert(
          'Scores recalculated',
          [
            `Rollup: ${rollupVersion}`,
            `Weighted: ${result.gate.weightedScore?.toFixed(2) ?? '—'}`,
            `Pillars: ${pillarPreview}`,
            rollupVersion !== 'scenario_only_integers_v2'
              ? 'Warning: admin bundle is not on the fixed rollup — restart dev server or deploy latest code.'
              : Object.values(result.pillar_scores).some((v) => !Number.isInteger(v))
                ? 'Warning: pillar scores are not integers — stale admin bundle.'
                : 'Integer scenario-only rollup applied.',
            floorWarning,
            psychWarning,
          ]
            .filter(Boolean)
            .join('\n'),
        );
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
            gate_fail_reasons: [],
            gate_fail_detail: normalizeGateFailDetailForPersist(null),
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
          <Text style={[styles.blockTitle, { color: '#E8D49A' }]}>
            {narrativeHydration === 'loading'
              ? 'Checking AI narrative…'
              : narrativeAutoRetrying
                ? 'Generating AI narrative…'
                : 'AI narrative not ready'}
          </Text>
          <Text style={styles.blockText}>
            {narrativeHydration === 'loading'
              ? 'Loading the latest narrative status from the database…'
              : narrativeAutoRetrying
                ? 'Scores are saved; generating long-form AI reasoning automatically (this can take a few minutes). The page will refresh when ready.'
                : 'Scores are saved; long-form AI reasoning is still pending or failed. Open Tab 2 (AI Reasoning) to retry manually, or wait if generation is already running.'}
          </Text>
          {narrativeAutoRetryError ? (
            <Text style={[styles.blockText, { color: '#E87A7A', marginTop: 8 }]}>{narrativeAutoRetryError}</Text>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>Overall</Text>
      <ScoreReceiptCard attempt={attempt} user={profileUser} variant="dark" />
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
              Recalculate is disabled while automatic narrative generation is still marked in progress
              (`reasoning_pending` on the attempt row).
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
      <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#6B8CDB', marginTop: 8, marginBottom: 10 }]}>
        <Text style={[styles.blockTitle, { color: '#A8C4F0' }]}>Results email</Text>
        <Text style={styles.blockText}>Send or re-send the "results ready" email for this attempt.</Text>
        <TouchableOpacity
          disabled={resendingResultsEmail}
          onPress={() => {
            setResendResultsEmailError(null);
            setResendResultsEmailOk(null);
            setResendingResultsEmail(true);
            void (async () => {
              try {
                const { data, error } = await supabase.functions.invoke('send-results-email', {
                  body: { userId: attempt.user_id, attemptId: attempt.id, force: true },
                });
                if (error) {
                  const edgeMsg =
                    data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
                      ? (data as { error: string }).error
                      : null;
                  throw new Error(edgeMsg ? `${error.message}: ${edgeMsg}` : error.message);
                }
                setResendResultsEmailOk('Results email trigger sent.');
                onAttemptMutated?.();
              } catch (e) {
                setResendResultsEmailError(e instanceof Error ? e.message : String(e));
              } finally {
                setResendingResultsEmail(false);
              }
            })();
          }}
          style={styles.reprocessButton}
        >
          <Text style={styles.reprocessButtonText}>
            {resendingResultsEmail ? 'Sending…' : 'Resend results email'}
          </Text>
        </TouchableOpacity>
        {resendResultsEmailOk ? (
          <Text style={[styles.blockText, { color: '#8ACB88', marginTop: 8 }]}>{resendResultsEmailOk}</Text>
        ) : null}
        {resendResultsEmailError ? (
          <Text style={[styles.blockText, { color: '#E87A7A', marginTop: 8 }]}>{resendResultsEmailError}</Text>
        ) : null}
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
      {activePsychometricGateFails.map((floorId) => {
        const storedFloor = storedPsychometricFloors[floorId];
        const score =
          storedFloor?.score ??
          psychometricFloorScoreForUser(floorId, profilePsychometricScores);
        if (score == null || !Number.isFinite(score)) return null;
        const description =
          storedFloor?.description ?? formatPsychometricGateFailDescription(floorId, score);
        return (
          <View
            key={floorId}
            style={[
              styles.block,
              {
                marginTop: 4,
                marginBottom: 10,
                paddingVertical: 10,
                borderLeftWidth: 4,
                borderLeftColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.08)',
              },
            ]}
          >
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Text style={[styles.commFloorReviewBadge, { backgroundColor: '#ef4444', color: '#fff' }]}>Gate fail</Text>
              <Text style={[styles.blockTitle, { marginBottom: 0, color: '#F5A5A5' }]}>{floorId}</Text>
            </View>
            <Text style={styles.blockText}>{description}</Text>
          </View>
        );
      })}
      {retroactivePsychometricFloorReviews.map((review) => (
        <View
          key={review.id}
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
            <Text style={[styles.blockTitle, { marginBottom: 0, color: '#E8D49A' }]}>{review.id} (retroactive)</Text>
          </View>
          <Text style={styles.blockText}>{review.retroactiveNote}</Text>
          <Text style={[styles.blockText, { marginTop: 6 }]}>{review.description}</Text>
        </View>
      ))}
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
            Â· Threshold: {COMMUNICATION_FLOOR_MIN_AVG_WORDS}
          </Text>
          <Text style={styles.blockText} selectable>
            Dismissed:{' '}
            {attempt.communication_floor_dismissed_at
              ? new Date(attempt.communication_floor_dismissed_at).toLocaleString()
              : '—'}{' '}
            Â· Reviewer id: {attempt.communication_floor_dismissed_by ?? '—'}
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
      {(() => {
        const sm = attempt.score_modifier;
        if (typeof sm !== 'number' || !Number.isFinite(sm) || sm >= 0) return null;
        const parts: string[] = [];
        if (gateWithOpts.egoDevelopmentModifier != null && gateWithOpts.egoDevelopmentModifier !== 0) {
          parts.push('ego development');
        }
        if (gateWithOpts.defensePatternScoreAdjustment != null && gateWithOpts.defensePatternScoreAdjustment !== 0) {
          parts.push('defense patterns');
        }
        if (
          gateWithOpts.personalMomentConcretenessModifier != null &&
          gateWithOpts.personalMomentConcretenessModifier !== 0
        ) {
          parts.push('personal moment concreteness');
        }
        const tail = parts.length ? ` (${parts.join(', ')})` : '';
        return (
          <View style={{ marginBottom: 6 }}>
            <Text style={styles.summaryModifierHint}>
              Score modifier: <Text style={styles.summaryModifierRed}>{sm.toFixed(2)}</Text>
              {tail}
            </Text>
            <Text style={styles.summaryModifierHint}>
              Adjusted score:{' '}
              <Text style={{ fontWeight: '600', color: 'rgba(230,238,248,0.95)' }}>
                {formatScoreCell(attempt.modified_weighted_score)}
              </Text>{' '}
              ← threshold comparison used this
            </Text>
          </View>
        );
      })()}
      {PILLAR_ROWS.map((p) => (
        <View key={p.id} style={styles.scoreRow}>
          <Text style={styles.scoreLabel}>{p.label}</Text>
          <Text style={styles.scoreValue}>
            {formatScoreCell(totalScores[p.id])}
            {(aggregate.counts[p.id] ?? 0) > 0 &&
            (aggregate.counts[p.id] ?? 0) < 2
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
          {styleAutoReprocessing || styleStatus === 'reprocessing'
            ? 'reprocessing automatically…'
            : styleProfile
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
          const transcriptOpts = buildCommunicationStyleTranscriptOptionsForAdmin(attempt.transcript);
          const live =
            styleProfile != null
              ? translateStyleProfile(
                  styleProfileFromDbRow(styleProfile as unknown as Record<string, unknown>),
                  transcriptOpts,
                )
              : null;
          const primaryStored = styleProfile?.style_labels_primary;
          const secondaryStored = styleProfile?.style_labels_secondary;
          const summaryStored = styleProfile?.matchmaker_summary;
          const lowNoteStored = styleProfile?.low_confidence_note;
          const summaryDisplayText =
            live?.matchmaker_summary?.trim() || summaryStored?.trim() || '';
          const primaryForDisplay = Array.isArray(primaryStored) && primaryStored.filter(Boolean).length > 0
            ? primaryStored
            : Array.isArray(live?.primary)
              ? live.primary
              : [];
          const secondaryForDisplay = Array.isArray(secondaryStored) && secondaryStored.filter(Boolean).length > 0
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
              {summaryDisplayText ? (
                <Text style={styles.blockText}>Matchmaker summary: {summaryDisplayText}</Text>
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
  const [resendingResultsEmail, setResendingResultsEmail] = useState(false);
  const [resendResultsEmailError, setResendResultsEmailError] = useState<string | null>(null);
  const [resendResultsEmailOk, setResendResultsEmailOk] = useState<string | null>(null);
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
                try {
                  const r = await adminRetryNarrativeWithClientFallback(attempt.id, attempt.user_id);
                  if ('error' in r) {
                    setReasoningRetryError(r.error);
                    onRefreshAfterReasoning?.();
                  } else {
                    onRefreshAfterReasoning?.();
                  }
                } catch (e) {
                  setReasoningRetryError(e instanceof Error ? e.message : String(e));
                } finally {
                  setReasoningRetrying(false);
                }
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
      <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#6B8CDB', marginBottom: 12 }]}>
        <Text style={[styles.blockTitle, { color: '#A8C4F0' }]}>Results email</Text>
        <Text style={styles.blockText}>
          Send or re-send the transactional "results ready" email for this attempt.
        </Text>
        <TouchableOpacity
          disabled={resendingResultsEmail}
          onPress={() => {
            setResendResultsEmailError(null);
            setResendResultsEmailOk(null);
            setResendingResultsEmail(true);
            void (async () => {
              try {
                const { data, error } = await supabase.functions.invoke('send-results-email', {
                  body: { userId: attempt.user_id, attemptId: attempt.id, force: true },
                });
                if (error) {
                  const edgeMsg =
                    data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
                      ? (data as { error: string }).error
                      : null;
                  throw new Error(edgeMsg ? `${error.message}: ${edgeMsg}` : error.message);
                }
                setResendResultsEmailOk('Results email trigger sent.');
                onRefreshAfterReasoning?.();
              } catch (e) {
                setResendResultsEmailError(e instanceof Error ? e.message : String(e));
              } finally {
                setResendingResultsEmail(false);
              }
            })();
          }}
          style={styles.reprocessButton}
        >
          <Text style={styles.reprocessButtonText}>
            {resendingResultsEmail ? 'Sending…' : 'Resend results email'}
          </Text>
        </TouchableOpacity>
        {resendResultsEmailOk ? (
          <Text style={[styles.blockText, { color: '#8ACB88', marginTop: 8 }]}>{resendResultsEmailOk}</Text>
        ) : null}
        {resendResultsEmailError ? (
          <Text style={[styles.blockText, { color: '#E87A7A', marginTop: 8 }]}>{resendResultsEmailError}</Text>
        ) : null}
      </View>

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
          {m.role}: {formatTranscriptTurnContentForDisplay(m.role, m.content)}
        </Text>
      ))}
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
  /** All full attempt rows for this user (newest first). */
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
  const [activeInnerTab, setActiveInnerTab] = useState<AdminAttemptInnerTabId>('summary');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [retakeAllowBusy, setRetakeAllowBusy] = useState(false);
  const [profileUser, setProfileUser] = useState<AdminUserProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (attempts.length === 0) {
      setSelectedAttemptId(null);
      return;
    }
    if (!selectedAttemptId || !attempts.some((a) => a.id === selectedAttemptId)) {
      setSelectedAttemptId(attempts[0]!.id);
    }
  }, [attempts, selectedAttemptId]);

  const selectedAttempt = attempts.find((a) => a.id === selectedAttemptId) ?? attempts[0] ?? null;
  const u = userData.user;
  const attemptIdForOverride =
    selectedAttempt?.id ??
    userData.latestAttempt?.id ??
    (typeof u.latest_attempt_id === 'string' ? u.latest_attempt_id : null);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void fetchAdminUserProfile(u.id).then((data) => {
      if (cancelled) return;
      setProfileUser(data ?? EMPTY_ADMIN_USER_PROFILE(u.id));
      setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [u.id]);
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
        if (attemptIdForOverride) {
          const attemptResult = await updateInterviewAttemptRevealOverride(attemptIdForOverride, pass);
          if (!attemptResult.ok && !attemptResult.columnsMissing) {
            Alert.alert('Update failed', attemptResult.errorMessage);
            return;
          }
        }
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
        if (attemptIdForOverride) {
          void supabase.functions.invoke('send-results-email', {
            body: { userId: u.id, attemptId: attemptIdForOverride },
          });
        }
        onRefreshData();
      } finally {
        setOverrideBusy(false);
      }
    },
    [attemptIdForOverride, onRefreshData, u.id, u.interview_passed_computed],
  );

  const handleAllowRetake = useCallback(async () => {
    if (!u.id) return;
    const ok = await confirmAsync({
      title: 'Allow interview retake?',
      message:
        'This clears the user’s active interview routing so they can start a new run. Prior attempt rows stay in the database for review.',
      confirmText: 'Allow retake',
    });
    if (!ok) return;
    setRetakeAllowBusy(true);
    try {
      await allowInterviewRetakeByAdmin(u.id);
      onRefreshData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not allow retake';
      Alert.alert('Allow retake failed', msg);
    } finally {
      setRetakeAllowBusy(false);
    }
  }, [onRefreshData, u.id]);

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
        {attempts.length > 0 ? (
          <Text style={styles.headerSub}>
            {attempts.length === 1 ? '1 interview run on file' : `${attempts.length} interview runs on file`}
          </Text>
        ) : null}
        <Text style={styles.headerPassMeta} selectable>
          Gate (computed): {u.interview_passed_computed == null ? '—' : String(u.interview_passed_computed)} Â·
          Admin override: {formatAdminPassFailLabel(u.interview_passed_admin_override)} Â·
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
          {u.interview_completed === true ? (
            <TouchableOpacity
              style={styles.overrideChip}
              onPress={() => void handleAllowRetake()}
              disabled={retakeAllowBusy}
              accessibilityRole="button"
              accessibilityLabel="Allow interview retake"
            >
              <Text style={styles.overrideChipText}>
                {retakeAllowBusy ? 'Allowing…' : 'Allow retake'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      <InProgressTranscriptSection
        user={userData.user}
        latestAttempt={userData.latestAttempt}
        liveTranscript={attempts.find((a) => a.completed_at == null)?.transcript}
        onRefresh={onRefreshData}
      />

      {attemptsLoading && activeInnerTab !== 'profile_intent' ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading interview data…</Text>
        </View>
      ) : attemptsError && activeInnerTab !== 'profile_intent' ? (
        <View style={styles.emptyState}>
          <Text style={styles.listErrorTitle}>Could not load tests</Text>
          <Text style={styles.listErrorDetail} selectable>
            {attemptsError}
          </Text>
        </View>
      ) : (
        <View style={styles.detailsLayoutSingle}>
          <View style={styles.detailsPaneFull}>
            {attempts.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.attemptTabsRowScroll}
                contentContainerStyle={styles.attemptTabsRowContent}
              >
                {attempts.map((att) => {
                  const active = att.id === selectedAttempt?.id;
                  const passWord = getPassWord(att);
                  return (
                    <TouchableOpacity
                      key={att.id}
                      style={[styles.attemptTab, active && styles.attemptTabActive]}
                      onPress={() => setSelectedAttemptId(att.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`View interview run ${att.attempt_number}`}
                    >
                      <Text style={[styles.attemptTabLabel, active && styles.attemptTabLabelActive]}>
                        Run {att.attempt_number}
                      </Text>
                      <Text style={styles.attemptTabLabel} numberOfLines={1}>
                        {formatAttemptTabLabel(att)}
                      </Text>
                      <Text style={[styles.attemptTabOutcome, { color: getPassColor(passWord) }]}>
                        {passWord === 'none' ? '—' : passWord}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={styles.innerTabsRow}>
              {adminDetailTabs().map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.innerTab, activeInnerTab === t.id && styles.innerTabActive]}
                  onPress={() => setActiveInnerTab(t.id)}
                >
                  <Text style={[styles.innerTabText, activeInnerTab === t.id && styles.innerTabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {attempts.length === 0 &&
            activeInnerTab !== 'profile_intent' &&
            !attemptsLoading &&
            !attemptsError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {userHasInProgressInterview(userData.user, userData.latestAttempt)
                    ? 'No completed tests yet — transcript above updates while they interview.'
                    : 'No tests found for this user.'}
                </Text>
                {userData.user.latest_attempt_id || userData.user.interview_completed ? (
                  <Text style={styles.emptyHint}>
                    Interview data exists for this account but full attempt rows did not load. If attempts stay empty
                    after refreshing, apply{' '}
                    <Text style={styles.emptyHintMono}>20260423150000_admin_rls_is_amoraea_admin_function.sql</Text>{' '}
                    (admin check via <Text style={styles.emptyHintMono}>auth.users</Text> email — JWT email in RLS is
                    unreliable), and ensure{' '}
                    <Text style={styles.emptyHintMono}>20260423140000_interview_attempts_rls_admin_and_own.sql</Text>{' '}
                    policies exist for <Text style={styles.emptyHintMono}>interview_attempts</Text>.
                  </Text>
                ) : null}
              </View>
            ) : (
              renderAdminDetailTabContent(activeInnerTab, {
                profileUser: profileUser ?? EMPTY_ADMIN_USER_PROFILE(u.id),
                profileLoading,
                selectedAttempt,
                onRefreshData,
                candidateUser: u,
              })
            )}
          </View>
        </View>
      )}
    </View>
  );
}

export function AdminAttemptTabsView({
  attemptId,
  userId,
  candidateUser,
}: {
  attemptId: string | null;
  userId?: string;
  candidateUser?: UserRow | null;
}) {
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeInnerTab, setActiveInnerTab] = useState<AdminAttemptInnerTabId>('summary');
  const [profileUser, setProfileUser] = useState<AdminUserProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  const refreshAttempt = useCallback(async () => {
    try {
      if (!attemptId && !userId) {
        setAttempt(null);
        return;
      }
      for (let i = 0; i < 4; i++) {
        const select = await adminInterviewAttemptsFullSelect();
        const query = attemptId
          ? supabase.from('interview_attempts').select(select).eq('id', attemptId).maybeSingle()
          : supabase
              .from('interview_attempts')
              .select(select)
              .eq('user_id', userId!)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();
        const { data, error } = await query;
        if (!error) {
          if (!(await getInterviewAttemptGamingCorrectionColumnsAbsent())) {
            void markInterviewAttemptGamingCorrectionColumnsPresent();
          }
          if (!(await getInterviewAttemptDefenseCrossReferenceColumnAbsent())) {
            void markInterviewAttemptDefenseCrossReferenceColumnPresent();
          }
          if (!(await getInterviewAttemptOverrideColumnsAbsent())) {
            void markInterviewAttemptOverrideColumnsPresent();
          }
          setAttempt((data as AttemptRow | null) ?? null);
          return;
        }
        if (!(await rememberInterviewAttemptSelectColumnAbsences(error))) {
          setAttempt(null);
          return;
        }
      }
      setAttempt(null);
    } catch {
      setAttempt(null);
    }
  }, [attemptId, userId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!attemptId && !userId) {
          if (!cancelled) setAttempt(null);
          return;
        }
        for (let i = 0; i < 4; i++) {
          const select = await adminInterviewAttemptsFullSelect();
          const query = attemptId
            ? supabase.from('interview_attempts').select(select).eq('id', attemptId).maybeSingle()
            : supabase
                .from('interview_attempts')
                .select(select)
                .eq('user_id', userId!)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
          const { data, error } = await query;
          if (cancelled) return;
          if (!error) {
            if (!(await getInterviewAttemptGamingCorrectionColumnsAbsent())) {
              void markInterviewAttemptGamingCorrectionColumnsPresent();
            }
            if (!(await getInterviewAttemptDefenseCrossReferenceColumnAbsent())) {
              void markInterviewAttemptDefenseCrossReferenceColumnPresent();
            }
            if (!(await getInterviewAttemptOverrideColumnsAbsent())) {
              void markInterviewAttemptOverrideColumnsPresent();
            }
            setAttempt((data as AttemptRow | null) ?? null);
            return;
          }
          if (!(await rememberInterviewAttemptSelectColumnAbsences(error))) {
            setAttempt(null);
            return;
          }
        }
        if (!cancelled) setAttempt(null);
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

  const resolvedUserId = userId ?? attempt?.user_id ?? candidateUser?.id ?? null;

  useEffect(() => {
    if (!resolvedUserId) {
      setProfileUser(null);
      setProfileLoading(false);
      return;
    }
    let cancelled = false;
    setProfileLoading(true);
    void fetchAdminUserProfile(resolvedUserId).then((data) => {
      if (cancelled) return;
      setProfileUser(data ?? EMPTY_ADMIN_USER_PROFILE(resolvedUserId));
      setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [resolvedUserId]);

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

  const profileRecord =
    profileUser ?? EMPTY_ADMIN_USER_PROFILE(resolvedUserId ?? attempt.user_id);

  return (
    <View style={{ width: '100%', maxWidth: 980 }}>
      <GamingCorrectionBanner gamingCorrection={attempt.gaming_correction ?? null} />
      <View style={styles.innerTabsRow}>
        {adminDetailTabs().map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[styles.innerTab, activeInnerTab === t.id && styles.innerTabActive]}
            onPress={() => setActiveInnerTab(t.id)}
          >
            <Text style={[styles.innerTabText, activeInnerTab === t.id && styles.innerTabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {renderAdminDetailTabContent(activeInnerTab, {
        profileUser: profileRecord,
        profileLoading,
        selectedAttempt: attempt,
        onRefreshData: () => void refreshAttempt(),
        candidateUser: candidateUser ?? ({ id: attempt.user_id } as UserRow),
      })}
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
  { id: 'flagged', label: 'Flagged' },
  { id: 'er_floor_review', label: 'ER floor review' },
  { id: 'sd3_narcissism_floor_review', label: 'SD3 narcissism floor review' },
  { id: 'psychometric_floor_review', label: 'Psych floor review' },
];

const TIME_RANGE_OPTIONS: { id: TimeRangeFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'day', label: '24h' },
  { id: 'three_days', label: '3d' },
  { id: 'week', label: '7d' },
  { id: 'month', label: '30d' },
  { id: 'custom', label: 'Custom' },
];

const BOOKMARK_COHORT_OPTIONS: { id: BookmarkCohortFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bookmarked', label: 'Yes' },
  { id: 'not_bookmarked', label: 'No' },
];

const HUMAN_VERIFIED_COHORT_OPTIONS: { id: HumanVerifiedCohortFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'pass', label: 'Pass' },
  { id: 'fail', label: 'Fail' },
  { id: 'unset', label: 'Unset' },
];

export function AdminInterviewDashboard({ onClose }: { onClose: () => void }) {
  const [adminMainView, setAdminMainView] = useState<'overview' | 'users' | 'feedback' | 'compatibility'>('users');
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');
  const [customTimeFrom, setCustomTimeFrom] = useState('');
  const [customTimeTo, setCustomTimeTo] = useState('');
  const [bookmarkCohortFilter, setBookmarkCohortFilter] = useState<BookmarkCohortFilter>('all');
  const [humanVerifiedCohortFilter, setHumanVerifiedCohortFilter] = useState<HumanVerifiedCohortFilter>('all');
  const [uncertaintyBandFilter, setUncertaintyBandFilter] = useState<UncertaintyBandFilter>('all');
  const [userListSort, setUserListSort] = useState<UserListSort>('date');
  const [hideIncomplete, setHideIncomplete] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');
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
        const { attempts, errorMessage: detailErr } = await fetchAllFullAttemptsForUser(selectedUserId);
        setDetailAttemptsLoading(false);
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

  useEffect(() => {
    let cancelled = false;
    void backfillMissingUncertaintyScores().then((n) => {
      if (n > 0 && !cancelled) void refreshUsers();
    });
    return () => {
      cancelled = true;
    };
  }, [refreshUsers]);

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
    void fetchAllFullAttemptsForUser(selectedUserId).then(({ attempts, errorMessage: detailErr }) => {
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
  }, [selectedUserId]);

  const selectedGroup = selectedUserId ? users.find((g) => g.user.id === selectedUserId) : null;

  const pipelineFiltered = useMemo(() => {
    let list = users;
    list = list.filter((g) => userMatchesTimeRange(g, timeRangeFilter, customTimeFrom, customTimeTo));
    if (bookmarkCohortFilter === 'bookmarked') {
      list = list.filter((g) => g.user.interview_cohort_admin_reviewed === true);
    } else if (bookmarkCohortFilter === 'not_bookmarked') {
      list = list.filter((g) => !g.user.interview_cohort_admin_reviewed);
    }
    if (humanVerifiedCohortFilter !== 'all') {
      list = list.filter((g) => userMatchesHumanVerifiedCohortFilter(g, humanVerifiedCohortFilter));
    }
    if (uncertaintyBandFilter !== 'all') {
      list = list.filter((g) => userMatchesUncertaintyFilter(g, uncertaintyBandFilter));
    }
    // "Only done" excludes non-completed interviews; skip when explicitly filtering Incomplete (in progress | no result).
    if (hideIncomplete && statusFilter !== 'incomplete') {
      list = list.filter((g) => g.user.interview_completed === true);
    }
    if (statusFilter !== 'all') {
      list = list.filter((g) => {
        if (statusFilter === 'flagged') {
          const flags = reviewFlagsFromStoredAttempt(g.latestAttempt);
          return flags.length > 0;
        }
        if (statusFilter === 'er_floor_review') {
          return g.latestAttempt != null && isLegacyEmotionRecognitionFloorOnlyFail(g.latestAttempt);
        }
        if (statusFilter === 'sd3_narcissism_floor_review') {
          return userGroupNeedsPsychometricFloorReview(g);
        }
        if (statusFilter === 'psychometric_floor_review') {
          return userGroupNeedsPsychometricFloorReview(g);
        }
        const s = classifyAdminUserListStatus(g);
        if (statusFilter === 'incomplete') return s === 'in_progress' || s === 'no_result';
        return s === statusFilter;
      });
    }
    if (userSearchQuery.trim()) {
      list = list.filter((g) => userGroupMatchesSearchQuery(g, userSearchQuery));
    }
    return list;
  }, [
    users,
    timeRangeFilter,
    customTimeFrom,
    customTimeTo,
    bookmarkCohortFilter,
    humanVerifiedCohortFilter,
    uncertaintyBandFilter,
    hideIncomplete,
    statusFilter,
    userSearchQuery,
  ]);

  const displayedUsers = useMemo(
    () => sortUserGroups(pipelineFiltered, userListSort),
    [pipelineFiltered, userListSort],
  );

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

  const handleCopyEmails = useCallback(async () => {
    const emails = collectFilteredUserEmails(pipelineFiltered);
    if (emails.length === 0) {
      Alert.alert('No email addresses', 'No users with email addresses match the current filters.');
      return;
    }
    try {
      await Clipboard.setStringAsync(emails.join(', '));
      Alert.alert(
        'Copied',
        `${emails.length} email address${emails.length === 1 ? '' : 'es'} copied to clipboard.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not copy to clipboard.';
      Alert.alert('Copy failed', msg);
    }
  }, [pipelineFiltered]);

  const setUserBookmarked = useCallback(async (userId: string, next: boolean) => {
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

  const setUserHumanVerified = useCallback(async (userId: string, pass: boolean | null) => {
    const { error } = await supabase
      .from('users')
      .update({ admin_human_verified_pass: pass })
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
        {adminMainView === 'users' ? (
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
            <TouchableOpacity
              style={[styles.exportCsvButton, (loading || !!listError) && styles.exportCsvButtonDisabled]}
              onPress={handleCopyEmails}
              disabled={loading || !!listError}
              accessibilityRole="button"
              accessibilityLabel="Copy filtered emails"
            >
              <Text style={styles.exportCsvButtonText}>Copy Emails</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          <TouchableOpacity
            style={[styles.filterChip, adminMainView === 'overview' && styles.filterChipActive]}
            onPress={() => setAdminMainView('overview')}
            accessibilityRole="button"
            accessibilityState={{ selected: adminMainView === 'overview' }}
          >
            <Text
              style={[styles.filterChipText, adminMainView === 'overview' && styles.filterChipTextActive]}
            >
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, adminMainView === 'users' && styles.filterChipActive]}
            onPress={() => setAdminMainView('users')}
            accessibilityRole="button"
            accessibilityState={{ selected: adminMainView === 'users' }}
          >
            <Text style={[styles.filterChipText, adminMainView === 'users' && styles.filterChipTextActive]}>
              Users
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
          <TouchableOpacity
            style={[styles.filterChip, adminMainView === 'compatibility' && styles.filterChipActive]}
            onPress={() => setAdminMainView('compatibility')}
            accessibilityRole="button"
            accessibilityState={{ selected: adminMainView === 'compatibility' }}
          >
            <Text
              style={[styles.filterChipText, adminMainView === 'compatibility' && styles.filterChipTextActive]}
            >
              Compatibility
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
      {adminMainView === 'overview' ? (
        <OverviewTab />
      ) : adminMainView === 'feedback' ? (
        <AdminFeedbackPanel />
      ) : adminMainView === 'compatibility' ? (
        <CompatibilityTab />
      ) : (
        <>
          <View style={styles.userSearchBar}>
            <Text style={styles.filterClusterLabel}>Search</Text>
            <TextInput
              value={userSearchQuery}
              onChangeText={setUserSearchQuery}
              placeholder="Name, email, or phone"
              placeholderTextColor="rgba(122, 154, 190, 0.45)"
              style={styles.userSearchInput}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              accessible
              accessibilityLabel="Filter users by name, email, or phone number"
            />
            {userSearchQuery.trim() ? (
              <TouchableOpacity
                onPress={() => setUserSearchQuery('')}
                style={styles.userSearchClearBtn}
                accessibilityRole="button"
                accessibilityLabel="Clear user search"
              >
                <Text style={styles.userSearchClearText}>Clear</Text>
              </TouchableOpacity>
            ) : null}
          </View>
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
                <Text style={styles.filterCustomHint}>Local dates Â· activity time</Text>
              </View>
            ) : null}
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Bookmark</Text>
              {BOOKMARK_COHORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[styles.filterChipCompact, bookmarkCohortFilter === opt.id && styles.filterChipActive]}
                  onPress={() => setBookmarkCohortFilter(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: bookmarkCohortFilter === opt.id }}
                >
                  <Text
                    style={[
                      styles.filterChipTextCompact,
                      bookmarkCohortFilter === opt.id && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Human verified</Text>
              {HUMAN_VERIFIED_COHORT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.filterChipCompact,
                    humanVerifiedCohortFilter === opt.id && styles.filterChipActive,
                  ]}
                  onPress={() => setHumanVerifiedCohortFilter(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: humanVerifiedCohortFilter === opt.id }}
                >
                  <Text
                    style={[
                      styles.filterChipTextCompact,
                      humanVerifiedCohortFilter === opt.id && styles.filterChipTextActive,
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
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Sort</Text>
              {(
                [
                  { id: 'date', label: 'Date' },
                  { id: 'uncertainty', label: 'Uncertainty' },
                ] as const
              ).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.filterChipCompact, userListSort === opt.id && styles.filterChipActive]}
                  onPress={() => setUserListSort(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: userListSort === opt.id }}
                >
                  <Text
                    style={[
                      styles.filterChipTextCompact,
                      userListSort === opt.id && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.filterCluster}>
              <Text style={styles.filterClusterLabel}>Uncertainty</Text>
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'low', label: 'Low (<0.4)' },
                  { id: 'medium', label: 'Medium' },
                  { id: 'high', label: 'High (≥0.6)' },
                ] as const
              ).map((opt) => (
                <Pressable
                  key={opt.id}
                  style={[styles.filterChipCompact, uncertaintyBandFilter === opt.id && styles.filterChipActive]}
                  onPress={() => setUncertaintyBandFilter(opt.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: uncertaintyBandFilter === opt.id }}
                >
                  <Text
                    style={[
                      styles.filterChipTextCompact,
                      uncertaintyBandFilter === opt.id && styles.filterChipTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
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
              displayedUsers.map((userData) => (
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
                  bookmarked={userData.user.interview_cohort_admin_reviewed === true}
                  onToggleBookmarked={(next) => void setUserBookmarked(userData.user.id, next)}
                  onSetHumanVerified={(pass) => void setUserHumanVerified(userData.user.id, pass)}
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
  userSearchBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  userSearchInput: {
    flex: 1,
    minWidth: 180,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.3)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#E8F0F8',
    fontSize: 13,
    backgroundColor: 'rgba(5,6,13,0.35)',
  },
  userSearchClearBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  userSearchClearText: {
    color: '#7A9ABE',
    fontSize: 12,
    fontWeight: '600',
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
    flexDirection: 'row',
    gap: 8,
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
  userCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userCardFlagMark: {
    fontSize: 14,
    color: '#D97A3A',
    fontWeight: '700',
  },
  userCardSignalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  userCardMicroChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  userCardMicroChipText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(200, 215, 235, 0.9)',
  },
  userCardScoreStrike: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.42)',
    fontSize: 11,
  },
  userCardScoreModified: {
    color: '#E87A7A',
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 6,
  },
  defenseGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  defenseGridCell: {
    width: '47%',
    minWidth: 140,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  defenseGridTitle: {
    color: 'rgba(230, 238, 248, 0.9)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  defenseGridState: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  summaryModifierHint: {
    fontSize: 11,
    color: 'rgba(180, 198, 220, 0.75)',
    marginTop: 2,
    marginLeft: 0,
  },
  /** Depth Signals tab: explanatory copy under construct headings (subordinate to values). */
  depthSignalFootnote: {
    fontSize: 11,
    color: 'rgba(180, 198, 220, 0.78)',
    lineHeight: 16,
    marginBottom: 10,
    marginTop: 2,
  },
  defenseCardFootnote: {
    fontSize: 10,
    color: 'rgba(180, 198, 220, 0.72)',
    lineHeight: 15,
    marginTop: 8,
  },
  summaryModifierRed: {
    color: '#E87A7A',
    fontWeight: '600',
  },
  userCardOverrideHint: {
    color: '#D4A84B',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  userCardSideCol: {
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(82,142,220,0.12)',
    minWidth: 168,
    width: 168,
    gap: 12,
  },
  bookmarkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  bookmarkLabel: {
    color: '#7A9ABE',
    fontSize: 10,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  humanVerifiedCol: {
    gap: 6,
  },
  humanVerifiedLabel: {
    color: '#7A9ABE',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  humanVerifiedCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  adminCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminCheckboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(82,142,220,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  adminCheckboxMark: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  adminCheckboxLabel: {
    color: '#C8E4FF',
    fontSize: 13,
    fontWeight: '500',
  },
  userCardOverrideRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  userCardOverrideChip: {
    flex: 1,
    minWidth: 68,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(30,111,217,0.12)',
    alignItems: 'center',
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
  attemptTabsRowScroll: {
    maxHeight: 108,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
  },
  attemptTabsRowContent: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 8,
    flexDirection: 'row',
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
    minWidth: 168,
    maxWidth: 240,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.16)',
    borderRadius: 8,
    backgroundColor: 'rgba(13,17,32,0.55)',
  },
  attemptTabActive: {
    backgroundColor: 'rgba(30,111,217,0.14)',
  },
  attemptTabLabel: {
    color: '#C8E4FF',
    fontSize: 12,
    letterSpacing: 0.3,
  },
  attemptTabLabelActive: {
    color: '#E8F4FF',
    fontWeight: '600',
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
