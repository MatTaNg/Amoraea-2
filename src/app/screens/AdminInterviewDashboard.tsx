/**
 * Alpha-only: Admin panel — cohort overview and individual user drill-down.
 * Visible only to admin@amoraea.com. Remove before production.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
} from 'react-native';
import { supabase } from '@data/supabase/client';

// Pillar IDs as stored in DB; construct keys match ai_reasoning.construct_breakdown
const PILLAR_ROWS = [
  { id: '1', constructKey: 'conflict_repair', label: 'Conflict & Repair', short: 'C&R' },
  { id: '3', constructKey: 'accountability', label: 'Accountability', short: 'Acc' },
  { id: '5', constructKey: 'responsiveness', label: 'Responsiveness', short: 'Res' },
  { id: '6', constructKey: 'desire_limits', label: 'Desire & Limits', short: 'D&L' },
];

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
  per_construct_ratings: Record<string, { rating?: number; comment?: string }> | null;
  transcript: Array<{ role: string; content?: string }> | null;
  scenario_specific_patterns?: Record<string, unknown> | null;
  probe_log?: unknown;
};

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
      transcript
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

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatConstruct(key: string): string {
  const row = PILLAR_ROWS.find((r) => r.id === key || r.constructKey === key);
  return row?.label ?? key?.replace(/_/g, ' ') ?? '—';
}

// —— Shared UI ——
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{title}</Text>
      {children}
    </View>
  );
}

function MetaGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode; alert?: boolean }>;
}) {
  return (
    <View style={styles.metaGrid}>
      {items.map((item, i) => (
        <View
          key={i}
          style={[styles.metaGridItem, item.alert && styles.metaGridItemAlert]}
        >
          <Text style={[styles.metaGridLabel, item.alert && styles.metaGridLabelAlert]}>
            {item.label}
          </Text>
          <Text style={[styles.metaGridValue, item.alert && styles.metaGridValueAlert]}>
            {item.value ?? '—'}
          </Text>
        </View>
      ))}
    </View>
  );
}

// —— Cohort overview ——
function UserRow({
  userData,
  onPress,
  isEven,
}: {
  userData: UserGroup;
  onPress: () => void;
  isEven: boolean;
}) {
  const a = userData.latestAttempt;
  const scores = a?.pillar_scores ?? {};
  const displayName = getUserDisplayName(userData.user);
  const hasLowFeedback =
    a?.user_analysis_rating != null && a.user_analysis_rating <= 2;
  const statusColor = !a
    ? '#3D5470'
    : a.passed === true
      ? '#2A8C6A'
      : a.passed === false
        ? '#E87A7A'
        : '#7A9ABE';
  const statusText = !a
    ? '● No interview'
    : a.passed === true
      ? '● Pass'
      : a.passed === false
        ? '● Fail'
        : '● Incomplete';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.userRow,
        isEven && styles.userRowEven,
        pressed && styles.userRowPressed,
      ]}
    >
      <View style={styles.userRowCol1}>
        <Text style={styles.userRowName}>{displayName}</Text>
        <Text style={styles.userRowEmail}>{userData.user?.email ?? '—'}</Text>
        <Text style={styles.userRowDate}>
          {a?.completed_at
            ? new Date(a.completed_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : userData.user?.created_at
              ? `Joined: ${new Date(userData.user.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}`
              : 'Incomplete'}
        </Text>
      </View>
      <View style={styles.userRowCol2}>
        <Text
          style={[
            styles.userRowScore,
            !a && { color: '#3D5470' },
            (a?.weighted_score ?? 0) >= 7 && styles.userRowScoreHigh,
            (a?.weighted_score ?? 0) >= 5 && (a?.weighted_score ?? 0) < 7 && styles.userRowScoreMid,
            (a?.weighted_score ?? 0) < 5 && (a?.weighted_score ?? 0) > 0 && styles.userRowScoreLow,
          ]}
        >
          {a?.weighted_score != null ? a.weighted_score.toFixed(1) : '—'}
        </Text>
      </View>
      <View style={styles.userRowCol3}>
        <Text
          style={[
            styles.userRowResult,
            { color: statusColor },
            a?.passed === true && styles.userRowResultPass,
            a?.passed === false && styles.userRowResultFail,
          ]}
        >
          {statusText}
        </Text>
      </View>
      <View style={styles.userRowCol4}>
        {PILLAR_ROWS.map((p) => (
          <View key={p.id} style={styles.constructCell}>
            <Text style={styles.constructLabel}>{p.short}</Text>
            <Text
              style={[
                styles.constructScore,
                (scores[p.id] ?? 0) >= 7 && styles.constructScoreHigh,
                (scores[p.id] ?? 0) >= 5 && (scores[p.id] ?? 0) < 7 && styles.constructScoreMid,
                scores[p.id] != null && (scores[p.id] ?? 0) < 5 && styles.constructScoreLow,
              ]}
            >
              {scores[p.id] != null ? (scores[p.id] as number).toFixed(1) : '—'}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.userRowCol5}>
        <Text
          style={[
            styles.userRowAttempts,
            userData.attempts.length === 0 && { color: '#3D5470' },
          ]}
        >
          {userData.attempts.length}
          {userData.attempts.length > 1 && (
            <Text style={styles.userRowRuns}> runs</Text>
          )}
        </Text>
      </View>
      <View style={styles.userRowCol6}>
        {a?.user_analysis_rating != null ? (
          <View style={styles.feedbackCell}>
            <Text
              style={[
                styles.stars,
                hasLowFeedback && styles.starsLow,
              ]}
            >
              {'★'.repeat(a.user_analysis_rating)}
              {'☆'.repeat(5 - a.user_analysis_rating)}
            </Text>
            {hasLowFeedback && <Text style={styles.lowFeedbackBadge}>⚠</Text>}
          </View>
        ) : (
          <Text style={styles.noFeedback}>—</Text>
        )}
      </View>
      <View style={styles.userRowCol7}>
        <Text style={styles.arrow}>›</Text>
      </View>
    </Pressable>
  );
}

// —— Drill-down tabs ——
function OverviewTab({
  attempt: a,
}: {
  attempt: AttemptRow | null;
  constructs: typeof PILLAR_ROWS;
}) {
  if (!a) return null;
  const scenarioScores = [
    a.scenario_1_scores as { pillarScores?: Record<string, number> } | null,
    a.scenario_2_scores as { pillarScores?: Record<string, number> } | null,
    a.scenario_3_scores as { pillarScores?: Record<string, number> } | null,
  ];
  const asym = a.construct_asymmetry as {
    strongest_construct?: string;
    weakest_construct?: string;
    gap?: number;
    profile_type?: string;
    user_mean?: number;
  } | null;
  const lang = a.language_markers as Record<string, number | undefined> | null;
  const timings = a.response_timings ?? [];

  return (
    <View style={styles.tabContent}>
      <Section title="Interview Details">
        <MetaGrid
          items={[
            {
              label: 'Date',
              value: a.completed_at
                ? new Date(a.completed_at).toLocaleString('en-GB')
                : 'Not completed',
            },
            {
              label: 'Duration',
              value:
                a.created_at && a.completed_at
                  ? formatDuration(a.created_at, a.completed_at)
                  : '—',
            },
            { label: 'Attempt', value: `#${a.attempt_number ?? 1}` },
            {
              label: 'Dropout',
              value: a.dropout_point
                ? `Scenario ${(a.dropout_point as { scenario?: number }).scenario ?? '?'}`
                : 'Completed',
            },
          ]}
        />
      </Section>

      {asym && (
        <Section title="Profile Shape">
          <MetaGrid
            items={[
              { label: 'Strongest', value: formatConstruct(asym.strongest_construct ?? '') },
              { label: 'Weakest', value: formatConstruct(asym.weakest_construct ?? '') },
              { label: 'Gap', value: asym.gap?.toFixed(1) },
              {
                label: 'Profile type',
                value: (asym.profile_type ?? '').replace(/_/g, ' '),
              },
              { label: 'User mean', value: asym.user_mean?.toFixed(1) },
            ]}
          />
        </Section>
      )}

      <Section title="Scores by Scenario">
        <View style={styles.scenarioScoresRow}>
          {[1, 2, 3].map((n) => {
            const s = scenarioScores[n - 1]?.pillarScores;
            return (
              <View key={n} style={styles.scenarioCard}>
                <Text style={styles.scenarioCardTitle}>Scenario {n}</Text>
                {PILLAR_ROWS.map((p) => (
                  <View key={p.id} style={styles.scenarioRow}>
                    <Text style={styles.scenarioRowLabel}>{p.label.split(' ')[0]}</Text>
                    <Text style={styles.scenarioRowValue}>
                      {s?.[p.id]?.toFixed(1) ?? '—'}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      </Section>

      {lang && (
        <Section title="Language Markers">
          <MetaGrid
            items={[
              {
                label: 'First person ratio',
                value: `${Math.round((Number(lang.first_person_ratio) || 0) * 100)}%`,
              },
              { label: 'Qualifier count', value: lang.qualifier_count },
              { label: 'Emotional vocab', value: lang.emotional_vocab_count },
              { label: 'Accountability phrases', value: lang.accountability_phrases },
              {
                label: 'Deflection phrases',
                value: lang.deflection_phrases,
                alert: (lang.deflection_phrases ?? 0) > 3,
              },
            ]}
          />
        </Section>
      )}

      {timings.length > 0 && (
        <Section title="Response Timing">
          <MetaGrid
            items={[
              {
                label: 'Avg latency',
                value: `${(timings.reduce((s, t) => s + (t.latency_ms ?? 0), 0) / timings.length / 1000).toFixed(1)}s`,
              },
              {
                label: 'Avg response duration',
                value: `${(timings.reduce((s, t) => s + (t.duration_ms ?? 0), 0) / timings.length / 1000).toFixed(1)}s`,
              },
              {
                label: 'Avg words per response',
                value: Math.round(
                  timings.reduce((s, t) => s + (t.word_count ?? 0), 0) / timings.length
                ),
              },
              { label: 'Total responses', value: timings.length },
            ]}
          />
        </Section>
      )}
    </View>
  );
}

function ReasoningTab({
  reasoning: r,
  scores,
}: {
  reasoning: Record<string, unknown> | null;
  constructs: typeof PILLAR_ROWS;
  scores: Record<string, number> | null;
}) {
  const [expandedConstruct, setExpandedConstruct] = useState<string | null>(null);

  if (!r || (r as { _generationFailed?: boolean })._generationFailed) {
    return (
      <View style={styles.emptyTab}>
        <Text style={styles.emptyTabText}>AI reasoning was not generated for this attempt.</Text>
      </View>
    );
  }

  const strengths = (r.overall_strengths as string[]) ?? [];
  const growth = (r.overall_growth_areas as string[]) ?? [];
  const breakdown = (r.construct_breakdown as Record<string, Record<string, string>>) ?? {};

  return (
    <View style={styles.tabContent}>
      <Section title="Overall Summary">
        <Text style={styles.quoteText}>"{String(r.overall_summary ?? '')}"</Text>
      </Section>

      <View style={styles.twoCol}>
        <Section title="Strengths">
          {strengths.map((s, i) => (
            <View key={i} style={styles.bulletBlock}>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </Section>
        <Section title="Growth Areas">
          {growth.map((s, i) => (
            <View key={i} style={styles.bulletBlockMuted}>
              <Text style={styles.bulletText}>{s}</Text>
            </View>
          ))}
        </Section>
      </View>

      <Section title="Construct Breakdown">
        {PILLAR_ROWS.map((p) => {
          const data = breakdown[p.constructKey] ?? breakdown[p.id];
          const score = scores?.[p.id];
          const isExpanded = expandedConstruct === p.id;
          return (
            <View key={p.id} style={styles.constructCard}>
              <Pressable
                onPress={() => setExpandedConstruct(isExpanded ? null : p.id)}
                style={[styles.constructCardHeader, isExpanded && styles.constructCardHeaderOpen]}
              >
                <View>
                  <Text style={styles.constructCardTitle}>{p.label}</Text>
                  {data?.headline && (
                    <Text style={styles.constructCardHeadline}>{data.headline}</Text>
                  )}
                </View>
                <View style={styles.constructCardRight}>
                  <Text
                    style={[
                      styles.constructCardScore,
                      (score ?? 0) >= 7 && styles.scoreHigh,
                      (score ?? 0) >= 5 && (score ?? 0) < 7 && styles.scoreMid,
                      (score ?? 0) < 5 && score != null && styles.scoreLow,
                    ]}
                  >
                    {score?.toFixed(1) ?? '—'}
                  </Text>
                  <Text style={styles.expandIcon}>{isExpanded ? '▲' : '▼'}</Text>
                </View>
              </Pressable>
              {isExpanded && data && (
                <View style={styles.constructCardBody}>
                  {[
                    { label: 'Summary', content: data.summary },
                    { label: 'What they did well', content: data.what_you_did_well },
                    { label: 'Where they struggled', content: data.where_you_struggled },
                    { label: 'Core pattern', content: data.key_pattern },
                    { label: 'Nuance & context', content: data.nuance_and_context },
                    { label: 'Growth edge', content: data.growth_edge },
                  ]
                    .filter((f) => f.content)
                    .map((field, i) => (
                      <View key={i} style={styles.fieldBlock}>
                        <Text style={styles.fieldLabel}>{field.label}</Text>
                        <Text style={styles.fieldValue}>{field.content}</Text>
                      </View>
                    ))}
                </View>
              )}
            </View>
          );
        })}
      </Section>

      {r.cross_scenario_patterns && (
        <Section title="Cross-Scenario Patterns">
          <Text style={styles.bodyText}>{String(r.cross_scenario_patterns)}</Text>
        </Section>
      )}

      {r.what_a_partner_would_experience && (
        <Section title="What a Partner Would Experience">
          <Text style={styles.bodyText}>{String(r.what_a_partner_would_experience)}</Text>
        </Section>
      )}

      {r.closing_reflection && (
        <Section title="Closing Reflection">
          <Text style={styles.quoteText}>"{String(r.closing_reflection)}"</Text>
        </Section>
      )}
    </View>
  );
}

function FeedbackTab({ attempt: a }: { attempt: AttemptRow | null; constructs: typeof PILLAR_ROWS }) {
  if (!a?.user_analysis_rating && !a?.user_analysis_comment) {
    return (
      <View style={styles.emptyTab}>
        <Text style={styles.emptyTabText}>No feedback submitted yet.</Text>
      </View>
    );
  }

  const perConstruct = (a.per_construct_ratings ?? {}) as Record<
    string,
    { rating?: number; comment?: string }
  >;

  return (
    <View style={styles.tabContent}>
      <Section title="Overall Accuracy Rating">
        <View style={styles.starRow}>
          <Text
            style={[
              styles.starsLarge,
              (a.user_analysis_rating ?? 0) >= 4 && styles.starsGreen,
              (a.user_analysis_rating ?? 0) >= 3 && (a.user_analysis_rating ?? 0) < 4 && styles.starsBlue,
              (a.user_analysis_rating ?? 0) < 3 && styles.starsRed,
            ]}
          >
            {'★'.repeat(a.user_analysis_rating ?? 0)}
            {'☆'.repeat(5 - (a.user_analysis_rating ?? 0))}
          </Text>
          <Text style={styles.ratingCount}>{a.user_analysis_rating}/5</Text>
        </View>
        {a.user_analysis_comment && (
          <View style={styles.commentBlock}>
            <Text style={styles.commentText}>"{a.user_analysis_comment}"</Text>
          </View>
        )}
      </Section>

      {Object.keys(perConstruct).length > 0 && (
        <Section title="Per-Construct Feedback">
          {PILLAR_ROWS.map((p) => {
            const fb = perConstruct[p.constructKey] ?? perConstruct[p.id];
            if (!fb?.rating && !fb?.comment) return null;
            return (
              <View key={p.id} style={styles.feedbackCard}>
                <View style={styles.feedbackCardHeader}>
                  <Text style={styles.feedbackCardTitle}>{p.label}</Text>
                  {fb.rating != null && (
                    <Text style={styles.feedbackStars}>
                      {'★'.repeat(fb.rating)}
                      {'☆'.repeat(5 - fb.rating)}
                    </Text>
                  )}
                </View>
                {fb.comment && (
                  <Text style={styles.feedbackComment}>"{fb.comment}"</Text>
                )}
              </View>
            );
          })}
        </Section>
      )}
    </View>
  );
}

function HistoryTab({
  attempts,
}: {
  attempts: AttemptRow[];
  constructs: typeof PILLAR_ROWS;
}) {
  const sorted = [...attempts].sort((a, b) => a.attempt_number - b.attempt_number);

  return (
    <View style={styles.tabContent}>
      {sorted.map((a) => (
        <View key={a.id} style={styles.historyCard}>
          <View style={styles.historyCardHeader}>
            <Text style={styles.historyCardTitle}>Attempt #{a.attempt_number}</Text>
            <View style={styles.historyCardMeta}>
              <Text style={styles.historyScore}>
                {a.weighted_score?.toFixed(1) ?? '—'}
              </Text>
              <Text
                style={[
                  styles.historyResult,
                  a.passed && styles.resultPass,
                  a.passed === false && styles.resultFail,
                ]}
              >
                {a.passed ? 'Pass' : 'Fail'}
              </Text>
              <Text style={styles.historyDate}>
                {a.completed_at
                  ? new Date(a.completed_at).toLocaleDateString('en-GB')
                  : 'Incomplete'}
              </Text>
            </View>
          </View>
          <View style={styles.historyPillars}>
            {PILLAR_ROWS.map((p) => (
              <View key={p.id} style={styles.historyPillar}>
                <Text style={styles.historyPillarValue}>
                  {a.pillar_scores?.[p.id]?.toFixed(1) ?? '—'}
                </Text>
                <Text style={styles.historyPillarLabel}>{p.short}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function TranscriptTab({ transcript }: { transcript: Array<{ role: string; content?: string }> | null }) {
  const [revealed, setRevealed] = useState(false);

  if (!transcript || transcript.length === 0) {
    return (
      <View style={styles.emptyTab}>
        <Text style={styles.emptyTabText}>No transcript available.</Text>
      </View>
    );
  }

  const filtered = transcript.filter(
    (m) => m.role !== 'error' && !(m as { isWaiting?: boolean }).isWaiting
  );

  if (!revealed) {
    return (
      <View style={styles.transcriptReveal}>
        <Text style={styles.transcriptRevealTitle}>Full transcript available</Text>
        <Text style={styles.transcriptRevealSub}>
          {filtered.length} messages · Long read
        </Text>
        <TouchableOpacity style={styles.showTranscriptButton} onPress={() => setRevealed(true)}>
          <Text style={styles.showTranscriptButtonText}>Show Transcript</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.transcriptToolbar}>
        <TouchableOpacity onPress={() => setRevealed(false)}>
          <Text style={styles.hideTranscriptText}>Hide ↑</Text>
        </TouchableOpacity>
      </View>
      {filtered.map((m, i) => (
        <View
          key={i}
          style={[
            styles.transcriptBubble,
            m.role === 'assistant' ? styles.transcriptBubbleAssistant : styles.transcriptBubbleUser,
          ]}
        >
          <Text style={styles.transcriptRole}>
            {m.role === 'assistant' ? '◆ Aira' : 'User'}
          </Text>
          <Text style={styles.transcriptContent}>{m.content ?? ''}</Text>
        </View>
      ))}
    </View>
  );
}

// —— User drill-down ——
function UserDrillDown({
  userData,
  onBack,
}: {
  userData: UserGroup;
  onBack: () => void;
}) {
  const [activeTab, setActiveTab] = useState<'overview' | 'reasoning' | 'feedback' | 'history' | 'transcript'>('overview');
  const a = userData.latestAttempt;
  const r = (a?.ai_reasoning ?? null) as Record<string, unknown> | null;

  const displayName = getUserDisplayName(userData.user);

  if (!userData.latestAttempt) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>{displayName}</Text>
              <Text style={styles.headerSub}>{userData.user?.email ?? '—'}</Text>
            </View>
          </View>
        </View>
        <View style={styles.noAttemptEmpty}>
          <Text style={styles.noAttemptTitle}>No interview yet</Text>
          <Text style={styles.noAttemptSub}>
            Joined{' '}
            {userData.user?.created_at
              ? new Date(userData.user.created_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })
              : '—'}
          </Text>
        </View>
      </View>
    );
  }

  const tabs: { id: typeof activeTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'reasoning', label: 'AI Reasoning' },
    { id: 'feedback', label: 'User Feedback' },
    { id: 'history', label: 'Attempt History' },
    { id: 'transcript', label: 'Transcript' },
  ];

  return (
    <View style={styles.fullScreen}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={onBack} style={styles.backButton}>
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{displayName}</Text>
            <Text style={styles.headerSub}>
              {userData.user?.email} · {userData.attempts.length} attempt
              {userData.attempts.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <View
          style={[
            styles.badge,
            a?.passed ? styles.badgePass : styles.badgeFail,
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              a?.passed ? styles.badgeTextPass : styles.badgeTextFail,
            ]}
          >
            {a?.passed === true ? '● Passed' : a?.passed === false ? '● Failed' : 'Incomplete'}
          </Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scoreStrip}>
        <View style={styles.scoreCard}>
          <Text style={styles.scoreCardValue}>
            {a?.weighted_score?.toFixed(1) ?? '—'}
          </Text>
          <Text style={styles.scoreCardLabel}>Overall</Text>
        </View>
        {PILLAR_ROWS.map((p) => {
          const score = a?.pillar_scores?.[p.id];
          const consistency = (a?.score_consistency as Record<string, { std_dev?: number }> | undefined)?.[p.id];
          return (
            <View key={p.id} style={styles.scoreCardSmall}>
              <Text
                style={[
                  styles.scoreCardValueSmall,
                  (score ?? 0) >= 7 && styles.scoreHigh,
                  (score ?? 0) >= 5 && (score ?? 0) < 7 && styles.scoreMid,
                  (score ?? 0) < 5 && score != null && styles.scoreLow,
                ]}
              >
                {score?.toFixed(1) ?? '—'}
              </Text>
              <Text style={styles.scoreCardLabelSmall}>{p.label}</Text>
              {consistency?.std_dev != null && (
                <Text style={styles.consistencyText}>
                  σ {consistency.std_dev.toFixed(1)} across scenarios
                  {consistency.std_dev > 2 && (
                    <Text style={styles.consistencyWarn}> ⚠ variable</Text>
                  )}
                </Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={[styles.tab, activeTab === tab.id && styles.tabActive]}
          >
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.id && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.tabPane} contentContainerStyle={styles.tabPaneContent}>
        {activeTab === 'overview' && (
          <OverviewTab attempt={a} constructs={PILLAR_ROWS} />
        )}
        {activeTab === 'reasoning' && (
          <ReasoningTab reasoning={r} constructs={PILLAR_ROWS} scores={a?.pillar_scores ?? null} />
        )}
        {activeTab === 'feedback' && (
          <FeedbackTab attempt={a} constructs={PILLAR_ROWS} />
        )}
        {activeTab === 'history' && (
          <HistoryTab attempts={userData.attempts} constructs={PILLAR_ROWS} />
        )}
        {activeTab === 'transcript' && (
          <TranscriptTab transcript={a?.transcript ?? null} />
        )}
      </ScrollView>
    </View>
  );
}

// —— Main Admin Panel ——
export function AdminInterviewDashboard({ onClose }: { onClose: () => void }) {
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserGroup | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'score' | 'name'>('date');
  const [filterBy, setFilterBy] = useState<
    'all' | 'passed' | 'failed' | 'incomplete' | 'no_interview' | 'low_feedback'
  >('all');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAllAdminData();
        if (!cancelled) {
          setUsers(data);
        }
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

  if (selectedUser) {
    return (
      <UserDrillDown
        userData={selectedUser}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  const totalUsers = users.length;
  const startedUsers = users.filter((u) => u.attempts.length > 0);
  const completedUsers = users.filter((u) => u.latestAttempt?.completed_at);
  const passedCount = completedUsers.filter((u) => u.latestAttempt?.passed === true).length;
  const passRate =
    completedUsers.length > 0
      ? `${Math.round((passedCount / completedUsers.length) * 100)}%`
      : '—';
  const dropOffCount = startedUsers.filter((u) => !u.latestAttempt?.completed_at).length;
  const avgScore =
    completedUsers.length > 0
      ? (
          completedUsers.reduce((s, u) => s + (u.latestAttempt?.weighted_score ?? 0), 0) /
          completedUsers.length
        ).toFixed(1)
      : '—';
  const lowFeedbackCount = completedUsers.filter(
    (u) =>
      u.latestAttempt?.user_analysis_rating != null &&
      u.latestAttempt.user_analysis_rating <= 2
  ).length;

  const sorted = [...users]
    .filter((u) => {
      if (filterBy === 'passed') return u.latestAttempt?.passed === true;
      if (filterBy === 'failed') return u.latestAttempt?.passed === false;
      if (filterBy === 'incomplete')
        return u.attempts.length > 0 && !u.latestAttempt?.completed_at;
      if (filterBy === 'no_interview') return u.attempts.length === 0;
      if (filterBy === 'low_feedback')
        return (
          u.latestAttempt?.user_analysis_rating != null &&
          u.latestAttempt.user_analysis_rating <= 2
        );
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score')
        return (b.latestAttempt?.weighted_score ?? 0) - (a.latestAttempt?.weighted_score ?? 0);
      if (sortBy === 'name') {
        const na = getUserDisplayName(a.user);
        const nb = getUserDisplayName(b.user);
        return na.localeCompare(nb);
      }
      const dateA = a.latestAttempt?.created_at ?? a.user?.created_at ?? 0;
      const dateB = b.latestAttempt?.created_at ?? b.user?.created_at ?? 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const stats = [
    { label: 'Registered', value: String(totalUsers), alert: false },
    { label: 'Started', value: String(startedUsers.length), alert: false },
    { label: 'Completed', value: String(completedUsers.length), alert: false },
    { label: 'Pass Rate', value: passRate, alert: false },
    { label: 'Avg Score', value: String(avgScore), alert: false },
    { label: 'Drop-off', value: String(dropOffCount), alert: dropOffCount > 0 },
    { label: 'Low Feedback', value: String(lowFeedbackCount), alert: lowFeedbackCount > 0 },
  ];

  return (
    <View style={styles.fullScreen}>
      <View style={styles.header}>
        <Text style={styles.headerTitleMain}>Admin Panel</Text>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.headerBackLink}>← Back to Interview</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
        <View style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <View
              key={i}
              style={[styles.statCard, stat.alert && styles.statCardAlert]}
            >
              <Text style={[styles.statValue, stat.alert && styles.statValueAlert]}>
                {stat.value}
              </Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.filterRow}>
          <Text style={styles.filterLabel}>Filter:</Text>
          {[
            { key: 'all' as const, label: 'all' },
            { key: 'passed' as const, label: 'passed' },
            { key: 'failed' as const, label: 'failed' },
            { key: 'incomplete' as const, label: 'incomplete' },
            { key: 'no_interview' as const, label: 'no interview' },
            { key: 'low_feedback' as const, label: 'low feedback' },
          ].map(({ key, label }) => (
            <TouchableOpacity
              key={key}
              onPress={() => setFilterBy(key)}
              style={[styles.filterChip, filterBy === key && styles.filterChipActive]}
            >
              <Text
                style={[styles.filterChipText, filterBy === key && styles.filterChipTextActive]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <View style={{ flex: 1 }} />
          <Text style={styles.filterLabel}>Sort:</Text>
          {(['date', 'score', 'name'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              onPress={() => setSortBy(s)}
              style={[styles.sortChip, sortBy === s && styles.sortChipActive]}
            >
              <Text style={[styles.sortChipText, sortBy === s && styles.sortChipTextActive]}>
                {s}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.tableHeaderCell}>User</Text>
            <Text style={styles.tableHeaderCell}>Score</Text>
            <Text style={styles.tableHeaderCell}>Result</Text>
            <Text style={styles.tableHeaderCell}>Constructs</Text>
            <Text style={styles.tableHeaderCell}>Attempts</Text>
            <Text style={styles.tableHeaderCell}>Feedback</Text>
            <Text style={[styles.tableHeaderCell, styles.tableHeaderCellLast]} />
          </View>

          {loading ? (
            <View style={styles.tableLoading}>
              <Text style={styles.tableLoadingText}>Loading...</Text>
            </View>
          ) : sorted.length === 0 ? (
            <View style={styles.tableLoading}>
              <Text style={styles.tableLoadingText}>No users match.</Text>
            </View>
          ) : (
            sorted.map((userData, i) => (
              <UserRow
                key={userData.user?.id ?? i}
                userData={userData}
                onPress={() => setSelectedUser(userData)}
                isEven={i % 2 === 0}
              />
            ))
          )}
        </View>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.12)',
    backgroundColor: '#05060D',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerTitleMain: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '300',
    color: '#C8E4FF',
    letterSpacing: 1,
  },
  headerTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '300',
    color: '#C8E4FF',
  },
  headerSub: {
    fontSize: 11,
    fontWeight: '300',
    color: '#3D5470',
    marginTop: 2,
  },
  headerBackLink: {
    color: '#3D5470',
    fontSize: 13,
    fontWeight: '300',
    letterSpacing: 1,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#3D5470',
    fontSize: 18,
  },
  noAttemptEmpty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  noAttemptTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '300',
    color: '#7A9ABE',
  },
  noAttemptSub: {
    fontSize: 11,
    fontWeight: '300',
    color: '#3D5470',
    letterSpacing: 0.5,
  },
  badge: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  badgePass: {
    backgroundColor: 'rgba(42,140,106,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(42,140,106,0.3)',
  },
  badgeFail: {
    backgroundColor: 'rgba(232,122,122,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(232,122,122,0.3)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  badgeTextPass: { color: '#2A8C6A' },
  badgeTextFail: { color: '#E87A7A' },
  body: { flex: 1 },
  bodyContent: { padding: 28, paddingHorizontal: 32 },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 32,
  },
  statCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 10,
    padding: 14,
    paddingHorizontal: 18,
  },
  statCardAlert: {
    borderColor: 'rgba(232,122,122,0.3)',
  },
  statValue: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 28,
    fontWeight: '300',
    color: '#C8E4FF',
    marginBottom: 4,
  },
  statValueAlert: { color: '#E87A7A' },
  statLabel: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  filterLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    fontWeight: '300',
  },
  filterChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
  },
  filterChipActive: {
    backgroundColor: 'rgba(30,111,217,0.15)',
    borderColor: 'rgba(82,142,220,0.4)',
  },
  filterChipText: {
    color: '#3D5470',
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  filterChipTextActive: { color: '#5BA8E8' },
  sortChip: {
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.08)',
  },
  sortChipActive: {
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderColor: 'rgba(82,142,220,0.3)',
  },
  sortChipText: {
    color: '#3D5470',
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  sortChipTextActive: { color: '#5BA8E8' },
  table: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(13,17,32,0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.1)',
  },
  tableHeaderCell: {
    flex: 1,
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  tableHeaderCellLast: { flex: 0, width: 40 },
  tableLoading: {
    padding: 40,
    alignItems: 'center',
  },
  tableLoadingText: {
    color: '#3D5470',
    fontSize: 13,
    fontWeight: '300',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.06)',
  },
  userRowEven: { backgroundColor: 'rgba(13,17,32,0.4)' },
  userRowPressed: { backgroundColor: 'rgba(30,111,217,0.06)' },
  userRowCol1: { flex: 2 },
  userRowCol2: { flex: 1 },
  userRowCol3: { flex: 1 },
  userRowCol4: { flex: 1.5, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  userRowCol5: { flex: 1 },
  userRowCol6: { flex: 1 },
  userRowCol7: { flex: 0, width: 40, alignItems: 'flex-end' },
  userRowName: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 16,
    fontWeight: '400',
    color: '#E8F0F8',
    marginBottom: 2,
  },
  userRowEmail: { fontSize: 11, fontWeight: '300', color: '#3D5470' },
  userRowDate: { fontSize: 10, fontWeight: '300', color: '#3D5470', marginTop: 2 },
  userRowScore: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 24,
    fontWeight: '300',
  },
  userRowScoreHigh: { color: '#C8E4FF' },
  userRowScoreMid: { color: '#7A9ABE' },
  userRowScoreLow: { color: '#E87A7A' },
  userRowResult: {
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  userRowResultPass: { color: '#2A8C6A' },
  userRowResultFail: { color: '#E87A7A' },
  constructCell: { alignItems: 'center', gap: 2 },
  constructLabel: { fontSize: 10, fontWeight: '300', color: '#3D5470' },
  constructScore: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 14,
    fontWeight: '300',
    color: '#C8E4FF',
  },
  constructScoreHigh: { color: '#C8E4FF' },
  constructScoreMid: { color: '#7A9ABE' },
  constructScoreLow: { color: '#E87A7A' },
  userRowAttempts: { fontSize: 13, fontWeight: '300', color: '#7A9ABE' },
  userRowRuns: { color: '#3D5470', fontSize: 10 },
  feedbackCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stars: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 14,
    fontWeight: '300',
    color: '#7A9ABE',
  },
  starsLow: { color: '#E87A7A' },
  lowFeedbackBadge: { fontSize: 8, color: '#E87A7A', letterSpacing: 1 },
  noFeedback: { color: '#3D5470', fontSize: 11 },
  arrow: { color: '#3D5470', fontSize: 16 },
  scoreStrip: {
    flexGrow: 0,
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.08)',
  },
  scoreCard: {
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.15)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minWidth: 100,
    alignItems: 'center',
    marginRight: 16,
  },
  scoreCardValue: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 32,
    fontWeight: '300',
    color: '#C8E4FF',
  },
  scoreCardLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginTop: 4,
  },
  scoreCardSmall: {
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 120,
    marginRight: 16,
  },
  scoreCardValueSmall: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 26,
    fontWeight: '300',
  },
  scoreHigh: { color: '#C8E4FF' },
  scoreMid: { color: '#7A9ABE' },
  scoreLow: { color: '#E87A7A' },
  scoreCardLabelSmall: { fontSize: 10, fontWeight: '300', color: '#7A9ABE', marginTop: 2 },
  consistencyText: { fontSize: 9, color: '#3D5470', marginTop: 4 },
  consistencyWarn: { color: '#C9A96E' },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.1)',
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#1E6FD9' },
  tabLabel: {
    fontSize: 11,
    fontWeight: '300',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  tabLabelActive: { color: '#5BA8E8' },
  tabPane: { flex: 1 },
  tabPaneContent: { padding: 28, paddingHorizontal: 32, maxWidth: 900 },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 9,
    fontWeight: '300',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 14,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaGridItem: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.08)',
    borderRadius: 8,
    minWidth: 120,
  },
  metaGridItemAlert: { borderColor: 'rgba(232,122,122,0.2)' },
  metaGridLabel: {
    fontSize: 9,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 4,
  },
  metaGridLabelAlert: { color: '#E87A7A' },
  metaGridValue: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 16,
    fontWeight: '300',
    color: '#C8E4FF',
  },
  metaGridValueAlert: { color: '#E87A7A' },
  scenarioScoresRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  scenarioCard: {
    flex: 1,
    minWidth: 100,
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
    padding: 16,
  },
  scenarioCardTitle: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 12,
  },
  scenarioRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  scenarioRowLabel: { fontSize: 11, color: '#7A9ABE' },
  scenarioRowValue: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 14,
    color: '#C8E4FF',
  },
  twoCol: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  bulletBlock: {
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#1E6FD9',
  },
  bulletBlockMuted: {
    marginBottom: 10,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(82,142,220,0.3)',
  },
  bulletText: { fontSize: 13, fontWeight: '300', color: '#7A9ABE', lineHeight: 22 },
  quoteText: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 17,
    fontWeight: '300',
    fontStyle: 'italic',
    lineHeight: 26,
    color: '#C8E4FF',
  },
  bodyText: { fontSize: 13, fontWeight: '300', color: '#7A9ABE', lineHeight: 22 },
  constructCard: {
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  constructCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: 'rgba(13,17,32,0.6)',
  },
  constructCardHeaderOpen: { backgroundColor: 'rgba(30,111,217,0.06)' },
  constructCardTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 17,
    fontWeight: '400',
    color: '#E8F0F8',
  },
  constructCardHeadline: {
    fontSize: 12,
    fontWeight: '300',
    color: '#7A9ABE',
    marginLeft: 12,
    fontStyle: 'italic',
  },
  constructCardRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  constructCardScore: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '300',
  },
  expandIcon: { color: '#3D5470', fontSize: 16 },
  constructCardBody: {
    padding: 20,
    backgroundColor: 'rgba(5,6,13,0.5)',
  },
  fieldBlock: { marginBottom: 16, paddingLeft: 14, borderLeftWidth: 2, borderLeftColor: 'rgba(82,142,220,0.2)' },
  fieldLabel: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
    marginBottom: 4,
  },
  fieldValue: { fontSize: 13, fontWeight: '300', color: '#7A9ABE', lineHeight: 22 },
  emptyTab: { padding: 40, alignItems: 'center' },
  emptyTabText: { color: '#3D5470', fontSize: 13, fontWeight: '300' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  starsLarge: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 32,
    fontWeight: '300',
  },
  starsGreen: { color: '#2A8C6A' },
  starsBlue: { color: '#C8E4FF' },
  starsRed: { color: '#E87A7A' },
  ratingCount: { fontSize: 13, fontWeight: '300', color: '#7A9ABE' },
  commentBlock: {
    marginTop: 16,
    padding: 16,
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
  },
  commentText: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 16,
    fontWeight: '300',
    fontStyle: 'italic',
    color: '#C8E4FF',
    lineHeight: 24,
  },
  feedbackCard: {
    marginBottom: 16,
    padding: 16,
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.08)',
    borderRadius: 10,
  },
  feedbackCardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  feedbackCardTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 16,
    fontWeight: '400',
    color: '#E8F0F8',
  },
  feedbackStars: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 14,
    color: '#7A9ABE',
  },
  feedbackComment: {
    fontSize: 13,
    fontWeight: '300',
    color: '#7A9ABE',
    lineHeight: 22,
    fontStyle: 'italic',
  },
  historyCard: {
    padding: 20,
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 10,
    marginBottom: 16,
  },
  historyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  historyCardTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 17,
    fontWeight: '400',
    color: '#E8F0F8',
  },
  historyCardMeta: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  historyScore: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 22,
    fontWeight: '300',
    color: '#C8E4FF',
  },
  historyResult: {
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  resultPass: { color: '#2A8C6A' },
  resultFail: { color: '#E87A7A' },
  historyDate: { fontSize: 11, fontWeight: '300', color: '#3D5470' },
  historyPillars: { flexDirection: 'row', gap: 16 },
  historyPillar: { alignItems: 'center' },
  historyPillarValue: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 16,
    fontWeight: '300',
    color: '#7A9ABE',
  },
  historyPillarLabel: {
    fontSize: 9,
    letterSpacing: 1,
    color: '#3D5470',
    textTransform: 'uppercase',
  },
  transcriptReveal: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  transcriptRevealTitle: {
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
    fontSize: 18,
    fontWeight: '300',
    color: '#7A9ABE',
    marginBottom: 8,
  },
  transcriptRevealSub: {
    fontSize: 11,
    fontWeight: '300',
    color: '#3D5470',
    marginBottom: 24,
  },
  showTranscriptButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 8,
  },
  showTranscriptButtonText: {
    fontSize: 10,
    fontWeight: '300',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
  },
  transcriptToolbar: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 8 },
  hideTranscriptText: {
    fontSize: 10,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#3D5470',
  },
  transcriptBubble: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
  },
  transcriptBubbleAssistant: {
    backgroundColor: 'rgba(13,17,32,0.6)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.08)',
  },
  transcriptBubbleUser: {
    backgroundColor: 'rgba(30,111,217,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
  },
  transcriptRole: {
    fontSize: 9,
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: '#5BA8E8',
    marginBottom: 4,
  },
  transcriptContent: {
    fontSize: 13,
    fontWeight: '300',
    color: '#E8F0F8',
    lineHeight: 22,
  },
});
