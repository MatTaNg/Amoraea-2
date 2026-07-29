import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import type { ReferralDiscountStatus } from '@features/referrals/referralInterview';

export const POST_INTERVIEW_LAUNCH_REFERRAL_EYEBROW = 'Referral Discount';
export const POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_EYEBROW = 'Complete to unlock';
export const POST_INTERVIEW_LAUNCH_REFERRAL_DISCOUNT_CAPTION = 'off every membership tier, forever';
export const POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_CAPTION =
  'off all future subscription tiers when you finish the interview and psychometric assessments';
export const POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_BANNER =
  'Finish the AI interview and psychometric assessments to unlock this discount.';
export const POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE = 'How to get more discounts:';
export const POST_INTERVIEW_LAUNCH_REFERRAL_STEP_1 =
  '1) Your friend inputs your code during their account setup';
export const POST_INTERVIEW_LAUNCH_REFERRAL_STEP_2 =
  '2) Your friend completes the AI interview and psychometric assessments';
export const POST_INTERVIEW_LAUNCH_REFERRAL_STEP_3_HIGHLIGHT =
  '20% off future subscription for LIFE!';
export const POST_INTERVIEW_LAUNCH_REFERRAL_CODE_LABEL = 'Your referral code';
export const POST_INTERVIEW_LAUNCH_REFERRAL_LOAD_ERROR =
  "We couldn't load your referral discount right now. Try reopening this screen in a moment.";

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type PostInterviewLaunchReferralCardProps = {
  referralStatus: ReferralDiscountStatus | null;
  displayDiscount: number;
  copyFeedback: boolean;
  onCopyPress: () => void;
  loading?: boolean;
  referralNotice?: string | null;
  onDismissReferralNotice?: () => void;
  style?: StyleProp<ViewStyle>;
  variant?: 'earned' | 'prospective';
};

