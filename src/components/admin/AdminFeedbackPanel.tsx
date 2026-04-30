import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@data/supabase/client';

const BUG = 'Something broke';
const SUG = 'Suggestion';
const CMP = 'Compliment';
const OTH = 'Other';

const CATEGORY_CHIPS: { id: string | null; label: string }[] = [
  { id: null, label: 'All categories' },
  { id: BUG, label: 'Something broke' },
  { id: SUG, label: 'Suggestion' },
  { id: CMP, label: 'Compliment' },
  { id: OTH, label: 'Other' },
];

const RATING_CHIPS: { id: number | null; label: string }[] = [
  { id: null, label: 'All stars' },
  { id: 1, label: '1' },
  { id: 2, label: '2' },
  { id: 3, label: '3' },
  { id: 4, label: '4' },
  { id: 5, label: '5' },
];

type Row = {
  id: string;
  created_at: string;
  attempt_id: string | null;
  user_id: string | null;
  category: string | null;
  message: string;
  rating: number | null;
  page_context: string | null;
  user_agent: string | null;
};

const PAGE = 25;

function truncateId(id: string | null | undefined, head = 8, tail = 4): string {
  if (!id) return '—';
  if (id.length <= head + tail + 1) return id;
  return `${id.slice(0, head)}…${id.slice(-tail)}`;
}

