import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@data/supabase/client';
import { AdminInterviewUserCard } from '@features/admin/interviewDashboard/AdminInterviewUserCard';
import {
  BOOKMARK_COHORT_OPTIONS,
  HUMAN_VERIFIED_COHORT_OPTIONS,
  STATUS_FILTER_OPTIONS,
  TIME_RANGE_OPTIONS,
  UNCERTAINTY_BAND_OPTIONS,
  USER_LIST_SORT_OPTIONS,
} from '@features/admin/interviewDashboard/adminInterviewCohortFilterConstants';
import {
  buildAdminCohortExportCsv,
  collectFilteredUserEmails,
  triggerAdminCohortCsvDownload,
} from '@features/admin/interviewDashboard/adminInterviewCohortExport';
import { cohortListStyles as styles } from '@features/admin/interviewDashboard/adminInterviewCohortListStyles';
import {
  computeCohortHeaderStats,
  filterAdminUserCohort,
  formatYmdLocal,
  sortUserGroups,
} from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import type {
  AdminUserStatusFilter,
  BookmarkCohortFilter,
  HumanVerifiedCohortFilter,
  TimeRangeFilter,
  UncertaintyBandFilter,
  UserGroup,
  UserListSort,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function AdminInterviewUsersCohortTab({
  users,
  loading,
  listError,
  onRefreshUsers,
  onSelectUser,
  canDeleteUser,
  onDeleteUser,
  deletingUserId,
}: {
  users: UserGroup[];
  loading: boolean;
  listError: string | null;
  onRefreshUsers: () => Promise<void>;
  onSelectUser: (userId: string) => void;
  canDeleteUser: (row: UserRow) => boolean;
  onDeleteUser: (row: UserRow) => void;
  deletingUserId: string | null;
}) {
  const [statusFilter, setStatusFilter] = useState<AdminUserStatusFilter>('all');
  const [timeRangeFilter, setTimeRangeFilter] = useState<TimeRangeFilter>('all');
  const [customTimeFrom, setCustomTimeFrom] = useState('');
  const [customTimeTo, setCustomTimeTo] = useState('');
  const [bookmarkCohortFilter, setBookmarkCohortFilter] = useState<BookmarkCohortFilter>('all');
  const [humanVerifiedCohortFilter, setHumanVerifiedCohortFilter] =
    useState<HumanVerifiedCohortFilter>('all');
  const [uncertaintyBandFilter, setUncertaintyBandFilter] = useState<UncertaintyBandFilter>('all');
  const [userListSort, setUserListSort] = useState<UserListSort>('date');
  const [hideIncomplete, setHideIncomplete] = useState(true);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const pipelineFiltered = useMemo(
    () =>
      filterAdminUserCohort(users, {
        timeRangeFilter,
        customTimeFrom,
        customTimeTo,
        bookmarkCohortFilter,
        humanVerifiedCohortFilter,
        uncertaintyBandFilter,
        hideIncomplete,
        statusFilter,
        userSearchQuery,
      }),
    [
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
    ],
  );

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

  const setUserBookmarked = useCallback(
    async (userId: string, next: boolean) => {
      const { error } = await supabase
        .from('users')
        .update({ interview_cohort_admin_reviewed: next })
        .eq('id', userId);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await onRefreshUsers();
    },
    [onRefreshUsers],
  );

  const setUserHumanVerified = useCallback(
    async (userId: string, pass: boolean | null) => {
      const { error } = await supabase
        .from('users')
        .update({ admin_human_verified_pass: pass })
        .eq('id', userId);
      if (error) {
        Alert.alert('Could not save', error.message);
        return;
      }
      await onRefreshUsers();
    },
    [onRefreshUsers],
  );

  return (
    <>
      <View style={styles.exportRow}>
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
          onPress={() => void handleCopyEmails()}
          disabled={loading || !!listError}
          accessibilityRole="button"
          accessibilityLabel="Copy filtered emails"
        >
          <Text style={styles.exportCsvButtonText}>Copy Emails</Text>
        </TouchableOpacity>
      </View>
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
          {USER_LIST_SORT_OPTIONS.map((opt) => (
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
          {UNCERTAINTY_BAND_OPTIONS.map((opt) => (
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
            <AdminInterviewUserCard
              key={userData.user.id}
              userData={userData}
              onPress={() => onSelectUser(userData.user.id)}
              canDelete={canDeleteUser(userData.user)}
              deleting={deletingUserId === userData.user.id}
              onDelete={() => void onDeleteUser(userData.user)}
              bookmarked={userData.user.interview_cohort_admin_reviewed === true}
              onToggleBookmarked={(next) => void setUserBookmarked(userData.user.id, next)}
              onSetHumanVerified={(pass) => void setUserHumanVerified(userData.user.id, pass)}
              onRefreshList={onRefreshUsers}
            />
          ))
        )}
      </ScrollView>
    </>
  );
}
