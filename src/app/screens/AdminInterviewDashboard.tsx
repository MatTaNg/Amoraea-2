/**
 * Alpha-only: Admin panel — cohort overview and individual user drill-down.
 * Visible only to admin@amoraea.com. Remove before production.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '@data/supabase/client';
import {
  aggregatePillarScoresWithCommitmentMergeDetailed,
  type MarkerScoreSlice,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import { enrichScenarioSliceWithContemptHeuristic } from '@features/aria/contemptExpressionScenarioHeuristic';
import { sanitizePersonalMomentScoresForAggregate } from '@features/aria/personalMomentSliceSanitize';
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
  moment_5: ['appreciation', 'attunement', 'mentalizing', 'contempt'],
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

/** Single source for admin gate (matches Edge Function `admin-delete-user`). */
export const ADMIN_CONSOLE_EMAIL = 'admin@amoraea.com';

async function confirmDeleteAccount(message: string): Promise<boolean> {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.confirm(message);
  }
  return new Promise((resolve) => {
    Alert.alert('Delete account', message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Delete', style: 'destructive', onPress: () => resolve(true) },
    ]);
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
  created_at?: string;
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
};

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
function extractSanitizedMomentSlice(raw: unknown, momentNumber: 4 | 5): MarkerScoreSlice {
  const slice = extractAggregateSlice(raw);
  if (!slice?.pillarScores) return slice;
  const sanitized = sanitizePersonalMomentScoresForAggregate(
    {
      pillarScores: slice.pillarScores as Record<string, number | null>,
      keyEvidence: slice.keyEvidence,
    },
    momentNumber,
  );
  if (!sanitized?.pillarScores) return slice;
  return { pillarScores: sanitized.pillarScores, keyEvidence: sanitized.keyEvidence };
}

