import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, Text } from 'react-native';

import {
  fetchReferralDiscountStatus,
  type ReferralDiscountStatus,
} from '@features/referrals/referralInterview';
import {
  clearReferralCompletionCongratsPending,
  markReferralCompletionCongratsSeen,
  referralCompletionCongratsPendingKey,
  referralCompletionCongratsSeenKey,
} from '@features/referrals/referralCompletionCongratsStorage';
import { PostInterviewLaunchReferralCard } from '@features/referrals/PostInterviewLaunchReferralCard';
import { ReferralDiscountModal } from '@features/referrals/ReferralDiscountModal';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

export const REFERRAL_COMPLETION_CONGRATS_TITLE = "Congratulations — you've unlocked your discount!";
export const REFERRAL_COMPLETION_CONGRATS_LEAD =
  'Your discount applies to every membership tier, forever. Refer friends to earn even more.';

type ReferralCompletionCongratulationsShellProps = {
  userId: string;
};

export function ReferralCompletionCongratulationsShell({
  userId,
}: ReferralCompletionCongratulationsShellProps) {
  const [referralStatus, setReferralStatus] = useState<ReferralDiscountStatus | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkGenerationRef = useRef(0);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const setCopiedForTwoSeconds = useCallback(() => {
    setCopyFeedback(true);
    if (copyFeedbackTimeoutRef.current) {
      clearTimeout(copyFeedbackTimeoutRef.current);
    }
    copyFeedbackTimeoutRef.current = setTimeout(() => {
      setCopyFeedback(false);
    }, 2000);
  }, []);

  const copyReferralCode = useCallback(async () => {
    if (!referralStatus?.referralCode) return;
    try {
      await Clipboard.setStringAsync(referralStatus.referralCode);
      setCopiedForTwoSeconds();
    } catch (e) {
      if (__DEV__) console.warn('[ReferralCompletionCongrats] clipboard', e);
    }
  }, [referralStatus?.referralCode, setCopiedForTwoSeconds]);

  const dismissPopup = useCallback(async () => {
    setPopupVisible(false);
    if (!userId) return;
    await markReferralCompletionCongratsSeen(userId);
    await clearReferralCompletionCongratsPending(userId);
  }, [userId]);

  const maybeShowCompletionCongrats = useCallback(async () => {
    if (!userId) return;

    const generation = ++checkGenerationRef.current;
    const [pending, seen] = await Promise.all([
      AsyncStorage.getItem(referralCompletionCongratsPendingKey(userId)),
      AsyncStorage.getItem(referralCompletionCongratsSeenKey(userId)),
    ]);
    if (generation !== checkGenerationRef.current) return;
    if (pending !== '1' || seen === '1') return;

    const status = await fetchReferralDiscountStatus(userId);
    if (generation !== checkGenerationRef.current) return;
    if (!status?.fullyComplete || status.totalDiscount <= 0) return;

    setReferralStatus(status);
    setPopupVisible(true);
  }, [userId]);

  useEffect(() => {
    void maybeShowCompletionCongrats();
  }, [maybeShowCompletionCongrats]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void maybeShowCompletionCongrats();
      }
    });
    return () => sub.remove();
  }, [maybeShowCompletionCongrats]);

  if (!popupVisible || !referralStatus) {
    return null;
  }

  return (
    <ReferralDiscountModal
      visible={popupVisible}
      onDismiss={() => void dismissPopup()}
      closeAccessibilityLabel="Close referral completion popup"
    >
      <Text style={styles.congratsTitle}>{REFERRAL_COMPLETION_CONGRATS_TITLE}</Text>
      <Text style={styles.congratsLead}>{REFERRAL_COMPLETION_CONGRATS_LEAD}</Text>

      <PostInterviewLaunchReferralCard
        referralStatus={referralStatus}
        displayDiscount={referralStatus.totalDiscount}
        copyFeedback={copyFeedback}
        onCopyPress={() => void copyReferralCode()}
        style={styles.modalLaunchReferralCard}
        variant="earned"
      />
    </ReferralDiscountModal>
  );
}

const styles = StyleSheet.create({
  congratsTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '600',
    color: '#F8FBFF',
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 8,
  },
  congratsLead: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.76)',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  modalLaunchReferralCard: {
    marginTop: 0,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