function truncateText(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

type TranscriptLine = { role: string; content?: string };

function parseFeedbackTranscript(raw: unknown): TranscriptLine[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as TranscriptLine[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as TranscriptLine[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function firstUserAnswerFromTranscript(raw: unknown): string | null {
  const lines = parseFeedbackTranscript(raw);
  const u = lines.find(
    (m) =>
      (m.role === 'user' || m.role === 'User') && typeof m.content === 'string' && m.content.trim().length > 0,
  );
  return u?.content?.trim() ?? null;
}

type UserEnrichRow = { email: string; intro: string };

function meanRatings(ratings: (number | null)[]): number | null {
  const nums = ratings.filter((r): r is number => r != null && r >= 1 && r <= 5);
  if (nums.length === 0) return null;
  return Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 10) / 10;
}

export function AdminFeedbackPanel() {
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  const [messageSearch, setMessageSearch] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [statTotal, setStatTotal] = useState(0);
  const [statBugs, setStatBugs] = useState(0);
  const [statSug, setStatSug] = useState(0);
  const [statCmp, setStatCmp] = useState(0);
  const [statAvg, setStatAvg] = useState<number | null>(null);
  const [statCap, setStatCap] = useState(false);
  const [userEnrich, setUserEnrich] = useState<Record<string, UserEnrichRow>>({});

  const searchTrim = messageSearch.trim();

  const runStats = useCallback(async () => {
    const buildBase = () => {
      let q = supabase.from('interview_feedback').select('id', { count: 'exact', head: true });
      if (categoryFilter) q = q.eq('category', categoryFilter);
      if (ratingFilter != null) q = q.eq('rating', ratingFilter);
      if (searchTrim) q = q.ilike('message', `%${searchTrim}%`);
      return q;
    };
    const [tRes, bRes, sRes, cRes, rAll] = await Promise.all([
      buildBase(),
      (() => {
        if (categoryFilter && categoryFilter !== BUG) {
          return Promise.resolve({ count: 0, error: null } as { count: number; error: null });
        }
        let q = supabase.from('interview_feedback').select('id', { count: 'exact', head: true }).eq('category', BUG);
        if (ratingFilter != null) q = q.eq('rating', ratingFilter);
        if (searchTrim) q = q.ilike('message', `%${searchTrim}%`);
        return q;
      })(),
      (() => {
        if (categoryFilter && categoryFilter !== SUG) {
          return Promise.resolve({ count: 0, error: null } as { count: number; error: null });
        }
        let q = supabase.from('interview_feedback').select('id', { count: 'exact', head: true }).eq('category', SUG);
        if (ratingFilter != null) q = q.eq('rating', ratingFilter);
        if (searchTrim) q = q.ilike('message', `%${searchTrim}%`);
        return q;
      })(),
      (() => {
        if (categoryFilter && categoryFilter !== CMP) {
          return Promise.resolve({ count: 0, error: null } as { count: number; error: null });
        }
        let q = supabase.from('interview_feedback').select('id', { count: 'exact', head: true }).eq('category', CMP);
        if (ratingFilter != null) q = q.eq('rating', ratingFilter);
        if (searchTrim) q = q.ilike('message', `%${searchTrim}%`);
        return q;
      })(),
      (() => {
        let q = supabase
          .from('interview_feedback')
          .select('rating, category, id')
          .range(0, 19999);
        if (categoryFilter) q = q.eq('category', categoryFilter);
        if (ratingFilter != null) q = q.eq('rating', ratingFilter);
        if (searchTrim) q = q.ilike('message', `%${searchTrim}%`);
        return q;
      })(),
    ]);
    if (tRes.error) {
      return { err: tRes.error.message } as const;
    }
    setStatTotal(tRes.count ?? 0);
    if (!bRes.error && bRes.count != null) setStatBugs(bRes.count);
    if (!sRes.error && sRes.count != null) setStatSug(sRes.count);
    if (!cRes.error && cRes.count != null) setStatCmp(cRes.count);
    if (rAll.error) {
      return { err: rAll.error.message } as const;
    }
    const d = (rAll.data as { id: string; category: string | null; rating: number | null }[] | null) ?? [];
    setStatCap(d.length > 0 && (tRes.count ?? 0) > 20000);
    const avg = meanRatings(d.map((r) => r.rating));
    setStatAvg(avg);
    return { err: null } as const;
  }, [categoryFilter, ratingFilter, searchTrim]);

  const runTable = useCallback(async () => {
    let q = supabase.from('interview_feedback').select('*', { count: 'exact' });
    if (categoryFilter) q = q.eq('category', categoryFilter);
    if (ratingFilter != null) q = q.eq('rating', ratingFilter);
    if (searchTrim) q = q.ilike('message', `%${searchTrim}%`);
    const from = page * PAGE;
    const to = from + PAGE - 1;
    const { data, error: qe, count } = await q.order('created_at', { ascending: false }).range(from, to);
    if (qe) return { err: qe.message, rows: null as Row[] | null, total: 0 } as const;
    setTotal(count ?? 0);
    setRows((data as Row[] | null) ?? []);
    return { err: null, rows: data, total: count } as const;
  }, [categoryFilter, ratingFilter, searchTrim, page]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const s = await runStats();
    if (s.err) {
      setError(s.err);
    }
    const t = await runTable();
    if (t.err) {
      setError(t.err);
    }
    setLoading(false);
  }, [runStats, runTable]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const ids = [...new Set(rows.map((r) => r.user_id).filter((x): x is string => typeof x === 'string' && !!x))];
    if (ids.length === 0) {
      setUserEnrich({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, name, interview_transcript')
        .in('id', ids);
      if (cancelled || error) return;
      const next: Record<string, UserEnrichRow> = {};
      for (const row of data ?? []) {
        const o = row as { id: string; email: string | null; name: string | null; interview_transcript: unknown };
        const intro = o.name?.trim() || firstUserAnswerFromTranscript(o.interview_transcript) || '—';
        next[o.id] = { email: o.email ?? '—', intro };
      }
      if (!cancelled) setUserEnrich(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  const onRefresh = useCallback(() => {
    setExpandedId(null);
    void loadAll();
  }, [loadAll]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE));

  const tableHint = useMemo(
    () =>
      total === 0
        ? '0 rows'
        : `Page ${page + 1} of ${totalPages} — showing ${rows.length} of ${total} row${total === 1 ? '' : 's'}`,
    [total, totalPages, page, rows.length],
  );

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.sectionTitle}>Feedback</Text>
        <TouchableOpacity onPress={onRefresh} accessibilityRole="button" style={styles.refreshBtn}>
          <Ionicons name="refresh" size={18} color="#7A9ABE" />
          <Text style={styles.refreshText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errBanner}>
          <Text style={styles.errText} selectable>
            {error}
          </Text>
        </View>
      ) : null}

      <View style={styles.statRow}>
        <View style={styles.statPill}>
          <Text style={styles.statVal}>{statTotal}</Text>
          <Text style={styles.statLbl}>Total (filtered)</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statVal}>{statAvg != null ? statAvg : '—'}</Text>
          <Text style={styles.statLbl}>Avg stars{statCap ? ' (cap 20k)' : ''}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statVal}>{statBugs}</Text>
          <Text style={styles.statLbl}>Bugs</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statVal}>{statSug}</Text>
          <Text style={styles.statLbl}>Suggestions</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={styles.statVal}>{statCmp}</Text>
          <Text style={styles.statLbl}>Compliments</Text>
        </View>
      </View>

      <View style={styles.filterBlock}>
        <Text style={styles.filterBarLabel}>Category</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {CATEGORY_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.id ?? 'all-cat'}
              style={[styles.filterChip, (categoryFilter === c.id || (c.id == null && categoryFilter == null)) && styles.filterChipActive]}
              onPress={() => {
                setPage(0);
                setCategoryFilter(c.id);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  (categoryFilter === c.id || (c.id == null && categoryFilter == null)) && styles.filterChipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.filterBarLabel, { marginTop: 10 }]}>Star rating</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterChipsRow}
        >
          {RATING_CHIPS.map((c) => (
            <TouchableOpacity
              key={c.id == null ? 'all-r' : `r-${c.id}`}
              style={[
                styles.filterChip,
                (ratingFilter === c.id || (c.id == null && ratingFilter == null)) && styles.filterChipActive,
              ]}
              onPress={() => {
                setPage(0);
                setRatingFilter(c.id);
              }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  (ratingFilter === c.id || (c.id == null && ratingFilter == null)) && styles.filterChipTextActive,
                ]}
              >
                {c.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={[styles.filterBarLabel, { marginTop: 10 }]}>Search message</Text>
        <TextInput
          value={messageSearch}
          onChangeText={(t) => {
            setMessageSearch(t);
            setPage(0);
          }}
          placeholder="Filter by message (contains)…"
          placeholderTextColor="rgba(122, 154, 190, 0.45)"
          style={styles.searchInput}
        />
      </View>

      {loading ? (
        <View style={styles.loadWrap}>
          <ActivityIndicator color="#7A9ABE" />
        </View>
      ) : (
        <>
          <Text style={styles.pagerText}>{tableHint}</Text>
          <ScrollView horizontal contentContainerStyle={styles.tableScroll}>
            <View>
              <View style={styles.trHead}>
                <Text style={[styles.th, styles.cDate]}>Date</Text>
                <Text style={[styles.th, styles.cIntro]}>Intro name</Text>
                <Text style={[styles.th, styles.cEmail]}>Email</Text>
                <Text style={[styles.th, styles.cCat]}>Category</Text>
                <Text style={[styles.th, styles.cRating]}>Rating</Text>
                <Text style={[styles.th, styles.cMsg]}>Message</Text>
                <Text style={[styles.th, styles.cAttempt]}>Attempt</Text>
              </View>
              {rows.length === 0 ? (
                <Text style={styles.emptyText}>No feedback rows for these filters.</Text>
              ) : (
                rows.map((r) => {
                  const isOpen = expandedId === r.id;
                  const uid = r.user_id ?? '';
                  const en = uid ? userEnrich[uid] : undefined;
                  return (
                    <View key={r.id}>
                      <Pressable
                        onPress={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                        style={({ pressed }) => [styles.tr, pressed && styles.trPress]}
                      >
                        <Text style={[styles.td, styles.cDate]}>
                          {new Date(r.created_at).toLocaleString(undefined, {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                        <Text style={[styles.td, styles.cIntro]} numberOfLines={2}>
                          {en?.intro ?? '—'}
                        </Text>
                        <Text style={[styles.td, styles.cEmail]} numberOfLines={2}>
                          {en?.email ?? '—'}
                        </Text>
                        <View style={styles.cCat}>
                          <View style={styles.badge}>
                            <Text style={styles.badgeText} numberOfLines={1}>
                              {r.category ?? '—'}
                            </Text>
                          </View>
                        </View>
                        <View style={[styles.cRating, styles.starCell]}>
                          {r.rating != null
                            ? Array.from({ length: 5 }, (_, i) => (
                                <Ionicons
                                  key={i}
                                  name={i < r.rating! ? 'star' : 'star-outline'}
                                  size={14}
                                  color={i < r.rating! ? '#FBBF24' : 'rgba(122, 154, 190, 0.35)'}
                                />
                              ))
                            : (
                            <Text style={styles.muted}>—</Text>
                            )}
                        </View>
                        <Text style={[styles.td, styles.cMsg]} numberOfLines={2}>
                          {truncateText(r.message, 120)}
                        </Text>
                        <Text style={[styles.td, styles.cAttempt]} numberOfLines={1}>
                          {truncateId(r.attempt_id, 6, 4)}
                        </Text>
                      </Pressable>
                      {isOpen ? (
                        <View style={styles.expanded}>
                          <Text style={styles.expandedTitle}>Full message</Text>
                          <Text style={styles.expandedBody} selectable>
                            {r.message}
                          </Text>
                          <View style={styles.metaGrid}>
                            <Text style={styles.metaK}>id</Text>
                            <Text style={styles.metaV} selectable>
                              {r.id}
                            </Text>
                            <Text style={styles.metaK}>Email</Text>
                            <Text style={styles.metaV} selectable>
                              {en?.email ?? '—'}
                            </Text>
                            <Text style={styles.metaK}>Intro (first answer / name)</Text>
                            <Text style={styles.metaV} selectable>
                              {en?.intro ?? '—'}
                            </Text>
                            <Text style={styles.metaK}>user_id</Text>
                            <Text style={styles.metaV} selectable>
                              {r.user_id ?? '—'}
                            </Text>
                            <Text style={styles.metaK}>attempt_id</Text>
                            <Text style={styles.metaV} selectable>
                              {r.attempt_id ?? '—'}
                            </Text>
                            <Text style={styles.metaK}>page_context</Text>
                            <Text style={styles.metaV} selectable>
                              {r.page_context ?? '—'}
                            </Text>
                            <Text style={styles.metaK}>user_agent</Text>
                            <Text style={styles.metaV} selectable>
                              {r.user_agent ?? '—'}
                            </Text>
                            <Text style={styles.metaK}>created_at</Text>
                            <Text style={styles.metaV} selectable>
                              {r.created_at}
                            </Text>
                          </View>
                        </View>
                      ) : null}
                    </View>
                  );
                })
              )}
            </View>
          </ScrollView>
          {total > PAGE ? (
            <View style={styles.pagerRow}>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0}
                style={[styles.pagerBtn, page <= 0 && styles.pagerBtnOff]}
              >
                <Text style={styles.pagerBtnText}>Previous</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                style={[styles.pagerBtn, page >= totalPages - 1 && styles.pagerBtnOff]}
              >
                <Text style={styles.pagerBtnText}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, padding: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sectionTitle: { color: '#C8E4FF', fontSize: 16, fontWeight: '500' },
  refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 4 },
  refreshText: { color: '#7A9ABE', fontSize: 12 },
  errBanner: { marginBottom: 10, padding: 10, backgroundColor: 'rgba(180, 80, 80, 0.12)', borderRadius: 8 },
  errText: { color: '#E87A7A', fontSize: 12 },
  statRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  statPill: {
    backgroundColor: 'rgba(13,17,32,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    minWidth: 88,
  },
  statVal: { color: '#E8F0F8', fontSize: 16, fontWeight: '600' },
  statLbl: { color: '#7A9ABE', fontSize: 10, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  filterBlock: { marginBottom: 8 },
  filterBarLabel: {
    color: '#7A9ABE',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  filterChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center', paddingBottom: 2 },
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
  filterChipText: { color: '#7A9ABE', fontSize: 12, fontWeight: '500' },
  filterChipTextActive: { color: '#C8E4FF' },
  searchInput: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 8,
    color: '#E8F0F8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: 'rgba(5,6,13,0.4)',
  },
  loadWrap: { padding: 32, alignItems: 'center' },
  pagerText: { color: '#7A9ABE', fontSize: 11, marginBottom: 8 },
  tableScroll: { minWidth: '100%' as unknown as number },
  trHead: { flexDirection: 'row', borderBottomWidth: 1, borderColor: 'rgba(82,142,220,0.15)', paddingBottom: 8, marginBottom: 4, minWidth: 1000 },
  th: { color: '#7A9ABE', fontSize: 10, fontWeight: '600', textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderColor: 'rgba(82,142,220,0.08)', paddingVertical: 10, alignItems: 'flex-start', minWidth: 1000 },
  trPress: { backgroundColor: 'rgba(30,111,217,0.06)' },
  td: { color: '#C8D8EC', fontSize: 12 },
  cDate: { width: 150 },
  cIntro: { width: 120, paddingRight: 6 },
  cEmail: { width: 180, paddingRight: 6 },
  cCat: { width: 120, paddingRight: 6 },
  cRating: { width: 110 },
  cMsg: { flex: 1, minWidth: 200, paddingRight: 8 },
  cAttempt: { width: 100 },
  starCell: { flexDirection: 'row', flexWrap: 'wrap' },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.3)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: 'rgba(30,111,217,0.1)',
  },
  badgeText: { color: '#9BB0CC', fontSize: 11, maxWidth: 120 },
  expanded: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginLeft: 0,
    backgroundColor: 'rgba(5,6,13,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    borderRadius: 8,
    marginBottom: 4,
  },
  expandedTitle: { color: '#7A9ABE', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  expandedBody: { color: '#E8F0F8', fontSize: 13, lineHeight: 20, marginBottom: 10 },
  metaGrid: { marginTop: 4 },
  metaK: { color: '#5C7A9E', fontSize: 10, textTransform: 'uppercase' },
  metaV: { color: '#8FA8C2', fontSize: 12, marginBottom: 6 },
  muted: { color: 'rgba(122, 154, 190, 0.6)', fontSize: 12 },
  emptyText: { color: '#7A9ABE', padding: 20 },
  pagerRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
  pagerBtn: { borderWidth: 1, borderColor: 'rgba(82,142,220,0.35)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 16, backgroundColor: 'rgba(13,17,32,0.8)' },
  pagerBtnOff: { opacity: 0.35 },
  pagerBtnText: { color: '#C8E4FF', fontSize: 12 },
});
