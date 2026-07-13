import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  fetchReferralDiscountStatus,
  type ReferralDiscountStatus,
} from '@features/referrals/referralInterview';
import { referralCodeIntroSeenStorageKey } from '@features/referrals/referralCodeIntroStorage';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type ReferralCodeIntroShellProps = {
  userId: string;
  marketResearchComplete: boolean;
};

export function ReferralCodeIntroShell({
  userId,
  marketResearchComplete,
}: ReferralCodeIntroShellProps) {
  const [referralStatus, setReferralStatus] = useState<ReferralDiscountStatus | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !marketResearchComplete) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchReferralDiscountStatus(userId);
      if (cancelled) return;
      setReferralStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [marketResearchComplete, userId]);

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
      if (__DEV__) console.warn('[ReferralCodeIntro] clipboard', e);
    }
  }, [referralStatus?.referralCode, setCopiedForTwoSeconds]);

  const dismissPopup = useCallback(async () => {
    setPopupVisible(false);
    if (!userId) return;
    await AsyncStorage.setItem(referralCodeIntroSeenStorageKey(userId), '1');
  }, [userId]);

  const openPopup = useCallback(() => {
    if (!referralStatus?.referralCode) return;
    setPopupVisible(true);
  }, [referralStatus?.referralCode]);

  useEffect(() => {
    if (!userId || !marketResearchComplete || !referralStatus?.referralCode) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const seen = await AsyncStorage.getItem(referralCodeIntroSeenStorageKey(userId));
      if (cancelled || seen === '1') return;
      setPopupVisible(true);
      await AsyncStorage.setItem(referralCodeIntroSeenStorageKey(userId), '1');
    })();
    return () => {
      cancelled = true;
    };
  }, [marketResearchComplete, referralStatus?.referralCode, userId]);

  const popupBody = referralStatus?.atCap
    ? "Share this code with people you think are ready for a real relationship. You've maxed out your discount."
    : `Share this code with people you think are ready for a real relationship. When they complete the interview, you both unlock an extra 20% off — every membership tier, forever. You can stack this up to ${referralStatus?.remainingReferralsToCap ?? 0} more ${referralStatus?.remainingReferralsToCap === 1 ? 'time' : 'times'}.`;

  if (!marketResearchComplete || !referralStatus?.referralCode) {
    return null;
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open referral code"
        onPress={openPopup}
        style={({ pressed }) => [styles.reopenButton, pressed && styles.reopenButtonPressed]}
      >
        <Ionicons name="gift-outline" size={16} color="#C8E4FF" style={styles.reopenIcon} />
        <Text style={styles.reopenLabel}>Referral code</Text>
      </Pressable>

      <Modal
        visible={popupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => void dismissPopup()}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => void dismissPopup()}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close referral popup"
              onPress={() => void dismissPopup()}
              style={styles.modalClose}
            >
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.72)" />
            </Pressable>
            <Text style={styles.modalTitle}>
              Your referral code is {referralStatus.referralCode}
            </Text>
            <Text style={styles.modalBody}>{popupBody}</Text>
            <Pressable onPress={() => void copyReferralCode()} style={styles.modalPrimaryButton}>
              <Text style={styles.modalPrimaryText}>{copyFeedback ? 'Copied ✓' : 'Copy Code'}</Text>
            </Pressable>
            <Pressable onPress={() => void dismissPopup()} style={styles.modalSecondaryButton}>
              <Text style={styles.modalSecondaryText}>Got it</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  reopenButton: {
    position: 'absolute',
    left: 16,
    bottom: 20,
    zIndex: 1200,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(11,19,36,0.92)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.45)',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 14,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 8px 24px rgba(0,0,0,0.35)' } as object)
      : {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.28,
          shadowRadius: 8,
          elevation: 6,
        }),
  },
  reopenButtonPressed: {
    opacity: 0.9,
  },
  reopenIcon: {
    marginRight: 6,
  },
  reopenLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '700',
    color: '#E8F4FF',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(3,7,18,0.72)',
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0B1324',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.26)',
    borderRadius: 18,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    padding: 6,
  },
  modalTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    color: '#F7FBFF',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 12,
  },
  modalBody: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.78)',
    textAlign: 'center',
    marginBottom: 18,
  },
  modalPrimaryButton: {
    backgroundColor: 'rgba(91,168,232,0.26)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.5)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  modalPrimaryText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    color: '#E8F4FF',
  },
  modalSecondaryButton: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  modalSecondaryText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '700',
    color: '#9CCBFF',
  },
});
