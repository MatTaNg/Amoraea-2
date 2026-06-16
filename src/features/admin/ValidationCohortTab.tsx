import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import { supabase } from '@data/supabase/client';
import { RELATIONSHIP_VALIDATION_TRACK } from '@features/relationshipValidation/constants';

type CohortRow = {
  user_id: string;
  partner_user_id: string | null;
  pair_confirmed_at: string | null;
  pre_assessment: {
    overallCompatibility?: number;
    overallSatisfaction?: number;
  } | null;
  post_assessment: { scoreAccuracy?: number } | null;
  compatibility_score: number | null;
  psychometrics_completed_at: string | null;
};

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 2) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const den = Math.sqrt(dx * dy);
  if (den < 1e-9) return null;
  return num / den;
}

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function ValidationCohortTab() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<CohortRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data: users, error: usersErr } = await supabase
      .from('users')
      .select('id')
      .eq('validation_track', RELATIONSHIP_VALIDATION_TRACK);
    if (usersErr) throw new Error(usersErr.message);

    const ids = (users ?? []).map((u) => u.id);
    if (ids.length === 0) {
      setRows([]);
      return;
    }

    const { data, error: recErr } = await supabase
      .from('relationship_validation_records')
      .select(
        'user_id, partner_user_id, pair_confirmed_at, pre_assessment, post_assessment, compatibility_score, psychometrics_completed_at',
      )
      .in('user_id', ids);
    if (recErr) throw new Error(recErr.message);
    setRows((data ?? []) as CohortRow[]);
  }, []);

  useEffect(() => {
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    void load()
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setRefreshing(false));
  };

  const confirmedPairs = new Set<string>();
  let couplesBothComplete = 0;
  for (const row of rows) {
    if (!row.pair_confirmed_at || !row.partner_user_id || !row.psychometrics_completed_at) continue;
    const partner = rows.find((r) => r.user_id === row.partner_user_id);
    if (!partner?.psychometrics_completed_at) continue;
    const key = [row.user_id, row.partner_user_id].sort().join(':');
    if (confirmedPairs.has(key)) continue;
    confirmedPairs.add(key);
    couplesBothComplete += 1;
  }

  const preCompat = rows
    .map((r) => r.pre_assessment?.overallCompatibility)
    .filter((n): n is number => typeof n === 'number');
  const postAccuracy = rows
    .map((r) => r.post_assessment?.scoreAccuracy)
    .filter((n): n is number => typeof n === 'number');

  const selfReport: number[] = [];
  const algo: number[] = [];
  for (const row of rows) {
    const self = row.pre_assessment?.overallCompatibility;
    const score = row.compatibility_score;
    if (typeof self === 'number' && typeof score === 'number') {
      selfReport.push(self);
      algo.push(score * 10);
    }
  }
  const correlation = pearson(selfReport, algo);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#5BA8E8" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.heading}>Relationship validation cohort</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.stat}>Participants: {rows.length}</Text>
      <Text style={styles.stat}>Couples both completed: {couplesBothComplete}</Text>
      <Text style={styles.stat}>
        Avg pre-assessment compatibility (1–10):{' '}
        {avg(preCompat)?.toFixed(2) ?? '—'}
      </Text>
      <Text style={styles.stat}>
        Avg post-assessment score accuracy (1–10):{' '}
        {avg(postAccuracy)?.toFixed(2) ?? '—'}
      </Text>
      <Text style={styles.stat}>
        Correlation (self-report compatibility vs algorithm score):{' '}
        {correlation != null ? correlation.toFixed(3) : '—'}
        {selfReport.length > 0 ? ` (n=${selfReport.length})` : ''}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  heading: { color: '#E8F0F8', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  stat: { color: '#C8E4FF', fontSize: 15, lineHeight: 24, marginBottom: 8 },
  error: { color: '#E85B5B', marginBottom: 12 },
});
