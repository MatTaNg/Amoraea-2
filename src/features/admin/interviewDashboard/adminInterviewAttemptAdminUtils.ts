import { supabase } from '@data/supabase/client';
import { COMMUNICATION_STYLE_PROFILE_SELECT } from '@data/supabase/tableSelects';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  type DefensePatternTranscriptMsg,
  type MarkerScoreSlice,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import { enrichScenarioSliceWithContemptHeuristic } from '@features/aria/contemptExpressionScenarioHeuristic';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '@features/aria/personalMomentSliceSanitize';
import {
  extractPersonalMomentEmotionalVocabFromSlice,
  scenarioEmotionalVocabDensityPercentFromTranscript,
} from '@features/aria/personalMomentEmotionalVocab';
import { DEFAULT_DEFENSE_PATTERNS } from '@features/aria/defensePatternsDetection';
import type { ComputeGateResultOptions } from '@features/aria/computeGateResultCore';
import {
  emotionRecognitionCorrectCount,
  hydrateEmotionResponsesFromStorage,
  resolveEmotionRecognitionRawScoreForGate,
} from '@features/aria/emotionRecognitionInterview';
import { interviewAiReasoningIsSubstantive, recoverFailedReasoningWithContent } from '@utilities/kickClientInterviewNarrativeIfPending';
import type { TranslateStyleProfileOptions } from '@utilities/styleTranslations';
import { userTurnContentsFromInterviewTranscript } from '../../../../supabase/functions/_shared/interviewStyleMarkers';
import {
  parseInterviewTranscriptMessages,
  splitUserCorpusScenarioVsPersonal,
  userTurnStringsScenarioMainAnalysis,
  userTurnStringsScenarioSegment,
} from '../../../../supabase/functions/_shared/splitInterviewUserCorpus';
import {
  ASSESSED_MARKERS_BY_SECTION,
  COMMUNICATION_STYLE_INITIAL_POLL_ATTEMPTS,
  COMMUNICATION_STYLE_INITIAL_POLL_DELAY_MS,
  MARKER_IDS,
} from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import {
  coerceScoreNumber,
  formatConstruct,
  getResolvedPillarScores,
  getScenarioPillarScoresMap,
  getString,
  normalizePillarScoresMap,
  parseObject,
} from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { AttemptRow, CommunicationStyleProfileRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function hasNonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item.trim().length > 0);
}

