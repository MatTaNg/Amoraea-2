import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { PostInterviewScrollLayout } from '@app/screens/onboarding/PostInterviewScrollLayout';
import { PostInterviewProfileEncouragement } from '@app/screens/onboarding/PostInterviewProfileEncouragement';
import { AMORAEA_FLAME_ORB_LOGO } from '@app/screens/flameOrbLogo';
import { DownloadPersonalReportButton } from '@features/psychometrics/DownloadPersonalReportButton';
import { PostInterviewLaunchScoreSummary } from '@features/onboarding/PostInterviewLaunchScoreSummary';
import { useInterviewAttemptEgoRepair } from '@features/aria/hooks/useInterviewAttemptEgoRepair';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { LAUNCH_WAITLIST_USER_GOAL, LAUNCH_WAITLIST_VALUE_PROPS } from '@features/onboarding/postInterviewLaunchMode';
import {
  postInterviewLaunchQueryKeys,
  useLaunchWaitlistPassedCountQuery,
  usePostInterviewReferralStateQuery,
} from '@features/onboarding/postInterviewLaunchQueries';
import { usePostInterviewProfileCta } from '@features/onboarding/usePostInterviewProfileCta';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@data/supabase/client';
import { clearReferralNoticePending } from '@data/repos/usersRoutingRepo';
import { PostInterviewLaunchReferralCard } from '@features/referrals/PostInterviewLaunchReferralCard';

const ACCENT = '#3b82f6';
const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap';

/** Static hero flame on the launch congratulations screen. */
const CONGRATS_FLAME_ORB_SIZE = 140;

function loadWebFontsOnce() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.querySelector(`link[href="${GOOGLE_FONTS_HREF}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = GOOGLE_FONTS_HREF;
  document.head.appendChild(link);
}

export const PostInterviewLaunchScreen: React.FC<{
  navigation: {
    replace: (name: 'PostInterviewLaunch', params: { userId: string }) => void;
    dispatch: (action: unknown) => void;
    navigate: (name: string, params?: object) => void;
  };
  route: { params: { userId: string } };
}> = ({ route, navigation }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = route.params?.userId ?? '';
  const isAdminEmail = isAmoraeaAdminConsoleEmail(user?.email ?? '');
  const scrollViewRef = useRef<ScrollView | null>(null);
  const discountAnim = useRef(new Animated.Value(0)).current;
  const discountValueRef = useRef(0);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [animatedDiscount, setAnimatedDiscount] = useState(0);
  const { data: passedCount } = useLaunchWaitlistPassedCountQuery();
  const {
    data: referralState,
    isPending: referralLoading,
  } = usePostInterviewReferralStateQuery(userId);
  const referralStatus = referralState?.referralStatus ?? null;
  const referralNotice = referralState?.referralNotice ?? null;
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
    if (!userId) return;
    const refetchStaleReferralState = () => {
      void queryClient.refetchQueries({
        queryKey: postInterviewLaunchQueryKeys.referralState(userId),
        stale: true,
      });
    };
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          refetchStaleReferralState();
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        refetchStaleReferralState();
      }
    });
    return () => sub.remove();
  }, [queryClient, userId]);

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
      queryClient.setQueryData(
        postInterviewLaunchQueryKeys.referralState(userId),
        (current) =>
          current
            ? {
                ...current,
                referralNotice: null,
              }
            : current,
      );
    } catch (e) {
      if (__DEV__) console.warn('[PostInterviewLaunch] clear referral notice', e);
    }
  }, [queryClient, referralNotice, userId]);

  const counterDisplay = passedCount == null ? '—' : String(passedCount);

  return (
    <>
    <PostInterviewScrollLayout scrollViewRef={scrollViewRef}>
      <View style={styles.logoWrap}>
        <Image
          source={AMORAEA_FLAME_ORB_LOGO}
          accessibilityLabel="Amoraea"
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>
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

      <PostInterviewLaunchScoreSummary userId={userId} />
      <DownloadPersonalReportButton userId={userId} variant="dark" />
      <PostInterviewLaunchReferralCard
        referralStatus={referralStatus}
        displayDiscount={animatedDiscount}
        copyFeedback={copyFeedback}
        onCopyPress={() => void copyReferralCode()}
        loading={referralLoading}
        referralNotice={referralNotice}
        onDismissReferralNotice={() => void dismissReferralNotice()}
      />
    </PostInterviewScrollLayout>
    </>
  );
};

const styles = StyleSheet.create({
  logoWrap: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logoImage: {
    width: CONGRATS_FLAME_ORB_SIZE,
    height: CONGRATS_FLAME_ORB_SIZE,
  },
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
});
