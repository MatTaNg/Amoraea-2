import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import {
  fetchAdminCompatibilityDirectory,
  filterDirectorySuggestions,
  resolveDirectoryUser,
  runAdminBatchMatching,
  scoreAdminPair,
  type AdminBatchMatchResult,
  type AdminCompatDirectoryUser,
  type AdminPairScoreResult,
} from '@features/compatibility/adminCompatibilityMatching';
import { formatCompatibilityPercent } from '@features/compatibility/pairCompatibilityPresentation';

function UserAutocomplete({
  label,
  value,
  onChangeText,
  onSelectUser,
  directory,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onSelectUser: (user: AdminCompatDirectoryUser) => void;
  directory: AdminCompatDirectoryUser[];
}) {
  const [focused, setFocused] = useState(false);
  const suggestions = focused ? filterDirectorySuggestions(directory, value) : [];

  return (
    <View style={styles.autocompleteBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder="Email or phone number"
        placeholderTextColor="#5A7090"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {suggestions.length > 0 ? (
        <View style={styles.suggestions}>
          {suggestions.map((u) => (
            <Pressable
              key={u.id}
              style={styles.suggestionRow}
              onPress={() => {
                onSelectUser(u);
                setFocused(false);
              }}
            >
              <Text style={styles.suggestionLabel}>{u.displayLabel}</Text>
              <Text style={styles.suggestionMeta}>
                {[u.email, u.phone].filter(Boolean).join(' · ')}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ScoreBadge({ score, dealbreakerFailed }: { score: number; dealbreakerFailed: boolean }) {
  return (
    <View style={styles.scoreBadgeRow}>
      <Text style={[styles.scoreBadge, dealbreakerFailed && styles.scoreBadgeDealbreaker]}>
        {formatCompatibilityPercent(score)}
      </Text>
      {dealbreakerFailed ? (
        <View style={styles.dealbreakerFailBadge}>
          <Text style={styles.dealbreakerFailText}>FAIL — dealbreaker</Text>
        </View>
      ) : null}
    </View>
  );
}

function DealbreakerList({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return null;
  return (
    <View style={styles.dealbreakerBox}>
      <Text style={styles.dealbreakerTitle}>Dealbreakers (auto-fail)</Text>
      {reasons.map((r, i) => (
        <Text key={i} style={styles.dealbreakerItem}>
          • {r}
        </Text>
      ))}
    </View>
  );
}

function PairDetailPanel({ pair }: { pair: AdminPairScoreResult }) {
  const { result, insights, dealbreakerReasons, dealbreakerFailed, preDealbreakerScore } = pair;
  const displayScore = dealbreakerFailed ? preDealbreakerScore : result.finalScore;

  return (
    <View style={styles.detailPanel}>
      <View style={styles.pairHeader}>
        <View style={styles.pairUserCol}>
          <Text style={styles.pairUserName}>{pair.userA.displayLabel}</Text>
          <Text style={styles.pairUserMeta}>{pair.userA.email ?? pair.userA.phone ?? pair.userA.id}</Text>
        </View>
        <ScoreBadge score={displayScore} dealbreakerFailed={dealbreakerFailed} />
        <View style={[styles.pairUserCol, styles.pairUserColRight]}>
          <Text style={[styles.pairUserName, styles.textRight]}>{pair.userB.displayLabel}</Text>
          <Text style={[styles.pairUserMeta, styles.textRight]}>
            {pair.userB.email ?? pair.userB.phone ?? pair.userB.id}
          </Text>
        </View>
      </View>

      <DealbreakerList reasons={dealbreakerReasons} />

      <Text style={styles.subsectionTitle}>Subscores</Text>
      <View style={styles.subscoreGrid}>
        {(
          [
            ['Attachment', result.subscores.attachment],
            ['Values', result.subscores.values],
            ['Semantic', result.subscores.semantic],
            ['Finance', result.subscores.finance],
            ['Interview', result.subscores.interviewProcess],
          ] as const
        ).map(([label, val]) => (
          <View key={label} style={styles.subscorePill}>
            <Text style={styles.subscoreVal}>{formatCompatibilityPercent(val)}</Text>
            <Text style={styles.subscoreLbl}>{label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.subsectionTitle}>Why this match</Text>
      {insights.map((insight, i) => (
        <View
          key={i}
          style={[
            styles.insightRow,
            insight.kind === 'strength' && styles.insightStrength,
            insight.kind === 'concern' && styles.insightConcern,
          ]}
        >
          <Text style={styles.insightText}>{insight.text}</Text>
        </View>
      ))}

      <Text style={styles.subsectionTitle}>Breakdown</Text>
      <View style={styles.breakdownList}>
        <Text style={styles.breakdownLine}>
          Attachment + Values + Semantic + Finance + Interview + Baseline − Capacity + Adjustments
        </Text>
        <Text style={styles.breakdownLine}>
          = {formatCompatibilityPercent(result.breakdown.attachment)} +{' '}
          {formatCompatibilityPercent(result.breakdown.values)} +{' '}
          {formatCompatibilityPercent(result.breakdown.semantic)} +{' '}
          {formatCompatibilityPercent(result.breakdown.finance)} +{' '}
          {formatCompatibilityPercent(result.breakdown.interviewProcess)} +{' '}
          {formatCompatibilityPercent(result.breakdown.baseline)} −{' '}
          {formatCompatibilityPercent(result.breakdown.capacityDiscount)} +{' '}
          {formatCompatibilityPercent(result.breakdown.adjustments)}
        </Text>
        {dealbreakerFailed ? (
          <Text style={styles.breakdownDealbreaker}>
            Effective score forced to 0% by dealbreaker multiplier (hypothetical{' '}
            {formatCompatibilityPercent(preDealbreakerScore)} without dealbreaker).
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function BatchResults({ result }: { result: AdminBatchMatchResult }) {
  if (
    result.pairs.length === 0 &&
    result.unmatched.length === 0 &&
    result.notFound.length === 0 &&
    result.profileIncomplete.length === 0
  ) {
    return null;
  }

  return (
    <View style={styles.resultsBlock}>
      {result.notFound.length > 0 ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Not found</Text>
          <Text style={styles.warnText}>{result.notFound.join(', ')}</Text>
        </View>
      ) : null}
      {result.profileIncomplete.length > 0 ? (
        <View style={styles.warnBox}>
          <Text style={styles.warnTitle}>Profile incomplete (skipped)</Text>
          <Text style={styles.warnText}>{result.profileIncomplete.join(', ')}</Text>
        </View>
      ) : null}
      {result.duplicateIdentifiers.length > 0 ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>Skipped duplicates: {result.duplicateIdentifiers.join(', ')}</Text>
        </View>
      ) : null}

      {result.pairs.length > 0 ? (
        <>
          <Text style={styles.resultsTitle}>
            Matched pairs ({result.pairs.length}) — highest compatibility first
          </Text>
          {result.pairs.map((pair) => (
            <View key={`${pair.userA.id}-${pair.userB.id}`} style={styles.batchPairCard}>
              <Text style={styles.batchRank}>#{pair.rank}</Text>
              <PairDetailPanel pair={pair} />
            </View>
          ))}
        </>
      ) : null}

      {result.unmatched.length > 0 ? (
        <View style={styles.unmatchedBox}>
          <Text style={styles.unmatchedTitle}>Unmatched ({result.unmatched.length})</Text>
          {result.unmatched.map((u) => (
            <Text key={u.id} style={styles.unmatchedItem}>
              {u.displayLabel} — {u.email ?? u.phone ?? u.id}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type ListPickTarget = 'A' | 'B' | 'batch';

function userIdentifier(user: AdminCompatDirectoryUser): string {
  return user.email ?? user.phone ?? user.displayLabel;
}

function UserDirectoryPanel({
  users,
  loading,
  searchQuery,
  onSearchChange,
  selectedAId,
  selectedBId,
  pickTarget,
  onPickTargetChange,
  onSelectUser,
  onAddToBatch,
}: {
  users: AdminCompatDirectoryUser[];
  loading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedAId: string | null;
  selectedBId: string | null;
  pickTarget: ListPickTarget;
  onPickTargetChange: (target: ListPickTarget) => void;
  onSelectUser: (user: AdminCompatDirectoryUser, target: ListPickTarget) => void;
  onAddToBatch: (user: AdminCompatDirectoryUser) => void;
}) {
  const filtered = useMemo(() => {
    const base = !searchQuery.trim()
      ? users
      : filterDirectorySuggestions(users, searchQuery, 10_000);
    return [...base].sort((a, b) => a.displayLabel.localeCompare(b.displayLabel));
  }, [users, searchQuery]);

  return (
    <View style={styles.userListPane}>
      <View style={styles.userListHeader}>
        <Text style={styles.userListTitle}>All users</Text>
        <Text style={styles.userListCount}>{filtered.length}</Text>
      </View>
      <Text style={styles.userListHint}>
        Match-ready users only (complete dating profile). Click a row to fill the active slot, or use row actions.
      </Text>
      <View style={styles.pickTargetRow}>
        {(['A', 'B', 'batch'] as const).map((target) => (
          <TouchableOpacity
            key={target}
            style={[styles.pickTargetChip, pickTarget === target && styles.pickTargetChipActive]}
            onPress={() => onPickTargetChange(target)}
          >
            <Text style={[styles.pickTargetChipText, pickTarget === target && styles.pickTargetChipTextActive]}>
              {target === 'batch' ? 'Batch' : `User ${target}`}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        style={styles.userListSearch}
        value={searchQuery}
        onChangeText={onSearchChange}
        placeholder="Filter by name, email, or phone"
        placeholderTextColor="#5A7090"
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <View style={styles.userListLoading}>
          <ActivityIndicator size="small" color="#7A9ABE" />
        </View>
      ) : (
        <ScrollView style={styles.userListScroll} contentContainerStyle={styles.userListScrollContent}>
          {filtered.length === 0 ? (
            <Text style={styles.userListEmpty}>No users match your filter.</Text>
          ) : (
            filtered.map((user) => {
              const isA = user.id === selectedAId;
              const isB = user.id === selectedBId;
              return (
                <Pressable
                  key={user.id}
                  style={({ pressed }) => [
                    styles.userListRow,
                    (isA || isB) && styles.userListRowSelected,
                    pressed && styles.userListRowPressed,
                  ]}
                  onPress={() => onSelectUser(user, pickTarget)}
                >
                  <View style={styles.userListRowMain}>
                    <View style={styles.userListNameRow}>
                      <Text style={styles.userListName} numberOfLines={1}>
                        {user.displayLabel}
                      </Text>
                      {isA ? (
                        <View style={[styles.userListSlotBadge, styles.userListSlotBadgeA]}>
                          <Text style={styles.userListSlotBadgeText}>A</Text>
                        </View>
                      ) : null}
                      {isB ? (
                        <View style={[styles.userListSlotBadge, styles.userListSlotBadgeB]}>
                          <Text style={styles.userListSlotBadgeText}>B</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.userListEmail} numberOfLines={1}>
                      {user.email ?? '—'}
                    </Text>
                    {user.phone ? (
                      <Text style={styles.userListPhone} numberOfLines={1}>
                        {user.phone}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.userListActions}>
                    <TouchableOpacity
                      style={styles.userListActionBtn}
                      onPress={() => onSelectUser(user, 'A')}
                      accessibilityLabel={`Set ${user.displayLabel} as User A`}
                    >
                      <Text style={styles.userListActionText}>A</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.userListActionBtn}
                      onPress={() => onSelectUser(user, 'B')}
                      accessibilityLabel={`Set ${user.displayLabel} as User B`}
                    >
                      <Text style={styles.userListActionText}>B</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.userListActionBtn}
                      onPress={() => onAddToBatch(user)}
                      accessibilityLabel={`Add ${user.displayLabel} to batch list`}
                    >
                      <Text style={styles.userListActionText}>+</Text>
                    </TouchableOpacity>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

export function CompatibilityTab() {
  const [directory, setDirectory] = useState<AdminCompatDirectoryUser[]>([]);
  const [directoryError, setDirectoryError] = useState<string | null>(null);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const [batchInput, setBatchInput] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResult, setBatchResult] = useState<AdminBatchMatchResult | null>(null);

  const [userAInput, setUserAInput] = useState('');
  const [userBInput, setUserBInput] = useState('');
  const [selectedA, setSelectedA] = useState<AdminCompatDirectoryUser | null>(null);
  const [selectedB, setSelectedB] = useState<AdminCompatDirectoryUser | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [pairResult, setPairResult] = useState<AdminPairScoreResult | null>(null);
  const [listSearchQuery, setListSearchQuery] = useState('');
  const [pickTarget, setPickTarget] = useState<ListPickTarget>('A');

  const applyUserToSlot = useCallback((user: AdminCompatDirectoryUser, slot: 'A' | 'B') => {
    const token = userIdentifier(user);
    if (slot === 'A') {
      setSelectedA(user);
      setUserAInput(token);
    } else {
      setSelectedB(user);
      setUserBInput(token);
    }
  }, []);

  const handleListSelectUser = useCallback(
    (user: AdminCompatDirectoryUser, target: ListPickTarget) => {
      if (target === 'batch') {
        const token = user.email ?? user.phone;
        if (!token) return;
        setBatchInput((prev) => {
          const lines = prev
            .split(/[\n,;]+/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (lines.some((line) => line.toLowerCase() === token.toLowerCase())) return prev;
          return prev.trim() ? `${prev.trim()}\n${token}` : token;
        });
        return;
      }
      applyUserToSlot(user, target);
      setPickTarget(target === 'A' ? 'B' : 'A');
    },
    [applyUserToSlot],
  );

  const handleAddToBatch = useCallback((user: AdminCompatDirectoryUser) => {
    handleListSelectUser(user, 'batch');
  }, [handleListSelectUser]);

  const loadDirectory = useCallback(async () => {
    setDirectoryLoading(true);
    setDirectoryError(null);
    try {
      const rows = await fetchAdminCompatibilityDirectory();
      setDirectory(rows);
    } catch (e) {
      setDirectoryError(e instanceof Error ? e.message : 'Failed to load user directory');
    } finally {
      setDirectoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const handleBatchMatch = async () => {
    setBatchLoading(true);
    setBatchError(null);
    setBatchResult(null);
    try {
      const result = await runAdminBatchMatching(batchInput);
      setBatchResult(result);
    } catch (e) {
      setBatchError(e instanceof Error ? e.message : 'Batch matching failed');
    } finally {
      setBatchLoading(false);
    }
  };

  const resolveFromInput = (input: string, selected: AdminCompatDirectoryUser | null) => {
    if (selected) {
      const token = input.trim().toLowerCase();
      if (
        !token ||
        selected.email?.toLowerCase() === token ||
        selected.phone === input.trim() ||
        selected.displayLabel.toLowerCase() === token
      ) {
        return selected;
      }
    }
    return resolveDirectoryUser(directory, input);
  };

  const handlePairCompare = async () => {
    setPairLoading(true);
    setPairError(null);
    setPairResult(null);
    try {
      const userA = selectedA ?? resolveFromInput(userAInput, selectedA);
      const userB = selectedB ?? resolveFromInput(userBInput, selectedB);
      if (!userA) throw new Error('Could not resolve User A — pick a match-ready user from the list or enter exact email/phone.');
      if (!userB) throw new Error('Could not resolve User B — pick a match-ready user from the list or enter exact email/phone.');
      if (userA.id === userB.id) throw new Error('Select two different users.');
      const result = await scoreAdminPair(userA, userB);
      setPairResult(result);
    } catch (e) {
      setPairError(e instanceof Error ? e.message : 'Pair comparison failed');
    } finally {
      setPairLoading(false);
    }
  };

  return (
    <View style={styles.splitRoot}>
      <ScrollView style={styles.mainPane} contentContainerStyle={styles.mainContent}>
        <View style={styles.headerRow}>
          <Text style={styles.pageTitle}>Compatibility matching</Text>
          <TouchableOpacity onPress={() => void loadDirectory()} style={styles.refreshBtn}>
            {directoryLoading ? (
              <ActivityIndicator size="small" color="#7A9ABE" />
            ) : (
              <Text style={styles.refreshText}>Refresh directory</Text>
            )}
          </TouchableOpacity>
        </View>
        <Text style={styles.pageSubtitle}>
          Score pairs using the v2 compatibility algorithm. Only users with a fully completed dating profile
          appear here. Dealbreakers auto-fail a match but still show the hypothetical score.
        </Text>

        {directoryError ? (
          <View style={styles.errBanner}>
            <Text style={styles.errText}>{directoryError}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Batch match</Text>
          <Text style={styles.sectionHint}>
            Paste emails or phone numbers (one per line, or comma-separated). Each user gets at most one match;
            pairs are ranked highest to lowest compatibility. Incomplete profiles are skipped automatically.
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={batchInput}
            onChangeText={setBatchInput}
            placeholder={'alice@example.com\nbob@example.com\n+15551234567'}
            placeholderTextColor="#5A7090"
            multiline
            numberOfLines={6}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, batchLoading && styles.primaryBtnDisabled]}
            onPress={() => void handleBatchMatch()}
            disabled={batchLoading || !batchInput.trim()}
          >
            {batchLoading ? (
              <ActivityIndicator size="small" color="#E8F0F8" />
            ) : (
              <Text style={styles.primaryBtnText}>Run batch match</Text>
            )}
          </TouchableOpacity>
          {batchError ? (
            <View style={styles.errBanner}>
              <Text style={styles.errText}>{batchError}</Text>
            </View>
          ) : null}
          {batchResult ? <BatchResults result={batchResult} /> : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Compare two users</Text>
          <Text style={styles.sectionHint}>
            Start typing an email or phone number for autocomplete, pick from the user list, then compare for a
            detailed breakdown.
          </Text>
          <UserAutocomplete
            label="User A"
            value={userAInput}
            onChangeText={(v) => {
              setUserAInput(v);
              setSelectedA(null);
            }}
            onSelectUser={(u) => {
              applyUserToSlot(u, 'A');
            }}
            directory={directory}
          />
          <UserAutocomplete
            label="User B"
            value={userBInput}
            onChangeText={(v) => {
              setUserBInput(v);
              setSelectedB(null);
            }}
            onSelectUser={(u) => {
              applyUserToSlot(u, 'B');
            }}
            directory={directory}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, pairLoading && styles.primaryBtnDisabled]}
            onPress={() => void handlePairCompare()}
            disabled={pairLoading || (!userAInput.trim() && !selectedA) || (!userBInput.trim() && !selectedB)}
          >
            {pairLoading ? (
              <ActivityIndicator size="small" color="#E8F0F8" />
            ) : (
              <Text style={styles.primaryBtnText}>Compare pair</Text>
            )}
          </TouchableOpacity>
          {pairError ? (
            <View style={styles.errBanner}>
              <Text style={styles.errText}>{pairError}</Text>
            </View>
          ) : null}
          {pairResult ? <PairDetailPanel pair={pairResult} /> : null}
        </View>
      </ScrollView>

      <UserDirectoryPanel
        users={directory}
        loading={directoryLoading}
        searchQuery={listSearchQuery}
        onSearchChange={setListSearchQuery}
        selectedAId={selectedA?.id ?? null}
        selectedBId={selectedB?.id ?? null}
        pickTarget={pickTarget}
        onPickTargetChange={setPickTarget}
        onSelectUser={handleListSelectUser}
        onAddToBatch={handleAddToBatch}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  splitRoot: { flex: 1, flexDirection: 'row', minHeight: 0 },
  mainPane: { flex: 1, minWidth: 0 },
  mainContent: { padding: 20, paddingBottom: 48 },
  userListPane: {
    flex: 1,
    minWidth: 0,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(82,142,220,0.2)',
    backgroundColor: 'rgba(8,10,20,0.6)',
    paddingTop: 16,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  userListHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  userListTitle: { color: '#C8E4FF', fontSize: 15, fontWeight: '600' },
  userListCount: { color: '#7A9ABE', fontSize: 12, fontWeight: '600' },
  userListHint: { color: '#7A9ABE', fontSize: 11, lineHeight: 16, marginBottom: 10 },
  pickTargetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  pickTargetChip: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.22)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pickTargetChipActive: {
    backgroundColor: 'rgba(30,111,217,0.2)',
    borderColor: 'rgba(82,142,220,0.45)',
  },
  pickTargetChipText: { color: '#7A9ABE', fontSize: 11, fontWeight: '600' },
  pickTargetChipTextActive: { color: '#C8E4FF' },
  userListSearch: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 8,
    color: '#E8F0F8',
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 12,
    backgroundColor: 'rgba(5,6,13,0.4)',
    marginBottom: 10,
  },
  userListLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  userListScroll: { flex: 1 },
  userListScrollContent: { paddingBottom: 24 },
  userListEmpty: { color: '#7A9ABE', fontSize: 12, paddingVertical: 16, textAlign: 'center' },
  userListRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.1)',
    backgroundColor: 'rgba(13,17,32,0.45)',
    marginBottom: 8,
  },
  userListRowSelected: {
    borderColor: 'rgba(82,142,220,0.35)',
    backgroundColor: 'rgba(30,111,217,0.12)',
  },
  userListRowPressed: { opacity: 0.85 },
  userListRowMain: { flex: 1, minWidth: 0, paddingRight: 8 },
  userListNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  userListName: { color: '#E8F0F8', fontSize: 13, fontWeight: '600', flexShrink: 1 },
  userListSlotBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  userListSlotBadgeA: { backgroundColor: 'rgba(30,111,217,0.35)' },
  userListSlotBadgeB: { backgroundColor: 'rgba(125, 223, 168, 0.25)' },
  userListSlotBadgeText: { color: '#E8F0F8', fontSize: 9, fontWeight: '700' },
  userListEmail: { color: '#9BB0CC', fontSize: 11 },
  userListPhone: { color: '#7A9ABE', fontSize: 11, marginTop: 2 },
  userListActions: { flexDirection: 'row', gap: 4 },
  userListActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5,6,13,0.5)',
  },
  userListActionText: { color: '#9BB0CC', fontSize: 11, fontWeight: '700' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  pageTitle: { color: '#C8E4FF', fontSize: 18, fontWeight: '600' },
  pageSubtitle: { color: '#7A9ABE', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  refreshBtn: { padding: 4 },
  refreshText: { color: '#7A9ABE', fontSize: 12 },
  section: {
    marginBottom: 28,
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.15)',
    backgroundColor: 'rgba(13,17,32,0.5)',
  },
  sectionTitle: { color: '#C8E4FF', fontSize: 15, fontWeight: '600', marginBottom: 6 },
  sectionHint: { color: '#7A9ABE', fontSize: 12, lineHeight: 17, marginBottom: 12 },
  fieldLabel: {
    color: '#7A9ABE',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 8,
    color: '#E8F0F8',
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    backgroundColor: 'rgba(5,6,13,0.4)',
    marginBottom: 10,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  primaryBtn: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(30,111,217,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.45)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: '#E8F0F8', fontSize: 13, fontWeight: '600' },
  errBanner: { marginTop: 10, padding: 10, backgroundColor: 'rgba(180, 80, 80, 0.12)', borderRadius: 8 },
  errText: { color: '#E87A7A', fontSize: 12 },
  autocompleteBlock: { marginBottom: 12, zIndex: 1 },
  suggestions: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.25)',
    borderRadius: 8,
    backgroundColor: 'rgba(5,6,13,0.95)',
    marginTop: -6,
    marginBottom: 8,
    overflow: 'hidden',
  },
  suggestionRow: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderColor: 'rgba(82,142,220,0.08)' },
  suggestionLabel: { color: '#E8F0F8', fontSize: 13 },
  suggestionMeta: { color: '#7A9ABE', fontSize: 11, marginTop: 2 },
  resultsBlock: { marginTop: 16 },
  resultsTitle: { color: '#C8E4FF', fontSize: 13, fontWeight: '600', marginBottom: 10 },
  batchPairCard: { marginBottom: 16 },
  batchRank: { color: '#7A9ABE', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  detailPanel: {
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    backgroundColor: 'rgba(5,6,13,0.35)',
  },
  pairHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  pairUserCol: { flex: 1 },
  pairUserColRight: { alignItems: 'flex-end' },
  pairUserName: { color: '#E8F0F8', fontSize: 13, fontWeight: '600' },
  pairUserMeta: { color: '#7A9ABE', fontSize: 11, marginTop: 2 },
  textRight: { textAlign: 'right' },
  scoreBadgeRow: { alignItems: 'center', paddingHorizontal: 8 },
  scoreBadge: { color: '#7DDFA8', fontSize: 22, fontWeight: '700' },
  scoreBadgeDealbreaker: { color: '#F0B86E' },
  dealbreakerFailBadge: {
    marginTop: 4,
    backgroundColor: 'rgba(180, 60, 60, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(232, 122, 122, 0.5)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dealbreakerFailText: { color: '#FF8A8A', fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
  dealbreakerBox: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 6,
    backgroundColor: 'rgba(180, 60, 60, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(232, 122, 122, 0.35)',
  },
  dealbreakerTitle: { color: '#FF8A8A', fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
  dealbreakerItem: { color: '#FFB4B4', fontSize: 12, lineHeight: 18, marginBottom: 2 },
  subsectionTitle: { color: '#9BB0CC', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginTop: 8, marginBottom: 6 },
  subscoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  subscorePill: {
    backgroundColor: 'rgba(13,17,32,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    minWidth: 72,
  },
  subscoreVal: { color: '#E8F0F8', fontSize: 13, fontWeight: '600' },
  subscoreLbl: { color: '#7A9ABE', fontSize: 9, marginTop: 2, textTransform: 'uppercase' },
  insightRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 4,
    marginBottom: 4,
    backgroundColor: 'rgba(82,142,220,0.08)',
  },
  insightStrength: { backgroundColor: 'rgba(60, 140, 90, 0.15)', borderLeftWidth: 3, borderLeftColor: '#7DDFA8' },
  insightConcern: { backgroundColor: 'rgba(180, 120, 60, 0.12)', borderLeftWidth: 3, borderLeftColor: '#F0B86E' },
  insightText: { color: '#C8D8EC', fontSize: 12, lineHeight: 17 },
  breakdownList: { marginTop: 4 },
  breakdownLine: { color: '#7A9ABE', fontSize: 11, lineHeight: 16, marginBottom: 4 },
  breakdownDealbreaker: { color: '#FF8A8A', fontSize: 11, lineHeight: 16, marginTop: 4 },
  warnBox: { marginBottom: 10, padding: 10, backgroundColor: 'rgba(180, 120, 60, 0.12)', borderRadius: 8 },
  warnTitle: { color: '#F0B86E', fontSize: 11, fontWeight: '600', marginBottom: 4 },
  warnText: { color: '#E8C896', fontSize: 12 },
  infoBox: { marginBottom: 10, padding: 8, backgroundColor: 'rgba(82,142,220,0.08)', borderRadius: 6 },
  infoText: { color: '#9BB0CC', fontSize: 11 },
  unmatchedBox: { marginTop: 12, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(82,142,220,0.15)' },
  unmatchedTitle: { color: '#7A9ABE', fontSize: 12, fontWeight: '600', marginBottom: 6 },
  unmatchedItem: { color: '#9BB0CC', fontSize: 12, marginBottom: 2 },
});
