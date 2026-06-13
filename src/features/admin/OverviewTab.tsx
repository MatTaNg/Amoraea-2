import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  Pressable,
} from 'react-native';
import { supabase } from '@data/supabase/client';
import {
  fetchCompatibilityTestSeedUserIds,
  isCompatibilityTestSeedUser,
} from '@features/compatibility/compatibilityTestSeedUser';
import {
  assignAlgorithmEra,
  aggregateMarketResearch,
  computeFullyCompletedCohortAnalytics,
  computeOverviewAnalytics,
  detectScoreRecovery,
  type AttemptRecord,
  type FullyCompletedCohortAnalytics,
  type MarketResearchAggregation,
  type OverviewAnalytics,
  type PillarStats,
  type CohortSegmentPillarDistribution,
  type UserRecord,
} from './analytics';
import { formatDurationMsHuman } from './adminAttemptTiming';

function Tooltip({ text }: { text: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <TouchableOpacity
        onPress={() => setVisible(true)}
        style={styles.tooltipTrigger}
        accessibilityRole="button"
        accessibilityLabel="Show help"
      >
        <Text style={styles.tooltipIcon}>?</Text>
      </TouchableOpacity>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.tooltipModalBackdrop} onPress={() => setVisible(false)}>
          <Pressable style={styles.tooltipModalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.tooltipModalText}>{text}</Text>
            <TouchableOpacity
              onPress={() => setVisible(false)}
              style={styles.tooltipModalDismiss}
              accessibilityRole="button"
            >
              <Text style={styles.tooltipModalDismissText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function Section({
  title,
  tooltip,
  children,
  defaultExpanded = true,
}: {
  title: string;
  tooltip?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.sectionHeader} onPress={() => setExpanded((v) => !v)}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.sectionHeaderRight}>
          {tooltip ? <Tooltip text={tooltip} /> : null}
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>
      {expanded ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function MetricRow({
  label,
  value,
  sublabel,
  color,
  tooltip,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
  tooltip?: string;
}) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabelRow}>
        <Text style={styles.metricLabel}>{label}</Text>
        {tooltip ? <Tooltip text={tooltip} /> : null}
      </View>
      <View>
        <Text style={[styles.metricValue, color ? { color } : null]}>{value}</Text>
        {sublabel ? <Text style={styles.metricSublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

function AlphaBadge({ alpha, label }: { alpha: number | null; label: string }) {
  if (alpha === null) {
    return (
      <View style={styles.alphaBadgeContainer}>
        <Text style={styles.alphaBadgeLabel}>{label}</Text>
        <View style={[styles.alphaBadge, { backgroundColor: '#222', borderColor: '#444' }]}>
          <Text style={[styles.alphaBadgeValue, { color: '#666' }]}>Insufficient data</Text>
        </View>
      </View>
    );
  }

  const color = alpha >= 0.8 ? '#22c55e' : alpha >= 0.7 ? '#f59e0b' : '#ef4444';
  const quality = alpha >= 0.8 ? 'Good' : alpha >= 0.7 ? 'Adequate' : 'Poor';

  return (
    <View style={styles.alphaBadgeContainer}>
      <Text style={styles.alphaBadgeLabel}>{label}</Text>
      <View style={[styles.alphaBadge, { borderColor: color, backgroundColor: `${color}18` }]}>
        <Text style={[styles.alphaBadgeValue, { color }]}>α = {alpha.toFixed(3)}</Text>
        <Text style={[styles.alphaBadgeSublabel, { color }]}>{quality}</Text>
      </View>
    </View>
  );
}

function MiniBar({ value, max, color = '#3b82f6' }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <View style={styles.miniBarTrack}>
      <View style={[styles.miniBarFill, { width: `${pct}%`, backgroundColor: color }]} />
    </View>
  );
}

function CorrelationBadge({ r, validating }: { r: number | null; validating: boolean | null }) {
  if (r === null) return <Text style={{ color: '#666', fontSize: 12 }}>n/a</Text>;
  const color = validating === null ? '#888' : validating ? '#22c55e' : '#ef4444';
  return (
    <Text style={{ color, fontSize: 13, fontWeight: '600' }}>
      r = {r > 0 ? '+' : ''}
      {r.toFixed(2)}
    </Text>
  );
}

function formatPillarLabel(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

const COHORT_PILLAR_DISPLAY_ORDER = [
  'mentalizing',
  'repair',
  'accountability',
  'attunement',
  'regulation',
  'appreciation',
  'contempt_recognition',
  'contempt_expression',
  'contempt',
  'commitment_threshold',
] as const;

function sortCohortPillarKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ai = COHORT_PILLAR_DISPLAY_ORDER.indexOf(a as (typeof COHORT_PILLAR_DISPLAY_ORDER)[number]);
    const bi = COHORT_PILLAR_DISPLAY_ORDER.indexOf(b as (typeof COHORT_PILLAR_DISPLAY_ORDER)[number]);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.localeCompare(b);
  });
}

function CohortSegmentPillarBlock({ segment }: { segment: CohortSegmentPillarDistribution }) {
  const pillarKeys = sortCohortPillarKeys(Object.keys(segment.pillars));

  return (
    <View style={styles.cohortSegmentBlock}>
      <Text style={styles.cohortSegmentTitle}>
        {segment.label}
        {segment.n > 0 ? ` · n=${segment.n}` : ''}
      </Text>
      {segment.n === 0 || pillarKeys.length === 0 ? (
        <Text style={styles.alphaNote}>No pillar scores in cohort</Text>
      ) : (
        pillarKeys.map((key) => {
          const stats = segment.pillars[key];
          return (
            <View key={key} style={styles.cohortPillarRow}>
              <Text style={styles.cohortPillarLabel} numberOfLines={2}>
                {formatPillarLabel(stats.name)}
              </Text>
              <View style={styles.cohortPillarBarWrap}>
                <MiniBar value={stats.mean} max={10} color="#6366f1" />
              </View>
              <Text style={styles.cohortPillarMean}>{stats.mean.toFixed(2)}</Text>
              <Text style={styles.cohortPillarMeta}>
                σ {stats.std.toFixed(2)} · {stats.min}–{stats.max}
              </Text>
            </View>
          );
        })
      )}
    </View>
  );
}

function PillarCard({ stats, onExpand }: { stats: PillarStats; onExpand: () => void }) {
  const label = stats.name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <TouchableOpacity style={styles.pillarCard} onPress={onExpand}>
      <View style={styles.pillarCardHeader}>
        <Text style={styles.pillarCardName}>{label}</Text>
        {stats.lowVarianceWarning ? <Text style={styles.lowVarianceFlag}>⚠ Low variance</Text> : null}
      </View>
      <View style={styles.pillarCardStats}>
        <Text style={styles.pillarStatItem}>
          Mean <Text style={styles.pillarStatValue}>{stats.mean}</Text>
        </Text>
        <Text style={styles.pillarStatItem}>
          SD <Text style={styles.pillarStatValue}>{stats.std}</Text>
        </Text>
        <Text style={styles.pillarStatItem}>
          Range{' '}
          <Text style={styles.pillarStatValue}>
            {stats.min}–{stats.max}
          </Text>
        </Text>
      </View>
      <MiniBar value={stats.mean} max={10} color={stats.lowVarianceWarning ? '#f59e0b' : '#3b82f6'} />
    </TouchableOpacity>
  );
}