export function PostInterviewLaunchReferralCard({
  referralStatus,
  displayDiscount,
  copyFeedback,
  onCopyPress,
  loading = false,
  referralNotice = null,
  onDismissReferralNotice,
  style,
  variant = 'earned',
}: PostInterviewLaunchReferralCardProps) {
  const progressRatio = Math.min(displayDiscount / 100, 1);
  const isProspective = variant === 'prospective';
  const eyebrow = isProspective
    ? POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_EYEBROW
    : POST_INTERVIEW_LAUNCH_REFERRAL_EYEBROW;
  const discountCaption = isProspective
    ? POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_CAPTION
    : POST_INTERVIEW_LAUNCH_REFERRAL_DISCOUNT_CAPTION;

  return (
    <View style={[styles.referralCard, style]}>
      <Text style={styles.referralEyebrow}>{eyebrow}</Text>
      {referralNotice ? (
        <View style={styles.referralNoticeBanner}>
          <Text style={styles.referralNoticeText}>{referralNotice}</Text>
          {onDismissReferralNotice ? (
            <Pressable onPress={onDismissReferralNotice} style={styles.referralNoticeDismiss}>
              <Text style={styles.referralNoticeDismissLabel}>Dismiss</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {loading ? (
        <View style={styles.referralLoading}>
          <ActivityIndicator color="#93c5fd" />
        </View>
      ) : referralStatus ? (
        <>
          <Text style={styles.discountValue}>{displayDiscount}%</Text>
          <Text style={styles.discountCaption}>{discountCaption}</Text>

          {isProspective ? (
            <Text style={styles.prospectiveBanner}>{POST_INTERVIEW_LAUNCH_REFERRAL_PROSPECTIVE_BANNER}</Text>
          ) : referralStatus.atCap ? (
            <Text style={styles.progressCapText}>
              You&apos;ve unlocked the maximum discount. Every tier is 100% off for you.
            </Text>
          ) : (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
              </View>
              <Text style={styles.progressText}>{displayDiscount}% toward 100% off</Text>
            </View>
          )}

          <View style={styles.referralExplanationBox}>
            <Text style={styles.referralExplanationTitle}>
              {POST_INTERVIEW_LAUNCH_REFERRAL_EXPLANATION_TITLE}
            </Text>
            <View style={styles.referralStepsList}>
              <Text style={styles.referralStep}>{POST_INTERVIEW_LAUNCH_REFERRAL_STEP_1}</Text>
              <Text style={styles.referralStep}>{POST_INTERVIEW_LAUNCH_REFERRAL_STEP_2}</Text>
              <Text style={styles.referralStep}>
                3) You and your friend get an additional{' '}
                <Text style={styles.referralExplanationHighlight}>
                  {POST_INTERVIEW_LAUNCH_REFERRAL_STEP_3_HIGHLIGHT}
                </Text>
              </Text>
            </View>
          </View>

          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>{POST_INTERVIEW_LAUNCH_REFERRAL_CODE_LABEL}</Text>
            <Text style={styles.codeValue}>{referralStatus.referralCode ?? '—'}</Text>
            <View style={styles.codeActions}>
              <Pressable
                onPress={onCopyPress}
                disabled={!referralStatus.referralCode}
                style={({ pressed }) => [
                  styles.codeActionButton,
                  pressed && referralStatus.referralCode ? { opacity: 0.92 } : null,
                  !referralStatus.referralCode ? styles.codeActionDisabled : null,
                ]}
              >
                <Ionicons name="copy-outline" size={16} color="#E8F4FF" style={{ marginRight: 6 }} />
                <Text style={styles.codeActionText}>{copyFeedback ? 'Copied ✓' : 'Copy Code'}</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : (
        <Text style={styles.referralFallback}>{POST_INTERVIEW_LAUNCH_REFERRAL_LOAD_ERROR}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  referralCard: {
    width: '100%',
    backgroundColor: 'rgba(12,19,34,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.28)',
    borderRadius: 18,
    paddingVertical: 26,
    paddingHorizontal: 20,
    marginTop: 4,
    alignItems: 'center',
  },
  referralEyebrow: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: '#8FBFFF',
    marginBottom: 10,
  },
  referralLoading: {
    minHeight: 120,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 78,
    lineHeight: 80,
    fontWeight: '600',
    color: '#F8FBFF',
    textAlign: 'center',
  },
  discountCaption: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.76)',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
  },
  prospectiveBanner: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: '#C8E4FF',
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  progressWrap: {
    width: '100%',
    marginBottom: 18,
  },
  progressTrack: {
    width: '100%',
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: '#5BA8E8',
  },
  progressText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 20,
    color: '#DCEBFF',
    textAlign: 'center',
  },
  progressCapText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: '#DCEBFF',
    textAlign: 'center',
    marginBottom: 18,
  },
  codeBox: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 0,
    marginBottom: 0,
  },
  codeLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
  },
  codeValue: {
    fontFamily: FONT_BODY,
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#F5FAFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  codeActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
  },
  codeActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91,168,232,0.24)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.5)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  codeActionDisabled: {
    opacity: 0.45,
  },
  codeActionText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '700',
    color: '#E8F4FF',
  },
  referralExplanationBox: {
    width: '100%',
    backgroundColor: 'rgba(91,168,232,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.38)',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 16,
  },
  referralExplanationTitle: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '700',
    color: '#F5FAFF',
    marginBottom: 12,
  },
  referralStepsList: {
    width: '100%',
    gap: 10,
  },
  referralStep: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.92)',
  },
  referralExplanationHighlight: {
    fontWeight: '700',
    color: '#C8E4FF',
  },
  referralFallback: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
  referralNoticeBanner: {
    width: '100%',
    backgroundColor: 'rgba(34,197,94,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.32)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  referralNoticeText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: '#CFFBDD',
  },
  referralNoticeDismiss: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  referralNoticeDismissLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '700',
    color: '#9FE3B4',
  },
});