function computeMarkerAggregateFromAttempt(
  attempt: AttemptRow
): { scores: Record<string, number>; counts: Record<string, number> } {
  const patterns = parseObject(attempt.scenario_specific_patterns);
  const m4Raw = parseObject(patterns?.moment_4_scores);
  const m5Raw = parseObject(patterns?.moment_5_scores);
  const tx = attempt.transcript;
  const slices: MarkerScoreSlice[] = [
    enrichScenarioSliceWithContemptHeuristic(extractAggregateSlice(attempt.scenario_1_scores), userTextForAdminScenario(tx, 1)),
    enrichScenarioSliceWithContemptHeuristic(extractAggregateSlice(attempt.scenario_2_scores), userTextForAdminScenario(tx, 2)),
    enrichScenarioSliceWithContemptHeuristic(extractAggregateSlice(attempt.scenario_3_scores), userTextForAdminScenario(tx, 3)),
    extractSanitizedMomentSlice(m4Raw, 4),
    extractSanitizedMomentSlice(m5Raw, 5),
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

type UserGroup = {
  user: UserRow;
  attempts: AttemptRow[];
  latestAttempt: AttemptRow | null;
};

function getUserDisplayName(user: UserRow | null | undefined): string {
  if (!user) return '—';
  return user.full_name ?? user.name ?? user.display_name ?? user.email ?? 'Unknown';
}

async function fetchAllAdminData(): Promise<UserGroup[]> {
  // Return ALL registered users (no filter) — include those who haven't started, in progress, completed, or passed
  const { data: allUsers, error: usersError } = await supabase
    .from('users')
    .select(
      `
      id,
      email,
      full_name,
      name,
      display_name,
      created_at
    `
    )
    .order('created_at', { ascending: false });

  if (usersError) {
    console.error('Admin panel users fetch error:', usersError);
    return [];
  }

  const { data: allAttempts, error: attemptsError } = await supabase
    .from('interview_attempts')
    .select(
      `
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
      communication_style_error
    `
    )
    .order('created_at', { ascending: false });

  if (attemptsError) {
    console.error('Admin panel attempts fetch error:', attemptsError);
  }

  const attempts = (allAttempts ?? []) as AttemptRow[];
  const users = (allUsers ?? []) as UserRow[];

  return users.map((user) => {
    const userAttempts = attempts.filter((a) => a.user_id === user.id);
    const latestAttempt =
      userAttempts.length > 0
        ? userAttempts.reduce((latest, a) =>
            a.attempt_number > latest.attempt_number ? a : latest
          )
        : null;
    return {
      user,
      attempts: userAttempts,
      latestAttempt,
    };
  });
}

function formatConstruct(key: string): string {
  const row = PILLAR_ROWS.find((r) => r.id === key || r.constructKey === key);
  return row?.label ?? key?.replace(/_/g, ' ') ?? '—';
}

function getPassWord(attempt: AttemptRow | null): 'pass' | 'fail' | 'none' {
  if (!attempt || attempt.passed == null) return 'none';
  return attempt.passed ? 'pass' : 'fail';
}

function getPassColor(value: 'pass' | 'fail' | 'none'): string {
  if (value === 'pass') return '#2A8C6A';
  if (value === 'fail') return '#E87A7A';
  return '#7A9ABE';
}

function formatAttemptDate(attempt: AttemptRow): string {
  const raw = attempt.completed_at ?? attempt.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString('en-GB');
}

function formatAttemptTabLabel(attempt: AttemptRow): string {
  const raw = attempt.completed_at ?? attempt.created_at;
  if (!raw) return `Test ${attempt.attempt_number}`;
  return new Date(raw).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getAttemptsSorted(attempts: AttemptRow[] | null | undefined): AttemptRow[] {
  if (!Array.isArray(attempts)) return [];
  return [...attempts].sort((a, b) => a.attempt_number - b.attempt_number);
}

function getString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function UserCard({
  userData,
  onPress,
  onDelete,
  canDelete,
  deleting,
}: {
  userData: UserGroup;
  onPress: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleting: boolean;
}) {
  const latest = userData.latestAttempt;
  const passWord = getPassWord(latest);
  return (
    <View style={styles.userCardRow}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.userCard, styles.userCardFlex, pressed && styles.userCardPressed]}
      >
        <Text style={styles.userCardName}>{getUserDisplayName(userData.user)}</Text>
        <Text style={styles.userCardEmail}>{userData.user.email ?? '—'}</Text>
        <View style={styles.userCardMetaRow}>
          <Text style={[styles.userCardStatus, { color: getPassColor(passWord) }]}>{passWord}</Text>
          <Text style={styles.userCardTests}>{userData.attempts?.length ?? 0} tests</Text>
        </View>
      </Pressable>
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
  );
}

function SummaryTab({ attempt }: { attempt: AttemptRow }) {
  const [styleProfile, setStyleProfile] = useState<CommunicationStyleProfileRow | null>(null);
  const [styleStatus, setStyleStatus] = useState<'idle' | 'loading' | 'reprocessing'>('idle');

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

  const reprocessStyle = async () => {
    setStyleStatus('reprocessing');
    try {
      const textRes = await supabase.functions.invoke('analyze-interview-text', {
        body: { user_id: attempt.user_id, attempt_id: attempt.id },
      });
      if (textRes.error) {
        console.error('[Admin] analyze-interview-text invoke failed', textRes.error);
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
  const perScenario = [
    { key: 'scenario_1', label: 'Scenario 1', scores: scenario1Details.scores, summary: buildMomentOrScenarioSummary('Scenario 1', scenario1Details) },
    { key: 'scenario_2', label: 'Scenario 2', scores: scenario2Details.scores, summary: buildMomentOrScenarioSummary('Scenario 2', scenario2Details) },
    { key: 'scenario_3', label: 'Scenario 3', scores: scenario3Details.scores, summary: buildMomentOrScenarioSummary('Scenario 3', scenario3Details) },
    { key: 'moment_4', label: 'Moment 4', scores: moment4Bundle.scores, summary: buildMomentOrScenarioSummary('Moment 4', moment4Details, moment4Bundle.summary) },
    { key: 'moment_5', label: 'Moment 5', scores: moment5Bundle.scores, summary: buildMomentOrScenarioSummary('Moment 5', moment5Details, moment5Bundle.summary) },
  ];
  const passWord = getPassWord(attempt);
  return (
    <ScrollView style={styles.innerTabContent}>
      <Text style={styles.sectionTitle}>Overall</Text>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Date</Text>
        <Text style={styles.metaValue}>{formatAttemptDate(attempt)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Text style={styles.metaLabel}>Result</Text>
        <Text style={[styles.metaValue, { color: getPassColor(passWord), textTransform: 'lowercase' }]}>{passWord}</Text>
      </View>
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
      {attempt.communication_style_error ? (
        <View style={[styles.block, { borderLeftWidth: 3, borderLeftColor: '#E87A7A', paddingLeft: 10 }]}>
          <Text style={[styles.blockTitle, { color: '#B33A3A' }]}>Style pipeline error (stored on attempt)</Text>
          <Text style={styles.blockText}>{attempt.communication_style_error}</Text>
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

function ReasoningTab({ attempt }: { attempt: AttemptRow }) {
  const reasoning = parseObject(attempt.ai_reasoning);
  if (!reasoning) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>AI reasoning is not available for this test.</Text>
      </View>
    );
  }
  const scenarioObservations = parseObject(reasoning.scenario_observations);
  const breakdown = parseObject(reasoning.construct_breakdown);
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
  onBack,
  onDeleteAccount,
  canDelete,
  deleting,
}: {
  userData: UserGroup;
  onBack: () => void;
  onDeleteAccount: () => void;
  canDelete: boolean;
  deleting: boolean;
}) {
  const attempts = getAttemptsSorted(userData.attempts);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(attempts[0]?.id ?? null);
  const [activeInnerTab, setActiveInnerTab] = useState<'summary' | 'reasoning' | 'transcript' | 'feedback'>('summary');

  useEffect(() => {
    if (!selectedAttemptId && attempts[0]?.id) setSelectedAttemptId(attempts[0].id);
  }, [selectedAttemptId, attempts]);

  const selectedAttempt = attempts.find((a) => a.id === selectedAttemptId) ?? attempts[0] ?? null;

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
        <Text style={styles.headerTitle}>{getUserDisplayName(userData.user)}</Text>
        <Text style={styles.headerSub}>{userData.user.email ?? '—'}</Text>
      </View>

      {attempts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No tests found for this user.</Text>
        </View>
      ) : (
        <View style={styles.detailsLayout}>
          <ScrollView style={styles.attemptTabsColumn}>
            {attempts.map((attempt) => (
              <TouchableOpacity
                key={attempt.id}
                style={[styles.attemptTab, selectedAttempt?.id === attempt.id && styles.attemptTabActive]}
                onPress={() => {
                  setSelectedAttemptId(attempt.id);
                  setActiveInnerTab('summary');
                }}
              >
                <Text style={styles.attemptTabLabel}>{formatAttemptTabLabel(attempt)}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.detailsPane}>
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

            {selectedAttempt && activeInnerTab === 'summary' && <SummaryTab attempt={selectedAttempt} />}
            {selectedAttempt && activeInnerTab === 'reasoning' && <ReasoningTab attempt={selectedAttempt} />}
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
}: {
  attemptId: string | null;
  userId?: string;
  showFeedbackTab?: boolean;
}) {
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeInnerTab, setActiveInnerTab] = useState<'summary' | 'reasoning' | 'transcript' | 'feedback'>('summary');

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

      {activeInnerTab === 'summary' && <SummaryTab attempt={attempt} />}
      {activeInnerTab === 'reasoning' && <ReasoningTab attempt={attempt} />}
      {activeInnerTab === 'transcript' && <TranscriptTab attempt={attempt} />}
      {showFeedbackTab && activeInnerTab === 'feedback' && <FeedbackTab attempt={attempt} />}
    </View>
  );
}

export function AdminInterviewDashboard({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserGroup | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const refreshUsers = useCallback(async () => {
    try {
      const data = await fetchAllAdminData();
      setUsers(data);
    } catch (err) {
      console.error('Admin panel fetch failed:', err);
      setUsers([]);
    }
  }, []);

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
        const data = await fetchAllAdminData();
        if (!cancelled) setUsers(data);
      } catch (err) {
        if (!cancelled) {
          console.error('Admin panel fetch failed:', err);
          setUsers([]);
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
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert(result.error);
          } else {
            Alert.alert('Delete failed', result.error);
          }
          return;
        }
        await refreshUsers();
        setSelectedUser((prev) => (prev?.user.id === row.id ? null : prev));
      } finally {
        setDeletingUserId(null);
      }
    },
    [canDeleteUser, refreshUsers],
  );

  if (selectedUser) {
    return (
      <UserDetails
        userData={selectedUser}
        onBack={() => setSelectedUser(null)}
        canDelete={canDeleteUser(selectedUser.user)}
        deleting={deletingUserId === selectedUser.user.id}
        onDeleteAccount={() => void handleDeleteUser(selectedUser.user)}
      />
    );
  }

  return (
    <View style={styles.fullScreen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Panel</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.backText}>← Back to interview</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.cardsContainer}>
        {loading ? (
          <Text style={styles.emptyText}>Loading users...</Text>
        ) : users.length === 0 ? (
          <Text style={styles.emptyText}>No users found.</Text>
        ) : (
          users.map((userData) => (
            <UserCard
              key={userData.user.id}
              userData={userData}
              onPress={() => setSelectedUser(userData)}
              canDelete={canDeleteUser(userData.user)}
              deleting={deletingUserId === userData.user.id}
              onDelete={() => void handleDeleteUser(userData.user)}
            />
          ))
        )}
      </ScrollView>
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
  backText: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  cardsContainer: {
    padding: 20,
    gap: 12,
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
  userCardEmail: {
    color: '#7A9ABE',
    fontSize: 12,
    marginTop: 2,
  },
  userCardMetaRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardStatus: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'lowercase',
  },
  userCardTests: {
    color: '#7A9ABE',
    fontSize: 12,
  },
  detailsLayout: {
    flex: 1,
    flexDirection: 'row',
  },
  attemptTabsColumn: {
    width: '25%',
    minWidth: 220,
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
  detailsPane: {
    flex: 1,
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
});
