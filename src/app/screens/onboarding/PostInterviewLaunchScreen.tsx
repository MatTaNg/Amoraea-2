import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PostInterviewScrollLayout } from '@app/screens/onboarding/PostInterviewScrollLayout';
import { PostInterviewProfileEncouragement } from '@app/screens/onboarding/PostInterviewProfileEncouragement';
import { FlameOrb } from '@app/screens/FlameOrb';
import { DownloadPersonalReportButton } from '@features/psychometrics/DownloadPersonalReportButton';
import { useInterviewAttemptEgoRepair } from '@features/aria/hooks/useInterviewAttemptEgoRepair';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { fetchLaunchWaitlistPassedCount } from '@features/onboarding/fetchLaunchWaitlistPassedCount';
import { LAUNCH_WAITLIST_USER_GOAL, LAUNCH_WAITLIST_VALUE_PROPS } from '@features/onboarding/postInterviewLaunchMode';
import { usePostInterviewProfileCta } from '@features/onboarding/usePostInterviewProfileCta';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '@data/supabase/client';
import { clearReferralNoticePending } from '@data/repos/usersRoutingRepo';
import {
  fetchReferralDiscountStatus,
  type ReferralDiscountStatus,
} from '@features/referrals/referralInterview';
import {
  USER_INTERVIEW_ROUTING_TABLE,
  USER_REFERRAL_NOTICE_SELECT,
} from '@data/supabase/userInterviewRoutingSelect';

const ACCENT = '#3b82f6';
const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap';

function loadWebFontsOnce() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${GOOGLE_FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}

