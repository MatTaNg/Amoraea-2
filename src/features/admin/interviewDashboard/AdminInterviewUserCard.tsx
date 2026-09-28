import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Switch,
} from 'react-native';
import { supabase } from '@data/supabase/client';
import { updateInterviewAttemptRevealOverride } from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { resolveAdminInterviewIntroDisplayName } from '@utilities/adminInterviewIntroDisplayName';
import {
  countAnsweredEmotionItems,
  emotionRecognitionCorrectCount,
  EXPECTED_EMOTION_RECOGNITION_ITEMS,
  hydrateEmotionResponsesFromStorage,
  isEmotionRecognitionBatteryComplete,
  isLegacyEmotionRecognitionFloorOnlyFail,
  storedEmotionCorrectCountFromRaw,
} from '@features/aria/emotionRecognitionInterview';
import { uncertaintyBadgeColor } from '@features/admin/UncertaintyScoreCard';
import {
  formatUserInterviewDateLine,
  trimLaunchNotificationPhone,
  userGroupNeedsPsychometricFloorReview,
  userHasInProgressInterview,
} from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import { egoLevelAdminColor } from '@features/admin/interviewDashboard/adminInterviewDashboardDisplayUtils';
import {
  adminShowEarlyRevealPassFail,
  formatAdminPassFailLabel,
  resolveAdminPrimaryOutcomeDisplay,
  reviewFlagsFromStoredAttempt,
} from '@features/admin/interviewDashboard/adminInterviewDashboardGateDisplay';
import { formatScoreCell } from '@features/admin/interviewDashboard/adminInterviewDashboardScoreUtils';
import type { UserGroup } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export type AdminInterviewUserCardProps = {
  userData: UserGroup;
  onPress: () => void;
  onDelete: () => void;
  canDelete: boolean;
  deleting: boolean;
  bookmarked: boolean;
  onToggleBookmarked: (next: boolean) => void;
  onSetHumanVerified: (pass: boolean | null) => void;
  onRefreshList: () => Promise<void>;
};

function AdminCheckbox({
  label,
  checked,
  onPress,
  accent,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.adminCheckboxRow}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
    >
      <View
        style={[
          styles.adminCheckboxBox,
          checked && { borderColor: accent, backgroundColor: `${accent}33` },
        ]}
      >
        {checked ? <Text style={[styles.adminCheckboxMark, { color: accent }]}>✓</Text> : null}
      </View>
      <Text style={styles.adminCheckboxLabel}>{label}</Text>
    </Pressable>
  );
}

function HumanVerifiedCheckboxes({
  value,
  onChange,
}: {
  value: boolean | null | undefined;
  onChange: (next: boolean | null) => void;
}) {
  const passChecked = value === true;
  const failChecked = value === false;

  return (
    <View style={styles.humanVerifiedCol}>
      <Text style={styles.humanVerifiedLabel}>Human verified</Text>
      <View style={styles.humanVerifiedCheckboxRow}>
        <AdminCheckbox
          label="Pass"
          checked={passChecked}
          accent="#2A8C6A"
          onPress={() => onChange(passChecked ? null : true)}
        />
        <AdminCheckbox
          label="Fail"
          checked={failChecked}
          accent="#E85D5D"
          onPress={() => onChange(failChecked ? null : false)}
        />
      </View>
    </View>
  );
}

