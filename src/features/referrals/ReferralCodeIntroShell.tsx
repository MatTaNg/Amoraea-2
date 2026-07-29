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
import type { NavigationState } from '@react-navigation/native';

import { isLaunchWaitlistPostInterviewModeEnabled } from '@features/onboarding/postInterviewLaunchMode';
import {
  fetchReferralDiscountStatus,
  resolveProspectiveCompletionDiscount,
  type ReferralDiscountStatus,
} from '@features/referrals/referralInterview';
import { referralCodeIntroSeenStorageKey } from '@features/referrals/referralCodeIntroStorage';
import { PostInterviewLaunchReferralCard } from '@features/referrals/PostInterviewLaunchReferralCard';
import { PostInterviewReferFriendSection } from '@features/referrals/PostInterviewReferFriendSection';

const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

/** Routes that already surface referral UI inline — hide the global floating chip/modal. */
export const REFERRAL_CODE_INTRO_SUPPRESSED_ROUTES = [
  'PostInterviewLaunch',
  'DatingProfileEdit',
] as const;

/** Parent stack route — suppress on all nested onboarding steps. */
export const REFERRAL_CODE_INTRO_SUPPRESSED_ROUTE_PREFIXES = ['DatingProfileOnboarding'] as const;

export function resolveActiveNavigationRouteName(
  state: NavigationState | undefined,
): string | undefined {
  if (!state) return undefined;
  let node = state;
  while (node.routes[node.index ?? 0]?.state) {
    node = node.routes[node.index ?? 0].state as NavigationState;
  }
  return node.routes[node.index ?? 0]?.name;
}

function navigationTreeContainsRoute(
  state: NavigationState | undefined,
  routeName: string,
): boolean {
  if (!state) return false;
  for (const route of state.routes) {
    if (route.name === routeName) return true;
    if (route.state && navigationTreeContainsRoute(route.state as NavigationState, routeName)) {
      return true;
    }
  }
  return false;
}

export function isReferralCodeIntroSuppressedRoute(
  routeName: string | undefined,
  navigationState?: NavigationState,
): boolean {
  if (
    routeName != null &&
    (REFERRAL_CODE_INTRO_SUPPRESSED_ROUTES as readonly string[]).includes(routeName)
  ) {
    return true;
  }

  return (REFERRAL_CODE_INTRO_SUPPRESSED_ROUTE_PREFIXES as readonly string[]).some((name) =>
    navigationTreeContainsRoute(navigationState, name),
  );
}

type ReferralCodeIntroShellProps = {
  userId: string;
  marketResearchComplete: boolean;
  /** When true, hide floating chip/modal (e.g. PostInterviewLaunch already shows referral inline). */
  suppressReferralIntro?: boolean;
};

export function ReferralCodeIntroShell({
  userId,
  marketResearchComplete,
  suppressReferralIntro = false,
}: ReferralCodeIntroShellProps) {
  const [referralStatus, setReferralStatus] = useState<ReferralDiscountStatus | null>(null);
  const [popupVisible, setPopupVisible] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!userId || !marketResearchComplete || suppressReferralIntro) return;
    let cancelled = false;
    void (async () => {
      const status = await fetchReferralDiscountStatus(userId);
      if (cancelled) return;
      setReferralStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [marketResearchComplete, suppressReferralIntro, userId]);

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
    if (!userId || !marketResearchComplete || suppressReferralIntro || !referralStatus?.referralCode) {
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
  }, [marketResearchComplete, referralStatus?.referralCode, suppressReferralIntro, userId]);

  if (suppressReferralIntro || !marketResearchComplete || !referralStatus?.referralCode) {
    return null;
  }

  const useLaunchReferralCard = isLaunchWaitlistPostInterviewModeEnabled();
  const isProspective = !referralStatus.fullyComplete;
  const displayDiscount = isProspective
    ? resolveProspectiveCompletionDiscount(referralStatus.signedUpWithReferral)
    : referralStatus.totalDiscount;
  const referralCardVariant = isProspective ? 'prospective' : 'earned';

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
            {useLaunchReferralCard ? (
              <PostInterviewLaunchReferralCard
                referralStatus={referralStatus}
                displayDiscount={displayDiscount}
                copyFeedback={copyFeedback}
                onCopyPress={() => void copyReferralCode()}
                style={styles.modalLaunchReferralCard}
                variant={referralCardVariant}
              />
            ) : (
              <PostInterviewReferFriendSection
                referralCode={referralStatus.referralCode}
                copyFeedback={copyFeedback}
                onCopyPress={() => void copyReferralCode()}
                showTopDivider={false}
                style={styles.modalReferSection}
              />
            )}
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
  modalReferSection: {
    marginTop: 0,
    marginBottom: 8,
  },
  modalLaunchReferralCard: {
    marginTop: 0,
    marginBottom: 8,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
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