function FlickeringFlame({ size = 104 }: { size?: number }) {
  const flicker = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flicker, {
          toValue: 0.78,
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(flicker, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(1400),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [flicker]);
  return (
    <Animated.View style={{ opacity: flicker, alignItems: 'center' }}>
      <FlameOrb state="idle" size={size} minimalGlow />
    </Animated.View>
  );
}

export const PostInterviewLaunchScreen: React.FC<{
  navigation: {
    replace: (name: 'PostInterviewLaunch', params: { userId: string }) => void;
    dispatch: (action: unknown) => void;
    navigate: (name: string, params?: object) => void;
  };
  route: { params: { userId: string } };
}> = ({ route, navigation }) => {
  const { user } = useAuth();
  const userId = route.params?.userId ?? '';
  const isAdminEmail = isAmoraeaAdminConsoleEmail(user?.email ?? '');
  const scrollViewRef = useRef<ScrollView | null>(null);
  const discountAnim = useRef(new Animated.Value(0)).current;
  const discountValueRef = useRef(0);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [passedCount, setPassedCount] = useState<number | null>(null);
  const [referralStatus, setReferralStatus] = useState<ReferralDiscountStatus | null>(null);
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState(true);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [animatedDiscount, setAnimatedDiscount] = useState(0);
  const {
    profileCtaLoaded,
    profileCtaBusy,
    profileCtaLabel,
    profileTimeEstimateLabel,
    profileReadyForMatching,
    openProfileCta,
  } = usePostInterviewProfileCta(userId, navigation);

  useInterviewAttemptEgoRepair({
    userId,
    isAdmin: isAdminEmail,
    sourceScreen: 'PostInterviewLaunch',
  });

  useEffect(() => {
    loadWebFontsOnce();
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const count = await fetchLaunchWaitlistPassedCount();
      if (!cancelled) setPassedCount(count);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshReferralState = useCallback(async () => {
    if (!userId) return;
    setReferralLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? userId;
      if (!uid) {
        setReferralStatus(null);
        setReferralNotice(null);
        return;
      }
      const [status, userRow] = await Promise.all([
        fetchReferralDiscountStatus(uid),
        supabase
          .from(USER_INTERVIEW_ROUTING_TABLE)
          .select(USER_REFERRAL_NOTICE_SELECT)
          .eq('id', uid)
          .maybeSingle(),
      ]);
      setReferralStatus(status);
      setReferralNotice(userRow.data?.referral_notice_pending ?? null);
    } catch (e) {
      if (__DEV__) console.warn('[PostInterviewLaunch] refresh referral state', e);
    } finally {
      setReferralLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void refreshReferralState();
      return undefined;
    }, [refreshReferralState]),
  );

  useEffect(() => {
    if (!userId) return;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          void refreshReferralState();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void refreshReferralState();
      }
    });
    return () => sub.remove();
  }, [refreshReferralState, userId]);

  useEffect(() => {
    let listenerId: string | null = null;
    const nextValue = referralStatus?.totalDiscount ?? 0;
    if (discountValueRef.current === nextValue) {
      setAnimatedDiscount(nextValue);
      return undefined;
    }
    if (nextValue < discountValueRef.current) {
      discountValueRef.current = nextValue;
      discountAnim.setValue(nextValue);
      setAnimatedDiscount(nextValue);
      return undefined;
    }
    listenerId = discountAnim.addListener(({ value }) => {
      setAnimatedDiscount(Math.round(value));
    });
    discountAnim.setValue(discountValueRef.current);
    const animation = Animated.timing(discountAnim, {
      toValue: nextValue,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(() => {
      discountValueRef.current = nextValue;
      setAnimatedDiscount(nextValue);
      if (listenerId) discountAnim.removeListener(listenerId);
    });
    return () => {
      animation.stop();
      if (listenerId) discountAnim.removeListener(listenerId);
    };
  }, [discountAnim, referralStatus?.totalDiscount]);

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
      if (__DEV__) console.warn('[PostInterviewLaunch] clipboard', e);
    }
  }, [referralStatus?.referralCode, setCopiedForTwoSeconds]);

  const dismissReferralNotice = useCallback(async () => {
    if (!userId || !referralNotice) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? userId;
      if (!uid) return;
      await clearReferralNoticePending(uid);
      setReferralNotice(null);
    } catch (e) {
      if (__DEV__) console.warn('[PostInterviewLaunch] clear referral notice', e);
    }
  }, [referralNotice, userId]);

  const counterDisplay = passedCount == null ? '—' : String(passedCount);
  const progressRatio = Math.min(animatedDiscount / 100, 1);

  return (
    <>
    <PostInterviewScrollLayout scrollViewRef={scrollViewRef}>
      <FlickeringFlame size={104} />
      <Text style={styles.h1}>Congratulations on completing your assessment</Text>
      <Text style={styles.sub}>
        You&apos;re part of an early cohort helping us refine Amoraea before launch.
      </Text>

      <View style={styles.card}>
        <View style={styles.counterRow}>
          <Text style={styles.counterValue}>{counterDisplay}</Text>
          <Text style={styles.counterGoal}>/ {LAUNCH_WAITLIST_USER_GOAL}</Text>
        </View>
        <Text style={styles.launchLine}>
          When we reach {LAUNCH_WAITLIST_USER_GOAL} members, Amoraea will launch.
        </Text>
        <View style={styles.launchBenefits}>
          {LAUNCH_WAITLIST_VALUE_PROPS.map((line) => (
            <View key={line} style={styles.launchBenefitRow}>
              <Ionicons name="sparkles-outline" size={17} color={ACCENT} style={styles.launchBenefitIcon} />
              <Text style={styles.launchBenefitText}>{line}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.card}>
        {profileCtaLoaded ? (
          <>
            <PostInterviewProfileEncouragement
              variant="launch"
              timeEstimateLabel={profileTimeEstimateLabel}
            />
            <Pressable
              onPress={() => void openProfileCta()}
              disabled={profileCtaBusy}
              style={({ pressed }) => [
                styles.profileOnboardingCta,
                pressed && !profileCtaBusy && { opacity: 0.9 },
                profileCtaBusy && { opacity: 0.85 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={profileCtaLabel}
            >
              <Ionicons name="person-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.profileOnboardingCtaText}>{profileCtaLabel}</Text>
              {profileCtaBusy ? (
                <ActivityIndicator color="#fff" style={{ marginLeft: 8 }} />
              ) : (
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color="rgba(255,255,255,0.9)"
                  style={{ marginLeft: 8 }}
                />
              )}
            </Pressable>
            {!profileReadyForMatching ? (
              <Text style={styles.profileOnboardingHint}>
                Photos, match preferences, and short questionnaires — finish now and be ready when we launch.
              </Text>
            ) : null}
          </>
        ) : (
          <View
            style={styles.profileCtaLoading}
            accessibilityLabel="Loading profile status"
            accessibilityRole="progressbar"
          >
            <ActivityIndicator color="#93c5fd" />
          </View>
        )}
      </View>

      <DownloadPersonalReportButton userId={userId} variant="dark" />
      <View style={styles.referralCard}>
        <Text style={styles.referralEyebrow}>Referral Discount</Text>
        {referralNotice ? (
          <View style={styles.referralNoticeBanner}>
            <Text style={styles.referralNoticeText}>{referralNotice}</Text>
            <Pressable onPress={() => void dismissReferralNotice()} style={styles.referralNoticeDismiss}>
              <Text style={styles.referralNoticeDismissLabel}>Dismiss</Text>
            </Pressable>
          </View>
        ) : null}
        {referralLoading ? (
          <View style={styles.referralLoading}>
            <ActivityIndicator color="#93c5fd" />
          </View>
        ) : referralStatus ? (
          <>
            <Text style={styles.discountValue}>{animatedDiscount}%</Text>
            <Text style={styles.discountCaption}>off every membership tier, forever</Text>

            {referralStatus.atCap ? (
              <Text style={styles.progressCapText}>
                You&apos;ve unlocked the maximum discount. Every tier is 100% off for you.
              </Text>
            ) : (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressRatio * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>{animatedDiscount}% toward 100% off</Text>
              </View>
            )}

            <View style={styles.referralExplanationBox}>
              <Text style={styles.referralExplanationTitle}>How to get more discounts:</Text>
              <View style={styles.referralStepsList}>
                <Text style={styles.referralStep}>
                  1) Your friend inputs your code during their account setup
                </Text>
                <Text style={styles.referralStep}>2) Your friend completes the interview</Text>
                <Text style={styles.referralStep}>
                  3) You and your friend get an additional{' '}
                  <Text style={styles.referralExplanationHighlight}>20% off future subscription for LIFE!</Text>
                </Text>
              </View>
            </View>

            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>Your referral code</Text>
              <Text style={styles.codeValue}>{referralStatus.referralCode ?? '—'}</Text>
              <View style={styles.codeActions}>
                <Pressable
                  onPress={() => void copyReferralCode()}
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
          <Text style={styles.referralFallback}>
            We couldn&apos;t load your referral discount right now. Try reopening this screen in a moment.
          </Text>
        )}
      </View>
    </PostInterviewScrollLayout>
    </>
  );
};

const styles = StyleSheet.create({
  h1: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    fontWeight: '600',
    color: '#fafafa',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 10,
    lineHeight: 32,
  },
  sub: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 28,
    paddingHorizontal: 8,
  },
  card: {
    width: '100%',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginBottom: 14,
  },
  counterValue: {
    fontFamily: FONT_DISPLAY,
    fontSize: 56,
    fontWeight: '600',
    color: '#f4f4f5',
    lineHeight: 58,
  },
  counterGoal: {
    fontFamily: FONT_BODY,
    fontSize: 22,
    fontWeight: '600',
    color: ACCENT,
    marginBottom: 8,
    marginLeft: 6,
  },
  launchLine: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'center',
    marginBottom: 18,
  },
  launchBenefits: {
    width: '100%',
    gap: 12,
  },
  launchBenefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  launchBenefitIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  launchBenefitText: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.9)',
  },
  profileCtaLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    width: '100%',
  },
  profileOnboardingCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(91,168,232,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(91,168,232,0.45)',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 4,
    marginBottom: 10,
    width: '100%',
  },
  profileOnboardingCtaText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    color: '#E8F4FF',
  },
  profileOnboardingHint: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.58)',
    textAlign: 'center',
  },
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
