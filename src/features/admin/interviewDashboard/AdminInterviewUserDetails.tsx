import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '@data/supabase/client';
import { confirmAsync } from '@utilities/alerts/confirmDialog';
import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import { updateInterviewAttemptRevealOverride } from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { RELATIONSHIP_VALIDATION_TRACK } from '@features/relationshipValidation/constants';
import {
  enrollExistingUserInRelationshipValidation,
  unenrollExistingUserFromRelationshipValidation,
} from '@features/relationshipValidation/relationshipValidationRepo';
import { allowInterviewRetakeByAdmin } from '@features/interview/interviewRetake';
import {
  fetchAdminUserProfile,
  type AdminUserProfileRecord,
} from '@app/screens/admin/AdminProfileAssessmentTabs';
import {
  ADMIN_USER_LEVEL_INNER_TABS,
  adminDetailTabs,
} from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import {
  formatAttemptTabLabel,
  getAttemptsSorted,
} from '@features/admin/interviewDashboard/adminInterviewAttemptTabUtils';
import {
  formatUserInterviewDateLine,
  trimLaunchNotificationPhone,
  userHasInProgressInterview,
} from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import { emptyAdminUserProfile } from '@features/admin/interviewDashboard/adminInterviewEmptyUserProfile';
import {
  formatAdminPassFailLabel,
  getPassColor,
  getPassWord,
} from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import type {
  AdminAttemptInnerTabId,
  AttemptRow,
  UserGroup,
} from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';
import { AdminInterviewInProgressTranscriptSection } from '@features/admin/interviewDashboard/AdminInterviewInProgressTranscriptSection';
import { renderAdminInterviewDetailTabContent } from '@features/admin/interviewDashboard/renderAdminInterviewDetailTabContent';
import { userDetailsStyles as styles } from '@features/admin/interviewDashboard/adminInterviewUserDetailsStyles';

