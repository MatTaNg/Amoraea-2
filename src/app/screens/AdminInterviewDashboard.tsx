/**
 * Alpha-only: Admin panel — cohort overview and individual user drill-down.
 * Visible only to admin@amoraea.com. Remove before production.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Alert } from 'react-native';
import { supabase } from '@data/supabase/client';
import { ADMIN_CONSOLE_EMAIL } from '@/constants/adminConsole';
import { AdminFeedbackPanel } from '@/components/admin/AdminFeedbackPanel';
import { OverviewTab } from '@features/admin/OverviewTab';
import { CompatibilityTab } from '@features/admin/CompatibilityTab';
import { ValidationCohortTab } from '@features/admin/ValidationCohortTab';
import { backfillMissingUncertaintyScores } from '@features/psychometrics/backfillMissingUncertaintyScores';
import {
  AdminInterviewDashboardShell,
  type AdminInterviewMainViewId,
} from '@features/admin/interviewDashboard/AdminInterviewDashboardShell';
import { AdminInterviewUserDetails } from '@features/admin/interviewDashboard/AdminInterviewUserDetails';
import { AdminInterviewUsersCohortTab } from '@features/admin/interviewDashboard/AdminInterviewUsersCohortTab';
import {
  confirmDeleteAdminUserAccount,
  deleteUserAccountViaEdge,
} from '@features/admin/interviewDashboard/adminInterviewDashboardAccountActions';
import {
  fetchAdminUsersList,
  fetchAllFullAttemptsForUser,
} from '@features/admin/interviewDashboard/adminInterviewDashboardData';
import type { AttemptRow, UserGroup, UserRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export { ADMIN_CONSOLE_EMAIL };
export { AdminInterviewAttemptTabsView as AdminAttemptTabsView } from '@features/admin/interviewDashboard/AdminInterviewAttemptTabsView';

export function AdminInterviewDashboard({ onClose }: { onClose: () => void }) {
  const [adminMainView, setAdminMainView] = useState<AdminInterviewMainViewId>('users');
  const [users, setUsers] = useState<UserGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
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
      const ok = await confirmDeleteAdminUserAccount(
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

  if (selectedUserId && selectedGroup) {
    return (
      <AdminInterviewUserDetails
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
    <AdminInterviewDashboardShell
      activeView={adminMainView}
      onChangeView={setAdminMainView}
      onClose={onClose}
    >
      {adminMainView === 'overview' ? (
        <OverviewTab />
      ) : adminMainView === 'feedback' ? (
        <AdminFeedbackPanel />
      ) : adminMainView === 'compatibility' ? (
        <CompatibilityTab />
      ) : adminMainView === 'validation' ? (
        <ValidationCohortTab />
      ) : (
        <AdminInterviewUsersCohortTab
          users={users}
          loading={loading}
          listError={listError}
          onRefreshUsers={refreshUsers}
          onSelectUser={(userId) => {
            setSelectedUserId(userId);
            setDetailAttempts(null);
            setDetailAttemptsError(null);
            setDetailAttemptsLoading(true);
          }}
          canDeleteUser={canDeleteUser}
          onDeleteUser={(row) => void handleDeleteUser(row)}
          deletingUserId={deletingUserId}
        />
      )}
    </AdminInterviewDashboardShell>
  );
}