function isMissingUsersColumnError(error: { message?: string; code?: string }, column: string): boolean {
  const msg = String(error.message ?? '');
  return (
    String(error.code) === 'PGRST204' ||
    (msg.includes(column) && (msg.includes('does not exist') || msg.includes('schema cache')))
  );
}

const USER_OVERVIEW_SELECT_WITH_BRS = `
  id, email, full_name, display_name,
  interview_completed, interview_completed_at,
  psychometrics_completed_at,
  psychometrics_aaq2_score, psychometrics_rses_score,
  psychometrics_brs_score,
  psychometrics_scs_public_score, psychometrics_scs_private_score,
  psychometrics_anxiety_trait_score, psychometrics_scs_sf_score,
  psychometrics_gasp_score, psychometrics_dweck_score,
  psychometrics_mspss_score, psychometrics_sd3_narcissism_score,
  psychometrics_rfq_score,
  psychometric_modifier,
  market_research_completed_at,
  market_research_referral_source, market_research_referral_other,
  market_research_relationship_seriousness, market_research_search_duration,
  market_research_dating_status, market_research_max_spend,
  market_research_spend_context
`;

const USER_OVERVIEW_SELECT_WITHOUT_BRS = `
  id, email, full_name, display_name,
  interview_completed, interview_completed_at,
  psychometrics_completed_at,
  psychometrics_aaq2_score, psychometrics_rses_score,
  psychometrics_scs_public_score, psychometrics_scs_private_score,
  psychometrics_anxiety_trait_score, psychometrics_scs_sf_score,
  psychometrics_gasp_score, psychometrics_dweck_score,
  psychometrics_mspss_score, psychometrics_sd3_narcissism_score,
  psychometrics_rfq_score,
  psychometric_modifier,
  market_research_completed_at,
  market_research_referral_source, market_research_referral_other,
  market_research_relationship_seriousness, market_research_search_duration,
  market_research_dating_status, market_research_max_spend,
  market_research_spend_context
`;

async function fetchUsersForOverview(userIds: string[]): Promise<UserRecord[]> {
  const idSet = new Set(userIds);
  if (idSet.size === 0) return [];

  // Single list query — avoids 400s from oversized `.in(...)` GET URLs with many UUIDs.
  let result = await supabase.from('users').select(USER_OVERVIEW_SELECT_WITH_BRS);
  if (result.error && isMissingUsersColumnError(result.error, 'psychometrics_brs_score')) {
    result = await supabase.from('users').select(USER_OVERVIEW_SELECT_WITHOUT_BRS);
  }

  if (result.error) {
    throw new Error(result.error.message ?? 'Failed to load users for overview');
  }

  return ((result.data ?? []) as Omit<UserRecord, 'psychometrics_brs_score'>[]).map((u) => ({
    ...u,
    psychometrics_brs_score:
      'psychometrics_brs_score' in u
        ? ((u as UserRecord).psychometrics_brs_score ?? null)
        : null,
  })).filter((u) => idSet.has(u.id));
}

async function fetchAllUsersForMarketResearch(): Promise<UserRecord[]> {
  const select = `
    id, email, full_name, display_name,
    market_research_completed_at,
    market_research_referral_source, market_research_referral_other,
    market_research_relationship_seriousness, market_research_search_duration,
    market_research_dating_status, market_research_max_spend,
    market_research_spend_context
  `;
  const { data, error } = await supabase
    .from('users')
    .select(select)
    .not('market_research_completed_at', 'is', null);

  if (error) {
    console.warn('[Overview] market research users fetch failed:', error.message);
    return [];
  }

  return (data ?? []) as UserRecord[];
}

async function fetchOccupationsForUsers(userIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (userIds.length === 0) return map;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, profile_json')
    .in('id', userIds);

  if (error) {
    console.warn('[Overview] profiles occupation fetch failed:', error.message);
    return map;
  }

  for (const row of data ?? []) {
    const userId = String((row as { id: string }).id);
    const json = (row as { profile_json: unknown }).profile_json;
    const occupation =
      json && typeof json === 'object' && !Array.isArray(json)
        ? (json as Record<string, unknown>).occupation
        : null;
    if (typeof occupation === 'string' && occupation.trim()) {
      map.set(userId, occupation.trim());
    }
  }
  return map;
}

function formatScore(value: number | null): string {
  return value != null ? value.toFixed(2) : '—';
}