export function AdminInterviewUserDetails({
  userData,
  fullAttempts,
  attemptsLoading,
  attemptsError,
  onBack,
  onDeleteAccount,
  canDelete,
  deleting,
  onRefreshData,
}: {
  userData: UserGroup;
  /** All full attempt rows for this user (newest first). */
  fullAttempts: AttemptRow[];
  attemptsLoading: boolean;
  attemptsError: string | null;
  onBack: () => void;
  onDeleteAccount: () => void;
  canDelete: boolean;
  deleting: boolean;
  onRefreshData: () => void;
}) {
  const attempts = getAttemptsSorted(fullAttempts);
  const [activeInnerTab, setActiveInnerTab] = useState<AdminAttemptInnerTabId>('summary');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [overrideBusy, setOverrideBusy] = useState(false);
  const [validationEnrollBusy, setValidationEnrollBusy] = useState(false);
  const [retakeAllowBusy, setRetakeAllowBusy] = useState(false);
  const [profileUser, setProfileUser] = useState<AdminUserProfileRecord | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (attempts.length === 0) {
      setSelectedAttemptId(null);
      return;
    }
    if (!selectedAttemptId || !attempts.some((a) => a.id === selectedAttemptId)) {
      setSelectedAttemptId(attempts[0]!.id);
    }
  }, [attempts, selectedAttemptId]);

  const selectedAttempt = attempts.find((a) => a.id === selectedAttemptId) ?? attempts[0] ?? null;
  const u = userData.user;
  const attemptIdForOverride =
    selectedAttempt?.id ??
    userData.latestAttempt?.id ??
    (typeof u.latest_attempt_id === 'string' ? u.latest_attempt_id : null);

  useEffect(() => {
    let cancelled = false;
    setProfileLoading(true);
    void fetchAdminUserProfile(u.id).then((data) => {
      if (cancelled) return;
      setProfileUser(data ?? emptyAdminUserProfile(u.id));
      setProfileLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [u.id]);
  const detailLaunchPhone = trimLaunchNotificationPhone(u.launch_notification_phone);
  const isStandardAppValidationEnrolled =
    u.validation_track === RELATIONSHIP_VALIDATION_TRACK && u.validation_standard_app_enrolled === true;

  const toggleStandardAppValidationEnrollment = useCallback(async () => {
    if (!u.id || validationEnrollBusy) return;
    setValidationEnrollBusy(true);
    try {
      if (isStandardAppValidationEnrolled) {
        await unenrollExistingUserFromRelationshipValidation(u.id);
      } else {
        await enrollExistingUserInRelationshipValidation(u.id);
      }
      onRefreshData();
    } catch (err) {
      Alert.alert(
        'Update failed',
        err instanceof Error ? err.message : 'Could not update validation enrollment.',
      );
    } finally {
      setValidationEnrollBusy(false);
    }
  }, [isStandardAppValidationEnrolled, onRefreshData, u.id, validationEnrollBusy]);

  const applyPassOverride = useCallback(
    async (mode: 'pass' | 'fail' | 'clear') => {
      if (!u.id) return;
      setOverrideBusy(true);
      try {
        if (mode === 'clear') {
          const { error } = await supabase
            .from('users')
            .update({
              interview_passed_admin_override: null,
              interview_passed: u.interview_passed_computed ?? null,
            })
            .eq('id', u.id);
          if (error) {
            Alert.alert('Update failed', error.message);
            return;
          }
          onRefreshData();
          return;
        }
        const pass = mode === 'pass';
        if (attemptIdForOverride) {
          const attemptResult = await updateInterviewAttemptRevealOverride(attemptIdForOverride, pass);
          if (!attemptResult.ok && !attemptResult.columnsMissing) {
            Alert.alert('Update failed', attemptResult.errorMessage);
            return;
          }
        }
        const { error } = await supabase
          .from('users')
          .update({
            interview_passed_admin_override: pass,
            interview_passed: pass,
          })
          .eq('id', u.id);
        if (error) {
          Alert.alert('Update failed', error.message);
          return;
        }
        onRefreshData();
      } finally {
        setOverrideBusy(false);
      }
    },
    [attemptIdForOverride, onRefreshData, u.id, u.interview_passed_computed],
  );

  const handleAllowRetake = useCallback(async () => {
    if (!u.id) return;
    const ok = await confirmAsync({
      title: 'Allow interview retake?',
      message:
        'This clears the user’s active interview routing so they can start a new run. Prior attempt rows stay in the database for review.',
      confirmText: 'Allow retake',
    });
    if (!ok) return;
    setRetakeAllowBusy(true);
    try {
      await allowInterviewRetakeByAdmin(u.id);
      onRefreshData();
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Could not allow retake';
      Alert.alert('Allow retake failed', msg);
    } finally {
      setRetakeAllowBusy(false);
    }
  }, [onRefreshData, u.id]);

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
        <Text style={styles.headerTitle}>{resolveAdminInterviewIntroDisplayName(u)}</Text>
        <Text style={styles.headerSub}>{u.email ?? '—'}</Text>
        {detailLaunchPhone ? (
          <Text style={styles.headerSub} selectable>
            Phone: <Text style={styles.launchNotificationPhoneBold}>{detailLaunchPhone}</Text>
          </Text>
        ) : null}
        <Text style={styles.headerSub}>{formatUserInterviewDateLine(userData)}</Text>
        {attempts.length > 0 ? (
          <Text style={styles.headerSub}>
            {attempts.length === 1 ? '1 interview run on file' : `${attempts.length} interview runs on file`}
          </Text>
        ) : null}
        <Text style={styles.headerPassMeta} selectable>
          Gate (computed): {u.interview_passed_computed == null ? '—' : String(u.interview_passed_computed)} Â·
          Admin override: {formatAdminPassFailLabel(u.interview_passed_admin_override)} Â·
          Effective routing: {u.interview_passed == null ? '—' : String(u.interview_passed)}
        </Text>
        <View style={styles.overrideButtonRow}>
          <TouchableOpacity
            style={styles.overrideChip}
            onPress={() => void applyPassOverride('pass')}
            disabled={overrideBusy}
            accessibilityRole="button"
            accessibilityLabel="Force pass"
          >
            <Text style={styles.overrideChipText}>Force pass</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overrideChip}
            onPress={() => void applyPassOverride('fail')}
            disabled={overrideBusy}
            accessibilityRole="button"
            accessibilityLabel="Force fail"
          >
            <Text style={styles.overrideChipText}>Force fail</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.overrideChip}
            onPress={() => void applyPassOverride('clear')}
            disabled={overrideBusy}
            accessibilityRole="button"
            accessibilityLabel="Clear override"
          >
            <Text style={styles.overrideChipText}>Use gate only</Text>
          </TouchableOpacity>
          {u.interview_completed === true ? (
            <TouchableOpacity
              style={styles.overrideChip}
              onPress={() => void handleAllowRetake()}
              disabled={retakeAllowBusy}
              accessibilityRole="button"
              accessibilityLabel="Allow interview retake"
            >
              <Text style={styles.overrideChipText}>
                {retakeAllowBusy ? 'Allowing…' : 'Allow retake'}
              </Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[
              styles.overrideChip,
              isStandardAppValidationEnrolled && styles.overrideChipActive,
            ]}
            onPress={() => void toggleStandardAppValidationEnrollment()}
            disabled={validationEnrollBusy}
            accessibilityRole="button"
            accessibilityLabel={
              isStandardAppValidationEnrolled
                ? 'Remove RELATIONSHIP validation enrollment'
                : 'Enroll in RELATIONSHIP validation cohort'
            }
          >
            <Text style={styles.overrideChipText}>
              {validationEnrollBusy
                ? 'Updating…'
                : isStandardAppValidationEnrolled
                  ? 'Validation enrolled'
                  : 'Enroll validation'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <AdminInterviewInProgressTranscriptSection
        user={userData.user}
        latestAttempt={userData.latestAttempt}
        liveTranscript={attempts.find((a) => a.completed_at == null)?.transcript}
        onRefresh={onRefreshData}
      />

      {attemptsLoading && !ADMIN_USER_LEVEL_INNER_TABS.has(activeInnerTab) ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Loading interview data…</Text>
        </View>
      ) : attemptsError && !ADMIN_USER_LEVEL_INNER_TABS.has(activeInnerTab) ? (
        <View style={styles.emptyState}>
          <Text style={styles.listErrorTitle}>Could not load tests</Text>
          <Text style={styles.listErrorDetail} selectable>
            {attemptsError}
          </Text>
        </View>
      ) : (
        <View style={styles.detailsLayoutSingle}>
          <View style={styles.detailsPaneFull}>
            {attempts.length > 1 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.attemptTabsRowScroll}
                contentContainerStyle={styles.attemptTabsRowContent}
              >
                {attempts.map((att) => {
                  const active = att.id === selectedAttempt?.id;
                  const passWord = getPassWord(att);
                  return (
                    <TouchableOpacity
                      key={att.id}
                      style={[styles.attemptTab, active && styles.attemptTabActive]}
                      onPress={() => setSelectedAttemptId(att.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`View interview run ${att.attempt_number}`}
                    >
                      <Text style={[styles.attemptTabLabel, active && styles.attemptTabLabelActive]}>
                        Run {att.attempt_number}
                      </Text>
                      <Text style={styles.attemptTabLabel} numberOfLines={1}>
                        {formatAttemptTabLabel(att)}
                      </Text>
                      <Text style={[styles.attemptTabOutcome, { color: getPassColor(passWord) }]}>
                        {passWord === 'none' ? '—' : passWord}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            ) : null}
            <View style={styles.innerTabsRow}>
              {adminDetailTabs().map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.innerTab, activeInnerTab === t.id && styles.innerTabActive]}
                  onPress={() => setActiveInnerTab(t.id)}
                >
                  <Text style={[styles.innerTabText, activeInnerTab === t.id && styles.innerTabTextActive]}>
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {attempts.length === 0 &&
            !ADMIN_USER_LEVEL_INNER_TABS.has(activeInnerTab) &&
            !attemptsLoading &&
            !attemptsError ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>
                  {userHasInProgressInterview(userData.user, userData.latestAttempt)
                    ? 'No completed tests yet — transcript above updates while they interview.'
                    : 'No tests found for this user.'}
                </Text>
                {userData.user.latest_attempt_id || userData.user.interview_completed ? (
                  <Text style={styles.emptyHint}>
                    Interview data exists for this account but full attempt rows did not load. If attempts stay empty
                    after refreshing, apply{' '}
                    <Text style={styles.emptyHintMono}>20260423150000_admin_rls_is_amoraea_admin_function.sql</Text>{' '}
                    (admin check via <Text style={styles.emptyHintMono}>auth.users</Text> email — JWT email in RLS is
                    unreliable), and ensure{' '}
                    <Text style={styles.emptyHintMono}>20260423140000_interview_attempts_rls_admin_and_own.sql</Text>{' '}
                    policies exist for <Text style={styles.emptyHintMono}>interview_attempts</Text>.
                  </Text>
                ) : null}
              </View>
            ) : (
              renderAdminInterviewDetailTabContent(activeInnerTab, {
                profileUser: profileUser ?? emptyAdminUserProfile(u.id),
                profileLoading,
                selectedAttempt,
                onRefreshData,
                candidateUser: u,
              })
            )}
          </View>
        </View>
      )}
    </View>
  );
}