export function communicationStyleRowHasDisplayData(
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
export async function fetchCommunicationStyleProfileRowForAdmin(
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

export async function fetchCommunicationStyleProfileRowForAdminWithInitialPoll(
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

export function buildCommunicationStyleTranscriptOptionsForAdmin(
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


/** Non-empty narrative fields — pending stubs only carry _reasoningPending + pillar_scores + note. */
export function adminAttemptHasSubstantiveAiReasoning(ar: Record<string, unknown> | null): boolean {
  return interviewAiReasoningIsSubstantive(ar);
}

/**
 * True when the attempt is still missing long-form AI narrative, not only when `reasoning_pending` / _reasoningPending
 * flags are set (they can be stale after a successful retry or backfill).
 * `_narrativeFailed` / `_completionHeld` mean narrative is absent but not "in flight" — Tab 2 retry still applies.
 */
export function adminAiNarrativeStillPending(attempt: AttemptRow): boolean {
  const ar = parseObject(attempt.ai_reasoning);
  if (adminAttemptHasSubstantiveAiReasoning(ar)) return false;
  const narrativeFailed = !!(ar as { _narrativeFailed?: boolean } | null)?._narrativeFailed;
  const completionHeld = !!(ar as { _completionHeld?: boolean } | null)?._completionHeld;
  const flagPending =
    attempt.reasoning_pending === true || !!(ar as { _reasoningPending?: boolean } | null)?._reasoningPending;
  return flagPending || narrativeFailed || completionHeld;
}

/** Debounce auto-retry kicks per attempt within one SPA session (full page refresh clears). */
export const adminNarrativeAutoRetryInFlight = new Set<string>();
/** One automatic narrative retry per attempt per page load (manual Tab 2 retry still allowed). */
export const adminNarrativeAutoRetryFinishedAttempts = new Set<string>();

export const adminStyleAutoReprocessLastKickMs = new Map<string, number>();
export const adminStyleAutoReprocessInFlight = new Set<string>();
export const ADMIN_STYLE_AUTO_REPROCESS_COOLDOWN_MS = 120_000;

export function adminAttemptEligibleForNarrativeAutoRetry(attempt: AttemptRow): boolean {
  if (!adminAiNarrativeStillPending(attempt)) return false;
  const pillars = normalizePillarScoresMap(attempt.pillar_scores);
  if (!pillars || Object.keys(pillars).length === 0) return false;
  if (attempt.weighted_score == null || !Number.isFinite(attempt.weighted_score)) return false;
  const transcript = attempt.transcript;
  return Array.isArray(transcript) && transcript.length > 0;
}

export async function reconcileStaleReasoningPendingOnAdminView(attempt: AttemptRow): Promise<boolean> {
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


export function getMomentScoreBundle(
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

export function getScoreBundleDetails(raw: unknown): {
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
export function adminAttemptHasHolisticOnlyTraitScoresNoScenarioSlices(a: AttemptRow): boolean {
  const hasScenarioSlice =
    getScoreBundleDetails(a.scenario_1_scores).scores != null ||
    getScoreBundleDetails(a.scenario_2_scores).scores != null ||
    getScoreBundleDetails(a.scenario_3_scores).scores != null;
  if (hasScenarioSlice) return false;
  const resolved = getResolvedPillarScores(a);
  return MARKER_IDS.some((id) => coerceScoreNumber(resolved[id]) !== undefined);
}

export function markerIsAssessedInSection(sectionKey: string, markerId: string): boolean {
  return (ASSESSED_MARKERS_BY_SECTION[sectionKey] ?? []).includes(markerId);
}

export function extractAggregateSlice(raw: unknown): MarkerScoreSlice {
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

export function userTextForAdminScenario(
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
export function extractSanitizedMomentSlice(raw: unknown): MarkerScoreSlice {
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

export function extractSanitizedMoment5Slice(raw: unknown): MarkerScoreSlice {
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

export function computeMarkerAggregateFromAttempt(
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

export function buildMomentOrScenarioSummary(
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
export function formatAdminAttemptElapsed(start: string, end: string): string {
  const t0 = new Date(start).getTime();
  const t1 = new Date(end).getTime();
  const ms = t1 - t0;
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/** Sum per-turn latency + recording duration from `interview_attempts.response_timings` (active engagement, not wall clock). */
export function sumResponseTimingsActiveMs(
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

export function formatDurationMsHuman(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Prefer summed active time from `response_timings` when present; otherwise wall clock from
 * `created_at` to `completed_at` (or now), labeled so admins are not misled by overnight gaps.
 */
export function formatAttemptElapsedDisplay(attempt: {
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


export function functionInvokeBodyError(data: unknown): string | null {
  if (data && typeof data === 'object' && data !== null && 'error' in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === 'string' && e.trim()) return e.trim();
  }
  return null;
}


export function buildAdminGateComputeOptions(attempt: AttemptRow): ComputeGateResultOptions {
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


export function extractAdminScenarioSliceMeta(raw: unknown): { mentalizing_overcertainty?: boolean } | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  const ps = obj.pillarScores ?? obj.pillar_scores;
  const ke = obj.keyEvidence ?? obj.key_evidence;
  if (ps == null && ke == null) return null;
  return { mentalizing_overcertainty: obj.mentalizing_overcertainty === true };
}

export function adminMentalizingOvercertaintyLabels(attempt: AttemptRow): string[] {
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