export function AdminInterviewUserCard({
  userData,
  onPress,
  onDelete,
  canDelete,
  deleting,
  bookmarked,
  onToggleBookmarked,
  onSetHumanVerified,
  onRefreshList,
}: AdminInterviewUserCardProps) {
  const [overrideBusy, setOverrideBusy] = useState(false);
  const latest = userData.latestAttempt;
  const outcome = resolveAdminPrimaryOutcomeDisplay(userData.user, latest);
  const override = userData.user.interview_passed_admin_override;
  const showRevealButtons = adminShowEarlyRevealPassFail(latest) && typeof override !== 'boolean';
  const launchPhone = trimLaunchNotificationPhone(userData.user.launch_notification_phone);
  const inProgress = userHasInProgressInterview(userData.user, userData.latestAttempt);

  const applyRevealOverride = async (pass: boolean) => {
    if (!latest?.id || !userData.user.id) return;
    setOverrideBusy(true);
    try {
      const attemptResult = await updateInterviewAttemptRevealOverride(latest.id, pass);
      if (!attemptResult.ok && !attemptResult.columnsMissing) {
        throw new Error(attemptResult.errorMessage);
      }
      const { error: userErr } = await supabase
        .from('users')
        .update({ interview_passed: pass, interview_passed_admin_override: pass })
        .eq('id', userData.user.id);
      if (userErr) throw new Error(userErr.message);
      await onRefreshList();
      if (attemptResult.columnsMissing) {
        Alert.alert(
          'Profile updated',
          'Pass/fail was saved on the user. This project does not have interview_attempts override columns yet (apply migration 20260430220000_interview_attempts_override_reveal), so the attempt row was not updated.',
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Update failed';
      Alert.alert('Could not apply override', msg);
    } finally {
      setOverrideBusy(false);
    }
  };

  return (
    <View style={styles.userCard}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.userCardMainPress, pressed && styles.userCardPressed]}
        accessibilityRole="button"
      >
        <View style={styles.userCardNameRow}>
          <Text style={styles.userCardIntroName}>{resolveAdminInterviewIntroDisplayName(userData.user)}</Text>
          {(() => {
            const rf = reviewFlagsFromStoredAttempt(latest);
            if (rf.length === 0) return null;
            return (
              <Text style={styles.userCardFlagMark} accessibilityLabel={`${rf.length} review flags`}>
                ⚑{rf.length > 1 ? rf.length : ''}
              </Text>
            );
          })()}
        </View>
        <Text style={styles.userCardEmail}>{userData.user.email ?? '—'}</Text>
        {launchPhone ? (
          <Text style={styles.userCardEmail} selectable>
            Phone: <Text style={styles.launchNotificationPhoneBold}>{launchPhone}</Text>
          </Text>
        ) : null}
        <Text style={styles.userCardDateLine}>{formatUserInterviewDateLine(userData)}</Text>
        {userData.attempts.length > 1 ? (
          <Text style={styles.userCardTests}>{userData.attempts.length} interview runs</Text>
        ) : null}
      </Pressable>

      <View style={styles.userCardStatusBlock}>
        <Text style={[styles.userCardStatusPrimary, { color: outcome.color }]}>{outcome.word}</Text>
        {inProgress ? <Text style={styles.userCardInProgress}>In progress</Text> : null}
        {override != null ? (
          <Text style={styles.userCardOverrideHint}>
            Admin override: {formatAdminPassFailLabel(override)}
          </Text>
        ) : null}
        {outcome.detail ? (
          <Text style={styles.userCardGateDetailSecondary} numberOfLines={4}>
            {outcome.detail}
          </Text>
        ) : null}
      </View>

      <View style={styles.userCardActionsRow}>
        <View style={styles.bookmarkToggleRow}>
          <Text style={styles.bookmarkLabel}>Bookmark</Text>
          <Switch
            value={bookmarked}
            onValueChange={(v) => onToggleBookmarked(v)}
            trackColor={{ false: 'rgba(82,142,220,0.2)', true: 'rgba(42,140,106,0.5)' }}
            thumbColor={bookmarked ? '#2A8C6A' : '#7A9ABE'}
          />
        </View>
        {showRevealButtons ? (
          <View style={styles.userCardOverrideRow}>
            <TouchableOpacity
              style={[styles.userCardOverrideChip, overrideBusy && { opacity: 0.5 }]}
              disabled={overrideBusy}
              onPress={() => void applyRevealOverride(true)}
              accessibilityRole="button"
              accessibilityLabel="Pass applicant now"
            >
              <Text style={styles.overrideChipText}>Pass</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.userCardOverrideChip, overrideBusy && { opacity: 0.5 }]}
              disabled={overrideBusy}
              onPress={() => void applyRevealOverride(false)}
              accessibilityRole="button"
              accessibilityLabel="Fail applicant now"
            >
              <Text style={styles.overrideChipText}>Fail</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {canDelete ? (
          <TouchableOpacity
            style={styles.userCardDeleteBtn}
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

      <HumanVerifiedCheckboxes
        value={userData.user.admin_human_verified_pass}
        onChange={(next) => onSetHumanVerified(next)}
      />

      {latest && !inProgress ? (
        <View style={styles.userCardSecondaryRow}>
            {typeof latest.ego_development_level === 'number' &&
            Number.isFinite(latest.ego_development_level) &&
            latest.ego_development_level >= 1 &&
            latest.ego_development_level <= 5 ? (
              <View
                style={[
                  styles.userCardMicroChip,
                  { borderColor: egoLevelAdminColor(latest.ego_development_level), backgroundColor: 'rgba(0,0,0,0.2)' },
                ]}
              >
                <Text style={[styles.userCardMicroChipText, { color: egoLevelAdminColor(latest.ego_development_level) }]}>
                  ED:{Math.round(latest.ego_development_level)}
                </Text>
              </View>
            ) : null}
            {(() => {
              const unc = latest?.uncertainty_score;
              if (unc == null || !Number.isFinite(unc)) return null;
              const color = uncertaintyBadgeColor(unc);
              return (
                <View
                  style={[
                    styles.userCardMicroChip,
                    { borderColor: color, backgroundColor: `${color}22` },
                  ]}
                >
                  <Text style={[styles.userCardMicroChipText, { color }]}>
                    U:{unc.toFixed(2)}
                  </Text>
                </View>
              );
            })()}
            {(() => {
              const resp = hydrateEmotionResponsesFromStorage(latest.emotion_recognition_responses);
              const answered = countAnsweredEmotionItems(resp);
              if (answered > 0 && answered < EXPECTED_EMOTION_RECOGNITION_ITEMS) {
                return (
                  <View style={styles.userCardMicroChip}>
                    <Text style={styles.userCardMicroChipText}>ER:incomplete</Text>
                  </View>
                );
              }
              let c = emotionRecognitionCorrectCount(resp);
              if (c == null && isEmotionRecognitionBatteryComplete(resp)) {
                c = storedEmotionCorrectCountFromRaw(
                  typeof latest.emotion_recognition_raw_score === 'number' &&
                    Number.isFinite(latest.emotion_recognition_raw_score)
                    ? latest.emotion_recognition_raw_score
                    : null,
                );
              }
              if (c == null) return null;
              return (
                <View style={styles.userCardMicroChip}>
                  <Text style={styles.userCardMicroChipText}>
                    ER:{c}/3
                  </Text>
                </View>
              );
            })()}
            {(() => {
              if (!isLegacyEmotionRecognitionFloorOnlyFail(latest)) return null;
              return (
                <View
                  style={[
                    styles.userCardMicroChip,
                    { borderColor: '#D4A84B', backgroundColor: 'rgba(212,168,75,0.15)' },
                  ]}
                >
                  <Text style={[styles.userCardMicroChipText, { color: '#D4A84B' }]}>ER floor review</Text>
                </View>
              );
            })()}
            {(() => {
              if (!userGroupNeedsPsychometricFloorReview(userData)) return null;
              return (
                <View
                  style={[
                    styles.userCardMicroChip,
                    { borderColor: '#D4A84B', backgroundColor: 'rgba(212,168,75,0.15)' },
                  ]}
                >
                  <Text style={[styles.userCardMicroChipText, { color: '#D4A84B' }]}>
                    Psych floor review
                  </Text>
                </View>
              );
            })()}
            {(() => {
              const sm = latest.score_modifier;
              const mod = latest.modified_weighted_score;
              if (typeof sm === 'number' && sm < 0 && typeof mod === 'number' && Number.isFinite(mod)) {
                return (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                    <Text style={styles.userCardScoreStrike}>
                      {formatScoreCell(latest.weighted_score)}
                    </Text>
                    <Text style={styles.userCardScoreModified}>{formatScoreCell(mod)}</Text>
                  </View>
                );
              }
            return null;
          })()}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  userCard: {
    backgroundColor: 'rgba(13,17,32,0.8)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.12)',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
  },
  userCardMainPress: {
    marginBottom: 8,
  },
  userCardPressed: {
    opacity: 0.92,
  },
  userCardDeleteBtn: {
    borderWidth: 1,
    borderColor: 'rgba(232, 122, 122, 0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(232, 122, 122, 0.08)',
  },
  userCardDeleteText: {
    color: '#E87A7A',
    fontSize: 12,
    fontWeight: '600',
  },
  userCardDeleteTextDisabled: {
    opacity: 0.5,
  },
  userCardIntroName: {
    color: '#E8F0F8',
    fontSize: 17,
    fontFamily: Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined,
  },
  userCardEmail: {
    color: '#7A9ABE',
    fontSize: 12,
    marginTop: 2,
  },
  userCardDateLine: {
    color: '#9BB0CC',
    fontSize: 11,
    marginTop: 4,
  },
  userCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  userCardFlagMark: {
    fontSize: 13,
    color: '#D97A3A',
    fontWeight: '700',
  },
  userCardStatusBlock: {
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.14)',
  },
  userCardStatusPrimary: {
    fontSize: 22,
    fontWeight: '800',
    textTransform: 'capitalize',
    letterSpacing: 0.3,
  },
  userCardGateDetailSecondary: {
    marginTop: 6,
    color: 'rgba(155, 176, 204, 0.82)',
    fontSize: 10,
    lineHeight: 14,
  },
  userCardSecondaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 8,
    alignItems: 'center',
    opacity: 0.88,
  },
  userCardMicroChip: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userCardMicroChipText: {
    fontSize: 9,
    fontWeight: '600',
    color: 'rgba(200, 215, 235, 0.75)',
  },
  userCardScoreStrike: {
    textDecorationLine: 'line-through',
    color: 'rgba(255,255,255,0.35)',
    fontSize: 9,
  },
  userCardScoreModified: {
    color: '#E87A7A',
    fontSize: 9,
    fontWeight: '700',
    marginLeft: 4,
  },
  userCardOverrideHint: {
    color: '#D4A84B',
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
  },
  userCardActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(82,142,220,0.1)',
  },
  bookmarkToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarkLabel: {
    color: '#7A9ABE',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  humanVerifiedCol: {
    gap: 6,
    marginBottom: 4,
  },
  humanVerifiedLabel: {
    color: '#7A9ABE',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  humanVerifiedCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  adminCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  adminCheckboxBox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(82,142,220,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  adminCheckboxMark: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 14,
  },
  adminCheckboxLabel: {
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '500',
  },
  userCardOverrideRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  userCardOverrideChip: {
    minWidth: 56,
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.35)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(30,111,217,0.12)',
    alignItems: 'center',
  },
  userCardInProgress: {
    color: '#D4A84B',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
  },
  userCardTests: {
    color: '#7A9ABE',
    fontSize: 11,
    marginTop: 2,
  },
  launchNotificationPhoneBold: {
    fontWeight: '700',
    color: '#C8E4FF',
  },
  overrideChipText: {
    color: '#C8E4FF',
    fontSize: 12,
    fontWeight: '600',
  },
});
