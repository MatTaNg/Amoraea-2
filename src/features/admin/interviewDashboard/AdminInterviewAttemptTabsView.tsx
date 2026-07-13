import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { supabase } from '@data/supabase/client';
import {
  adminInterviewAttemptsFullSelect,
  getInterviewAttemptDefenseCrossReferenceColumnAbsent,
  getInterviewAttemptGamingCorrectionColumnsAbsent,
  getInterviewAttemptOverrideColumnsAbsent,
  markInterviewAttemptDefenseCrossReferenceColumnPresent,
  markInterviewAttemptGamingCorrectionColumnsPresent,
  markInterviewAttemptOverrideColumnsPresent,
  rememberInterviewAttemptSelectColumnAbsences,
} from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { GamingCorrectionBanner } from '@features/admin/GamingCorrectionCard';
import {
  fetchAdminUserProfile,
  type AdminUserProfileRecord,
} from '@app/screens/admin/AdminProfileAssessmentTabs';
import { adminDetailTabs } from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import { emptyAdminUserProfile } from '@features/admin/interviewDashboard/adminInterviewEmptyUserProfile';
import type {
  AdminAttemptInnerTabId,
  AttemptRow,
  UserRow,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import { renderAdminInterviewDetailTabContent } from '@features/admin/interviewDashboard/renderAdminInterviewDetailTabContent';
import { userDetailsStyles as styles } from '@features/admin/interviewDashboard/adminInterviewUserDetailsStyles';

export function AdminInterviewAttemptTabsView({
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
      setProfileUser(data ?? emptyAdminUserProfile(resolvedUserId));
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
    profileUser ?? emptyAdminUserProfile(resolvedUserId ?? attempt.user_id);

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

      {renderAdminInterviewDetailTabContent(activeInnerTab, {
        profileUser: profileRecord,
        profileLoading,
        selectedAttempt: attempt,
        onRefreshData: () => void refreshAttempt(),
        candidateUser: candidateUser ?? ({ id: attempt.user_id } as UserRow),
      })}
    </View>
  );
}