function MarketResearchQuestionBlock({
  question,
}: {
  question: MarketResearchAggregation['questions'][number];
}) {
  const [expanded, setExpanded] = useState(false);
  const showExpand =
    question.type === 'text' && (question.textResponses?.length ?? 0) > 8;

  return (
    <View style={styles.marketQuestionBlock}>
      <Text style={styles.marketQuestionLabel}>{question.label}</Text>
      <Text style={styles.marketQuestionMeta}>
        {question.totalAnswered} response{question.totalAnswered === 1 ? '' : 's'}
      </Text>
      {question.type === 'choice' && question.options
        ? question.options.map((opt) => (
            <View key={opt.value} style={styles.marketOptionRow}>
              <Text style={styles.marketOptionLabel} numberOfLines={2}>
                {opt.value}
              </Text>
              <MiniBar value={opt.count} max={question.totalAnswered || 1} color="#8b5cf6" />
              <Text style={styles.marketOptionCount}>
                {opt.count} ({opt.percentage}%)
              </Text>
            </View>
          ))
        : null}
      {question.type === 'text' && question.textResponses
        ? (() => {
            const items = showExpand && !expanded
              ? question.textResponses!.slice(0, 8)
              : question.textResponses!;
            return (
              <>
                {items.map((text, i) => (
                  <Text key={`${question.id}-${i}`} style={styles.marketTextResponse}>
                    · {text}
                  </Text>
                ))}
                {showExpand ? (
                  <TouchableOpacity
                    style={styles.toggleButton}
                    onPress={() => setExpanded((v) => !v)}
                  >
                    <Text style={styles.toggleButtonText}>
                      {expanded
                        ? 'Show fewer'
                        : `Show all ${question.textResponses!.length} responses`}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </>
            );
          })()
        : null}
    </View>
  );
}

export function OverviewTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<OverviewAnalytics | null>(null);
  const [cohortAnalytics, setCohortAnalytics] = useState<FullyCompletedCohortAnalytics | null>(null);
  const [marketResearch, setMarketResearch] = useState<MarketResearchAggregation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [showAllUsers, setShowAllUsers] = useState(false);
  const [showFlippedOnly, setShowFlippedOnly] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data: attemptsRaw, error: aErr } = await supabase
        .from('interview_attempts')
        .select(
          `
          id, user_id, created_at, completed_at,
          weighted_score, modified_weighted_score,
          modified_weighted_score_with_psychometrics,
          passed, final_gate_pass,
          pillar_scores, scenario_1_scores, scenario_2_scores, scenario_3_scores,
          scenario_composites, scenario_specific_patterns,
          response_timings,
          depth_signal_modifier, score_modifier,
          ego_development_level, disclosure_calibration,
          moment_4_concreteness, moment_5_concreteness,
          personal_moment_emotional_vocab_density, mentalizing_overcertainty_count,
          defense_patterns, emotion_recognition_raw_score,
          gate_fail_reasons, review_flags, reasoning_pending,
          uncertainty_score, uncertainty_breakdown
        `,
        )
        .not('completed_at', 'is', null)
        .order('created_at', { ascending: true });

      if (aErr) throw aErr;

      const seedUserIds = await fetchCompatibilityTestSeedUserIds(supabase);
      const attemptsFiltered = (attemptsRaw ?? []).filter(
        (a) => !seedUserIds.has(String((a as { user_id: string }).user_id)),
      );

      const userIds = [...new Set(attemptsFiltered.map((a) => a.user_id as string))];
      const usersRaw = (await fetchUsersForOverview(userIds)).filter(
        (u) => !isCompatibilityTestSeedUser({ id: u.id, email: u.email }, seedUserIds),
      );

      const attempts: AttemptRecord[] = attemptsFiltered.map((a) => {
        const row = a as Record<string, unknown>;
        return {
          id: row.id as string,
          user_id: row.user_id as string,
          created_at: row.created_at as string,
          completed_at: (row.completed_at as string | null) ?? null,
          weighted_score: row.weighted_score as number | null,
          modified_weighted_score: row.modified_weighted_score as number | null,
          modified_weighted_score_with_psychometrics:
            row.modified_weighted_score_with_psychometrics as number | null,
          response_timings: row.response_timings as AttemptRecord['response_timings'],
          scenario_specific_patterns: row.scenario_specific_patterns as Record<string, unknown> | null,
          passed: row.passed as boolean | null,
          final_gate_pass: row.final_gate_pass as boolean | null,
          pillar_scores: row.pillar_scores as Record<string, number> | null,
          scenario_1_scores: row.scenario_1_scores as Record<string, unknown> | null,
          scenario_2_scores: row.scenario_2_scores as Record<string, unknown> | null,
          scenario_3_scores: row.scenario_3_scores as Record<string, unknown> | null,
          scenario_composites: row.scenario_composites as Record<string, number> | null,
          depth_signal_modifier: row.depth_signal_modifier as number | null,
          score_modifier: row.score_modifier as number | null,
          ego_development_level: row.ego_development_level as number | null,
          disclosure_calibration: row.disclosure_calibration as string | null,
          moment_4_concreteness: row.moment_4_concreteness as string | null,
          moment_5_concreteness: row.moment_5_concreteness as string | null,
          personal_moment_emotional_vocab_density:
            row.personal_moment_emotional_vocab_density as number | null,
          mentalizing_overcertainty_count: row.mentalizing_overcertainty_count as number | null,
          defense_patterns: row.defense_patterns as Record<string, boolean> | null,
          emotion_recognition_raw_score: row.emotion_recognition_raw_score as number | null,
          gate_fail_reasons: Array.isArray(row.gate_fail_reasons)
            ? (row.gate_fail_reasons as string[])
            : null,
          review_flags: Array.isArray(row.review_flags) ? (row.review_flags as string[]) : null,
          reasoning_pending: row.reasoning_pending as boolean | null,
          uncertainty_score: row.uncertainty_score as number | null,
          uncertainty_breakdown: row.uncertainty_breakdown as { activeFlags?: string[] } | null,
          scenario_1_recovered: detectScoreRecovery(
            row.scenario_1_scores as Record<string, unknown> | null,
          ),
          scenario_2_recovered: detectScoreRecovery(
            row.scenario_2_scores as Record<string, unknown> | null,
          ),
          scenario_3_recovered: detectScoreRecovery(
            row.scenario_3_scores as Record<string, unknown> | null,
          ),
          algorithm_era: assignAlgorithmEra(row.created_at as string),
        };
      });

      const result = computeOverviewAnalytics(attempts, usersRaw);
      const cohort = computeFullyCompletedCohortAnalytics(attempts, usersRaw);

      const marketResearchUsers = await fetchAllUsersForMarketResearch();
      const marketResearchUserIds = marketResearchUsers.map((u) => u.id);
      const occupations = await fetchOccupationsForUsers(marketResearchUserIds);
      const market = aggregateMarketResearch(marketResearchUsers, occupations);

      setAnalytics(result);
      setCohortAnalytics(cohort);
      setMarketResearch(market);
      setError(null);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load analytics';
      console.error('[Overview] load failed:', message);
      setError(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#fff" size="large" />
        <Text style={styles.loadingText}>Computing analytics across all attempts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity onPress={() => void load()} style={styles.retryButton}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!analytics) return null;

  const a = analytics;
  const displayedUsers = showAllUsers ? a.userDrilldown : a.userDrilldown.slice(0, 10);

  const modifierRows = showFlippedOnly
    ? a.thresholdAnalysis.modifierImpactSummary.filter((r) => r.flipped)
    : a.thresholdAnalysis.modifierImpactSummary.slice(0, 15);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor="#fff"
        />
      }
    >
      <Text style={styles.pageTitle}>Assessment Battery Overview</Text>
      <Text style={styles.pageSubtitle}>Pull down to refresh · Tap any section to collapse</Text>

      {cohortAnalytics ? (
        <Section
          title="Fully Completed Cohort Averages"
          tooltip="Users who finished the AI interview (interview_completed) and the psychometric battery (psychometrics_completed_at). One latest attempt per user. Interview time prefers active engagement from response_timings; psychometric and total times use wall clock."
        >
          <MetricRow
            label="Cohort size"
            value={`${cohortAnalytics.cohortSize} users`}
          />
          {cohortAnalytics.cohortSize === 0 ? (
            <Text style={styles.alphaNote}>
              No users have completed both the AI interview and psychometrics yet.
            </Text>
          ) : (
            <>
              <Text style={styles.subSectionTitle}>Interview scores</Text>
              <MetricRow
                label="Weighted score"
                value={formatScore(cohortAnalytics.scoreAverages.weightedScore)}
              />
              <MetricRow
                label="Modified weighted score"
                value={formatScore(cohortAnalytics.scoreAverages.modifiedWeightedScore)}
              />
              <MetricRow
                label="Modified weighted (with psychometrics)"
                value={formatScore(cohortAnalytics.scoreAverages.modifiedWeightedWithPsychometrics)}
              />
              <MetricRow
                label="Scenario 1 composite"
                value={formatScore(cohortAnalytics.scoreAverages.scenario1)}
              />
              <MetricRow
                label="Scenario 2 composite"
                value={formatScore(cohortAnalytics.scoreAverages.scenario2)}
              />
              <MetricRow
                label="Scenario 3 composite"
                value={formatScore(cohortAnalytics.scoreAverages.scenario3)}
              />
              <MetricRow
                label="Moment 4 composite"
                value={formatScore(cohortAnalytics.scoreAverages.moment4)}
              />
              <MetricRow
                label="Moment 5 composite"
                value={formatScore(cohortAnalytics.scoreAverages.moment5)}
              />

              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>
                Pillar scores by scenario & moment
              </Text>
              {cohortAnalytics.segmentPillarDistributions.map((segment) => (
                <CohortSegmentPillarBlock key={segment.key} segment={segment} />
              ))}

              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Psychometric scores</Text>
              {cohortAnalytics.scoreAverages.psychometricScores
                .filter((p) => p.n > 0)
                .map((p) => (
                  <MetricRow
                    key={p.key}
                    label={p.label}
                    value={p.average != null ? p.average.toFixed(2) : '—'}
                    sublabel={`n=${p.n}`}
                  />
                ))}

              <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Average time</Text>
              <MetricRow
                label="AI interview"
                value={formatDurationMsHuman(cohortAnalytics.timingAverages.interviewMs)}
                sublabel={`n=${cohortAnalytics.timingAverages.interviewN}`}
              />
              <MetricRow
                label="Psychometric battery"
                value={formatDurationMsHuman(cohortAnalytics.timingAverages.psychometricMs)}
                sublabel={`n=${cohortAnalytics.timingAverages.psychometricN} · after interview`}
              />
              <MetricRow
                label="Total process"
                value={formatDurationMsHuman(cohortAnalytics.timingAverages.totalProcessMs)}
                sublabel={`n=${cohortAnalytics.timingAverages.totalProcessN} · interview start → psychometrics complete`}
              />
            </>
          )}
        </Section>
      ) : null}

      {marketResearch ? (
        <Section
          title="Market Research Responses"
          tooltip="Aggregated answers from the pre-interview market research modal across all users who completed it."
          defaultExpanded={marketResearch.totalResponses > 0}
        >
          <MetricRow
            label="Total respondents"
            value={`${marketResearch.totalResponses}`}
          />
          {marketResearch.totalResponses === 0 ? (
            <Text style={styles.alphaNote}>No market research responses recorded yet.</Text>
          ) : (
            marketResearch.questions.map((q) => (
              <MarketResearchQuestionBlock key={q.id} question={q} />
            ))
          )}
        </Section>
      ) : null}

      <Section
        title="Sample Summary"
        tooltip="Total completed attempts and breakdown by pass/fail status, data completeness, and assessment coverage."
      >
        <View style={styles.metricsGrid}>
          <MetricRow label="Total completed" value={`${a.sampleSize.total}`} />
          <MetricRow
            label="Pass rate"
            value={`${a.sampleSize.passRate}%`}
            sublabel={`${a.sampleSize.passed} passed · ${a.sampleSize.failed} failed`}
            color={a.sampleSize.passRate > 85 ? '#f59e0b' : '#22c55e'}
            tooltip="Pass rates above 85% may indicate the threshold is too low or user self-selection is strong."
          />
          <MetricRow
            label="With depth signals"
            value={`${a.sampleSize.withDepthSignals} / ${a.sampleSize.total}`}
            sublabel={
              a.sampleSize.total > 0
                ? `${Math.round((a.sampleSize.withDepthSignals / a.sampleSize.total) * 100)}% coverage`
                : undefined
            }
          />
          <MetricRow
            label="With psychometrics"
            value={`${a.sampleSize.withPsychometrics} / ${a.sampleSize.total}`}
          />
          <MetricRow
            label="Score recovery flags"
            value={`${a.sampleSize.withScoreRecovery} attempts`}
            color={
              a.sampleSize.total > 0 && a.sampleSize.withScoreRecovery > a.sampleSize.total * 0.3
                ? '#ef4444'
                : '#aaa'
            }
            tooltip="Attempts where at least one scenario used fallback score recovery rather than structured scoring."
          />
        </View>
      </Section>

      <Section
        title="Uncertainty distribution"
        tooltip="Adaptive uncertainty scores (0–1) computed at interview completion. Green &lt; 0.4, amber 0.4–0.6, red ≥ 0.6. Admin-only — does not affect user routing."
      >
        <View style={styles.metricsGrid}>
          <MetricRow
            label="Low uncertainty"
            value={`${a.uncertaintyDistribution.green} (${a.uncertaintyDistribution.greenPct}%)`}
            color="#22c55e"
          />
          <MetricRow
            label="Moderate uncertainty"
            value={`${a.uncertaintyDistribution.amber} (${a.uncertaintyDistribution.amberPct}%)`}
            color="#f59e0b"
          />
          <MetricRow
            label="High uncertainty"
            value={`${a.uncertaintyDistribution.red} (${a.uncertaintyDistribution.redPct}%)`}
            color="#ef4444"
          />
          <MetricRow
            label="Average uncertainty"
            value={
              a.uncertaintyDistribution.averageScore != null
                ? a.uncertaintyDistribution.averageScore.toFixed(2)
                : '—'
            }
          />
        </View>
        {a.uncertaintyDistribution.commonFlags.length > 0 ? (
          <>
            <Text style={styles.subSectionTitle}>Most common active flags</Text>
            {a.uncertaintyDistribution.commonFlags.map(({ flag, count }) => (
              <MetricRow key={flag} label={flag} value={`${count} attempts`} />
            ))}
          </>
        ) : null}
        {a.uncertaintyDistribution.trendByEra.length >= 2 ? (
          <>
            <Text style={styles.subSectionTitle}>Average uncertainty by algorithm era</Text>
            {a.uncertaintyDistribution.trendByEra.map((row) => (
              <MetricRow
                key={row.era}
                label={row.era}
                value={`${row.averageScore.toFixed(2)} (n=${row.count})`}
              />
            ))}
          </>
        ) : null}
      </Section>

      <Section
        title="Internal Consistency (Cronbach's α)"
        tooltip="Alpha measures how consistently the items in your assessment measure the same underlying construct. Targets: 0.80+ good, 0.70–0.79 adequate, below 0.70 poor. Minimum 30 attempts needed for a stable estimate."
      >
        {!a.cronbachAlpha.sufficient ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠ {a.sampleSize.total} of {a.cronbachAlpha.minimumNeeded} attempts needed for stable
              alpha estimate
            </Text>
          </View>
        ) : null}
        <View style={styles.alphaRow}>
          <AlphaBadge alpha={a.cronbachAlpha.pillars} label="Across 8 pillars" />
          <AlphaBadge alpha={a.cronbachAlpha.scenarios} label="Across 3 scenarios" />
        </View>
        <Text style={styles.alphaNote}>
          Target range for a multi-dimensional assessment: 0.75–0.88. Very high alpha (0.95+) may
          indicate pillar redundancy rather than coherence.
        </Text>
      </Section>

      <Section
        title="Pillar Score Distributions"
        tooltip="Mean, standard deviation, and range for each pillar across all completed attempts. Low variance warnings indicate a pillar may not be differentiating well between users."
      >
        <View style={styles.pillarGrid}>
          {Object.values(a.pillarDistributions).map((stats) => (
            <PillarCard
              key={stats.name}
              stats={stats}
              onExpand={() =>
                setExpandedPillar(expandedPillar === stats.name ? null : stats.name)
              }
            />
          ))}
        </View>

        {expandedPillar && a.pillarDistributions[expandedPillar]
          ? (() => {
              const stats = a.pillarDistributions[expandedPillar];
              const maxCount = Math.max(...Object.values(stats.distribution), 1);
              return (
                <View style={styles.expandedPillar}>
                  <Text style={styles.expandedPillarTitle}>
                    {expandedPillar.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} —
                    Score Distribution
                  </Text>
                  {Object.entries(stats.distribution).map(([score, count]) => (
                    <View key={score} style={styles.distRow}>
                      <Text style={styles.distLabel}>{score}</Text>
                      <MiniBar value={count} max={maxCount} color="#3b82f6" />
                      <Text style={styles.distCount}>{count}</Text>
                    </View>
                  ))}
                  {stats.lowVarianceWarning ? (
                    <Text style={styles.lowVarianceNote}>
                      ⚠ Low variance (σ² = {stats.variance}) — this pillar is not differentiating well
                      between users. Consider reviewing the scoring criteria.
                    </Text>
                  ) : null}
                </View>
              );
            })()
          : null}
      </Section>

      <Section
        title="Scenario Cross-Correlations"
        tooltip="Pearson correlation between scenario composite scores. Target: 0.40–0.70. Too low means scenarios measure unrelated things. Too high means scenarios are redundant."
        defaultExpanded={false}
      >
        {[
          { label: 'Scenario 1 × Scenario 2', value: a.scenarioCorrelations.s1s2 },
          { label: 'Scenario 1 × Scenario 3', value: a.scenarioCorrelations.s1s3 },
          { label: 'Scenario 2 × Scenario 3', value: a.scenarioCorrelations.s2s3 },
        ].map(({ label, value }) => {
          const color =
            value === null
              ? '#666'
              : value >= 0.4 && value <= 0.7
                ? '#22c55e'
                : value < 0.2
                  ? '#ef4444'
                  : '#f59e0b';
          const interp =
            value === null
              ? 'Insufficient data'
              : value >= 0.4 && value <= 0.7
                ? 'Good — scenarios are related but distinct'
                : value < 0.2
                  ? 'Too low — scenarios may be measuring unrelated constructs'
                  : value > 0.7
                    ? 'Too high — scenarios may be redundant'
                    : 'Borderline — monitor as sample grows';
          return (
            <View key={label} style={styles.correlationRow}>
              <Text style={styles.correlationLabel}>{label}</Text>
              <View>
                <Text style={[styles.correlationValue, { color }]}>
                  {value !== null ? `r = ${value > 0 ? '+' : ''}${value.toFixed(3)}` : 'n/a'}
                </Text>
                <Text style={[styles.correlationInterp, { color }]}>{interp}</Text>
              </View>
            </View>
          );
        })}
      </Section>

      <Section
        title="Score Distribution & Threshold Analysis"
        tooltip="Distribution of weighted scores across all attempts. The 6.0 threshold is shown. Borderline zone is 5.5–6.5. Modifier impact shows how many gate decisions would change if depth signal modifiers were applied."
      >
        {a.thresholdAnalysis.scoreDistribution.map((bucket) => (
          <View key={bucket.range} style={styles.bucketRow}>
            <Text
              style={[
                styles.bucketLabel,
                (bucket.range === '5.5–5.9' || bucket.range === '6.0–6.4') &&
                  styles.bucketLabelHighlight,
              ]}
            >
              {bucket.range}
              {bucket.range === '5.5–5.9' ? ' ←threshold' : ''}
              {bucket.range === '6.0–6.4' ? ' threshold→' : ''}
            </Text>
            <MiniBar
              value={bucket.count}
              max={a.sampleSize.total}
              color={
                bucket.range.startsWith('5.5') || bucket.range.startsWith('6.0')
                  ? '#f59e0b'
                  : '#3b82f6'
              }
            />
            <Text style={styles.bucketCount}>
              {bucket.count} ({bucket.percentage}%)
            </Text>
          </View>
        ))}

        <View style={styles.divider} />
        <MetricRow
          label="Borderline cases (5.5–6.5)"
          value={`${a.thresholdAnalysis.borderlineCount} attempts`}
          tooltip="These users' gate decisions are most sensitive to algorithm changes."
        />
        <MetricRow
          label="Decisions flipped by modifier"
          value={`${a.thresholdAnalysis.wouldFlipWithModifier}`}
          color={a.thresholdAnalysis.wouldFlipWithModifier > 0 ? '#f59e0b' : '#22c55e'}
          tooltip="Attempts where applying the depth signal modifier would change the pass/fail outcome."
        />

        {a.thresholdAnalysis.wouldFlipWithModifier > 0 ? (
          <>
            <TouchableOpacity
              style={styles.toggleButton}
              onPress={() => setShowFlippedOnly((v) => !v)}
            >
              <Text style={styles.toggleButtonText}>
                {showFlippedOnly ? 'Show all' : 'Show flipped only'}
              </Text>
            </TouchableOpacity>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableCell, { flex: 2 }]}>User</Text>
              <Text style={styles.tableCell}>Base</Text>
              <Text style={styles.tableCell}>Modified</Text>
              <Text style={styles.tableCell}>Flip</Text>
            </View>
            {modifierRows.map((row) => (
              <View
                key={row.attemptId}
                style={[styles.tableRow, row.flipped && styles.tableRowHighlight]}
              >
                <Text style={[styles.tableCell, { flex: 2, color: '#ccc' }]}>
                  {row.userName ?? 'Unknown'}
                </Text>
                <Text style={[styles.tableCell, { color: row.basePass ? '#22c55e' : '#ef4444' }]}>
                  {row.baseScore.toFixed(2)}
                </Text>
                <Text
                  style={[styles.tableCell, { color: row.modifiedPass ? '#22c55e' : '#ef4444' }]}
                >
                  {row.modifiedScore.toFixed(2)}
                </Text>
                <Text style={[styles.tableCell, { color: row.flipped ? '#f59e0b' : '#444' }]}>
                  {row.flipped ? '⚠ YES' : '—'}
                </Text>
              </View>
            ))}
          </>
        ) : null}
      </Section>

      <Section
        title="Algorithm Version Drift"
        tooltip="Compares alpha and pass rates across algorithm eras to detect whether scoring changes have materially affected results. Alpha drift > 0.10 between eras suggests scores may not be comparable across versions."
        defaultExpanded={false}
      >
        {a.algorithmVersionAnalysis.alphaDrift ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠ Alpha drift detected across algorithm eras — scores may not be fully comparable.
              Consider backfilling all attempts with the current algorithm before computing
              battery-level statistics.
            </Text>
          </View>
        ) : null}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 1.5 }]}>Era</Text>
          <Text style={styles.tableCell}>N</Text>
          <Text style={styles.tableCell}>α</Text>
          <Text style={styles.tableCell}>Mean</Text>
          <Text style={styles.tableCell}>Pass%</Text>
        </View>
        {a.algorithmVersionAnalysis.eras
          .filter((e) => e.count > 0)
          .map((era) => (
            <View key={era.era} style={styles.tableRow}>
              <Text
                style={[
                  styles.tableCell,
                  { flex: 1.5, color: '#ccc', textTransform: 'capitalize' },
                ]}
              >
                {era.era}
              </Text>
              <Text style={styles.tableCell}>{era.count}</Text>
              <Text style={styles.tableCell}>
                {era.alpha !== null ? era.alpha.toFixed(3) : '—'}
              </Text>
              <Text style={styles.tableCell}>{era.meanScore}</Text>
              <Text style={styles.tableCell}>{era.passRate}%</Text>
            </View>
          ))}
      </Section>

      <Section
        title="Score Recovery Artifact"
        tooltip="Attempts where scoring failed and a fallback recovery was used. High recovery rates may indicate scoring pipeline instability."
        defaultExpanded={false}
      >
        <MetricRow
          label="Attempts with recovery"
          value={`${a.scoreRecoveryAnalysis.totalRecoveredAttempts} (${a.scoreRecoveryAnalysis.recoveryRate}%)`}
          color={a.scoreRecoveryAnalysis.recoveryRate > 30 ? '#ef4444' : '#aaa'}
        />
        <View style={styles.alphaRow}>
          <AlphaBadge
            alpha={a.scoreRecoveryAnalysis.alphaWithRecovery}
            label="Recovery attempts"
          />
          <AlphaBadge
            alpha={a.scoreRecoveryAnalysis.alphaWithoutRecovery}
            label="Clean attempts"
          />
        </View>
        {a.scoreRecoveryAnalysis.alphaWithRecovery !== null &&
        a.scoreRecoveryAnalysis.alphaWithoutRecovery !== null ? (
          Math.abs(
            a.scoreRecoveryAnalysis.alphaWithRecovery - a.scoreRecoveryAnalysis.alphaWithoutRecovery,
          ) > 0.05 ? (
            <Text style={styles.lowVarianceNote}>
              ⚠ Alpha difference of{' '}
              {Math.abs(
                a.scoreRecoveryAnalysis.alphaWithRecovery -
                  a.scoreRecoveryAnalysis.alphaWithoutRecovery,
              ).toFixed(3)}{' '}
              between recovery and clean attempts suggests score recovery is introducing reliability
              variance.
            </Text>
          ) : (
            <Text style={[styles.alphaNote, { color: '#22c55e' }]}>
              ✓ Alpha is consistent between recovery and clean attempts.
            </Text>
          )
        ) : null}
      </Section>

      <Section
        title="Depth Signal Distribution"
        tooltip="Population-level distribution of depth signals across all attempts with populated depth signal data."
        defaultExpanded={false}
      >
        <Text style={styles.subSectionTitle}>Ego Development Level</Text>
        {Object.entries(a.depthSignalSummary.egoDistribution)
          .filter(([k]) => k !== 'null')
          .map(([level, count]) => (
            <View key={level} style={styles.distRow}>
              <Text style={styles.distLabel}>Level {level}</Text>
              <MiniBar value={count} max={a.sampleSize.total} color="#8b5cf6" />
              <Text style={styles.distCount}>{count}</Text>
            </View>
          ))}

        <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Defense Patterns Detected</Text>
        {Object.entries(a.depthSignalSummary.defensePatternRates).map(([pattern, count]) => (
          <View key={pattern} style={styles.distRow}>
            <Text style={styles.distLabel}>{pattern}</Text>
            <MiniBar value={count} max={a.sampleSize.total} color="#f59e0b" />
            <Text style={styles.distCount}>{count}</Text>
          </View>
        ))}

        <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>Modifier Distribution</Text>
        <MetricRow
          label="Average depth modifier"
          value={`${a.depthSignalSummary.avgModifier > 0 ? '+' : ''}${a.depthSignalSummary.avgModifier}`}
        />
        {a.depthSignalSummary.modifierDistribution.map((b) => (
          <View key={b.range} style={styles.distRow}>
            <Text style={styles.distLabel}>{b.range}</Text>
            <MiniBar
              value={b.count}
              max={a.sampleSize.total}
              color={b.range.startsWith('-') ? '#ef4444' : '#22c55e'}
            />
            <Text style={styles.distCount}>{b.count}</Text>
          </View>
        ))}
      </Section>

      <Section
        title="Convergent Validity"
        tooltip="Correlations between interview pillar scores and psychometric instrument scores."
        defaultExpanded={false}
      >
        {!a.convergentValidity.sufficient ? (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠ Fewer than 5 users have completed both the interview and psychometric assessments.
              Deploy psychometrics to real users to enable validity analysis.
            </Text>
          </View>
        ) : null}
        {a.convergentValidity.correlations.map((corr, i) => (
          <View key={`${corr.pillar}-${corr.psychometric}-${i}`} style={styles.validityRow}>
            <View style={styles.validityHeader}>
              <Text style={styles.validityPillar}>
                {corr.pillar.replace(/_/g, ' ')} ↔ {corr.psychometric}
              </Text>
              <View style={styles.validityRight}>
                <CorrelationBadge r={corr.correlation} validating={corr.validating} />
                <Text style={styles.validityN}>n={corr.n}</Text>
              </View>
            </View>
            <Text style={styles.validityInterp}>{corr.interpretation}</Text>
            {corr.validating === false && corr.correlation !== null ? (
              <Text style={styles.validityWarning}>
                ⚠ Correlation does not validate expected direction — review scoring or instrument
                selection
              </Text>
            ) : null}
          </View>
        ))}
      </Section>

      <Section
        title="All Users"
        tooltip="All completed attempts sorted by weighted score. R = score recovery, D = depth signals, P = psychometrics complete."
        defaultExpanded={false}
      >
        <View style={styles.tableHeader}>
          <Text style={[styles.tableCell, { flex: 2 }]}>User</Text>
          <Text style={styles.tableCell}>Score</Text>
          <Text style={styles.tableCell}>Mod</Text>
          <Text style={styles.tableCell}>Result</Text>
          <Text style={styles.tableCell}>Flags</Text>
        </View>

        {displayedUsers.map((row) => (
          <View key={row.attemptId}>
            <TouchableOpacity
              style={[
                styles.tableRow,
                expandedUser === row.attemptId && styles.tableRowExpanded,
              ]}
              onPress={() =>
                setExpandedUser(expandedUser === row.attemptId ? null : row.attemptId)
              }
            >
              <Text style={[styles.tableCell, { flex: 2, color: '#ccc' }]}>
                {row.userName ?? 'Unknown'}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  { color: (row.weightedScore ?? 0) >= 6 ? '#22c55e' : '#ef4444' },
                ]}
              >
                {row.weightedScore?.toFixed(2) ?? '—'}
              </Text>
              <Text
                style={[
                  styles.tableCell,
                  {
                    color:
                      row.depthModifier == null
                        ? '#444'
                        : row.depthModifier > 0
                          ? '#22c55e'
                          : '#ef4444',
                  },
                ]}
              >
                {row.depthModifier != null
                  ? `${row.depthModifier > 0 ? '+' : ''}${row.depthModifier.toFixed(2)}`
                  : '—'}
              </Text>
              <Text style={[styles.tableCell, { color: row.passed ? '#22c55e' : '#ef4444' }]}>
                {row.passed ? 'PASS' : 'FAIL'}
              </Text>
              <Text style={[styles.tableCell, { color: '#888', fontSize: 10 }]}>
                {row.hasRecovery ? 'R' : '·'}
                {row.egoLevel !== null ? 'D' : '·'}
                {row.hasPsychometrics ? 'P' : '·'}
              </Text>
            </TouchableOpacity>

            {expandedUser === row.attemptId ? (
              <View style={styles.userExpanded}>
                <Text style={styles.userExpandedRow}>Attempt ID: {row.attemptId}</Text>
                <Text style={styles.userExpandedRow}>Algorithm era: {row.algorithmEra}</Text>
                <Text style={styles.userExpandedRow}>
                  Ego development: {row.egoLevel ?? 'not assessed'}
                </Text>
                <Text style={styles.userExpandedRow}>
                  Modified score: {row.modifiedScore?.toFixed(2) ?? 'not computed'}
                </Text>
                <Text style={styles.userExpandedRow}>
                  Score recovery: {row.hasRecovery ? '⚠ Yes' : '✓ No'}
                </Text>
                <Text style={styles.userExpandedRow}>
                  Psychometrics: {row.hasPsychometrics ? '✓ Complete' : 'Not yet completed'}
                </Text>
              </View>
            ) : null}
          </View>
        ))}

        {a.userDrilldown.length > 10 ? (
          <TouchableOpacity style={styles.toggleButton} onPress={() => setShowAllUsers((v) => !v)}>
            <Text style={styles.toggleButtonText}>
              {showAllUsers ? 'Show less' : `Show all ${a.userDrilldown.length} users`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, paddingBottom: 60 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  loadingText: { color: '#666', marginTop: 12, fontSize: 13 },
  errorText: { color: '#ef4444', fontSize: 14, textAlign: 'center' },
  retryButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: '#222',
    borderRadius: 8,
  },
  retryText: { color: '#fff', fontSize: 14 },
  pageTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginBottom: 4 },
  pageSubtitle: { fontSize: 12, color: '#555', marginBottom: 24 },
  section: {
    backgroundColor: '#111',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e1e1e',
    marginBottom: 12,
    overflow: 'hidden',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#fff', flex: 1 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBody: { padding: 16, paddingTop: 4 },
  chevron: { color: '#555', fontSize: 11 },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },
  tooltipTrigger: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tooltipIcon: { color: '#888', fontSize: 11, fontWeight: '700' },
  tooltipModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  tooltipModalCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  tooltipModalText: { color: '#ccc', fontSize: 14, lineHeight: 20 },
  tooltipModalDismiss: {
    marginTop: 14,
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  tooltipModalDismissText: { color: '#3b82f6', fontSize: 13, fontWeight: '600' },
  metricsGrid: { gap: 10 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  metricLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  metricLabel: { fontSize: 13, color: '#888' },
  metricValue: { fontSize: 14, fontWeight: '600', color: '#fff', textAlign: 'right' },
  metricSublabel: { fontSize: 11, color: '#555', textAlign: 'right', marginTop: 1 },
  warningBanner: {
    backgroundColor: '#1a1000',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginBottom: 12,
  },
  warningText: { color: '#f59e0b', fontSize: 12, lineHeight: 17 },
  alphaRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  alphaBadgeContainer: { flex: 1 },
  alphaBadgeLabel: { fontSize: 11, color: '#666', marginBottom: 6 },
  alphaBadge: { borderRadius: 8, borderWidth: 1, padding: 12, alignItems: 'center' },
  alphaBadgeValue: { fontSize: 18, fontWeight: '700' },
  alphaBadgeSublabel: { fontSize: 11, marginTop: 2 },
  alphaNote: { fontSize: 12, color: '#555', lineHeight: 17, marginTop: 8 },
  pillarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillarCard: {
    width: '48%',
    backgroundColor: '#161616',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#222',
    padding: 10,
  },
  pillarCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  pillarCardName: { fontSize: 12, fontWeight: '600', color: '#ccc', flex: 1 },
  lowVarianceFlag: { fontSize: 9, color: '#f59e0b' },
  pillarCardStats: { flexDirection: 'row', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  pillarStatItem: { fontSize: 10, color: '#555' },
  pillarStatValue: { color: '#fff', fontWeight: '600' },
  expandedPillar: {
    marginTop: 12,
    backgroundColor: '#161616',
    borderRadius: 8,
    padding: 12,
  },
  expandedPillarTitle: { fontSize: 13, fontWeight: '600', color: '#fff', marginBottom: 10 },
  distRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  distLabel: { fontSize: 11, color: '#666', width: 60 },
  distCount: { fontSize: 11, color: '#555', width: 24, textAlign: 'right' },
  lowVarianceNote: { fontSize: 11, color: '#f59e0b', lineHeight: 16, marginTop: 8 },
  miniBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#1e1e1e',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniBarFill: { height: '100%', borderRadius: 3 },
  correlationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  correlationLabel: { fontSize: 13, color: '#888', flex: 1 },
  correlationValue: { fontSize: 14, fontWeight: '700', textAlign: 'right' },
  correlationInterp: { fontSize: 11, textAlign: 'right', marginTop: 2 },
  bucketRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  bucketLabel: { fontSize: 11, color: '#666', width: 90 },
  bucketLabelHighlight: { color: '#f59e0b' },
  bucketCount: { fontSize: 11, color: '#555', width: 70, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#1e1e1e', marginVertical: 12 },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginBottom: 2,
  },
  tableCell: { flex: 1, fontSize: 12, color: '#555' },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#141414',
  },
  tableRowHighlight: { backgroundColor: '#1a1200' },
  tableRowExpanded: { backgroundColor: '#161616' },
  userExpanded: {
    backgroundColor: '#0f0f0f',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  userExpandedRow: { fontSize: 12, color: '#666', marginBottom: 3 },
  toggleButton: {
    marginTop: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 8,
  },
  toggleButtonText: { color: '#888', fontSize: 12 },
  validityRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  validityHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  validityPillar: { fontSize: 13, color: '#ccc', flex: 1 },
  validityRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  validityN: { fontSize: 11, color: '#555' },
  validityInterp: { fontSize: 11, color: '#555', lineHeight: 16 },
  validityWarning: { fontSize: 11, color: '#ef4444', marginTop: 4, lineHeight: 16 },
  marketQuestionBlock: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  marketQuestionLabel: { fontSize: 13, fontWeight: '600', color: '#ccc', marginBottom: 4 },
  marketQuestionMeta: { fontSize: 11, color: '#555', marginBottom: 8 },
  marketOptionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5 },
  marketOptionLabel: { fontSize: 11, color: '#888', width: 120, flexShrink: 0 },
  marketOptionCount: { fontSize: 11, color: '#555', width: 72, textAlign: 'right' },
  marketTextResponse: { fontSize: 12, color: '#888', lineHeight: 18, marginBottom: 4 },
  cohortSegmentBlock: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  cohortSegmentTitle: { fontSize: 12, fontWeight: '600', color: '#aaa', marginBottom: 8 },
  cohortPillarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  cohortPillarLabel: { fontSize: 11, color: '#888', width: 118, flexShrink: 0 },
  cohortPillarBarWrap: { flex: 1, minWidth: 80 },
  cohortPillarMean: { fontSize: 12, fontWeight: '600', color: '#fff', width: 36, textAlign: 'right' },
  cohortPillarMeta: { fontSize: 10, color: '#555', width: 88, textAlign: 'right' },
});
