import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { PostInterviewScrollLayout } from '@app/screens/onboarding/PostInterviewScrollLayout';
import { PostInterviewProfileEncouragement } from '@app/screens/onboarding/PostInterviewProfileEncouragement';
import { POST_INTERVIEW_PROFILE_TIME_ESTIMATE } from '@features/onboarding/postInterviewProfileCompletion';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@data/supabase/client';
import { clearReferralNoticePending } from '@data/repos/usersRoutingRepo';
import {
  USER_INTERVIEW_ROUTING_TABLE,
  USER_REFERRAL_NOTICE_SELECT,
} from '@data/supabase/userInterviewRoutingSelect';
import { FlameOrb } from '@app/screens/FlameOrb';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { enableInterviewRetake } from '@features/interview/interviewRetake';
import { usePostInterviewRetakeEligibility } from '@features/onboarding/usePostInterviewRetakeEligibility';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { showConfirmDialog, showSimpleAlert } from '@utilities/alerts/confirmDialog';
import { resolveStandardPostInterviewStackRoute } from '@utilities/postInterviewProcessingGate';
import { useRedirectPostInterviewLaunchWhenEnabled } from '@features/onboarding/postInterviewLaunchMode';
import {
  fetchInterviewAttemptRevealSnapshot,
  fetchUserInterviewRevealPollRow,
} from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';
import { profilesRepo } from '@/data/repos/profilesRepo';
import { useInterviewAttemptEgoRepair } from '@features/aria/hooks/useInterviewAttemptEgoRepair';
import { DownloadPersonalReportButton } from '@features/psychometrics/DownloadPersonalReportButton';
import { ValidationFlowOptInCard } from '@features/relationshipValidation/ValidationFlowOptInCard';
import { navigateToDatingProfileOnboardingEntry } from '@/datingProfile/onboarding/navigateToDatingProfileOnboardingEntry';
import { areDatingProfileAssessmentsComplete } from '@/data/services/assessmentService';

const BG = '#0a0a0f';
const ACCENT = '#3b82f6';
const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const WHATSAPP_COMMUNITY_URL = 'https://chat.whatsapp.com/BFIQCNAD1jd2Uw8IqMh2SS';

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

function FlickeringFlame({ size = 100 }: { size?: number }) {
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
      ])
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

/**
 * Shown to standard applicants who **passed** the interview gate. Same layout family as
 * `PostInterviewScreen` (in-review / not passed).
 */
export const PostInterviewPassedScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  route,
  navigation,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = route.params?.userId ?? '';
  useRedirectPostInterviewLaunchWhenEnabled(navigation, userId);
  const isAdminEmail = isAmoraeaAdminConsoleEmail(user?.email ?? '');
  useInterviewAttemptEgoRepair({
    userId,
    isAdmin: isAdminEmail,
    sourceScreen: 'PostInterviewPassed',
  });
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const { showRetake: showPostInterviewRetake } = usePostInterviewRetakeEligibility(userId);
  const [retakeBusy, setRetakeBusy] = useState(false);
  /** Modal dating onboarding resume step from merged profile + draft (`complete` = all modal steps satisfied). */
  const [datingModalResumeStep, setDatingModalResumeStep] = useState<string | null>(null);
  const [datingProfileFullyComplete, setDatingProfileFullyComplete] = useState(false);
  const [assessmentsComplete, setAssessmentsComplete] = useState(false);
  /** False until first profile/onboarding progress fetch finishes (avoids Complete → Edit flash). */
  const [profileCtaLoaded, setProfileCtaLoaded] = useState(false);
  const [profileCtaBusy, setProfileCtaBusy] = useState(false);

  useEffect(() => {
    loadWebFontsOnce();
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email ?? user?.email ?? null;
      if (cancelled || !isAmoraeaAdminConsoleEmail(email)) return;
      navigation.replace('Aria', { userId, openAdminPanel: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user?.email, navigation]);

  /**
   * Keep stack aligned with DB. `users.interview_passed` can lag attempt `passed` after the 48h reveal —
   * do not send passed applicants to legacy `PostInterview` when the attempt snapshot already says pass.
   */
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? userId;
      if (!uid) return;
      const [userRow, snap] = await Promise.all([
        fetchUserInterviewRevealPollRow(uid),
        fetchInterviewAttemptRevealSnapshot(uid),
      ]);
      if (cancelled) return;
      if (userRow?.interview_completed !== true) {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        navigation.replace('Aria', { userId: uid });
        return;
      }
      const target = resolveStandardPostInterviewStackRoute(snap ?? undefined);
      if (target === 'PostInterviewPassed') {
        return;
      }
      if (target === 'PostInterviewFailed') {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        queryClient.invalidateQueries({ queryKey: ['standardPostInterviewDeferral', uid] });
        navigation.replace('PostInterviewFailed', { userId: uid });
        return;
      }
      if (target === 'PostInterview') {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        queryClient.invalidateQueries({ queryKey: ['standardPostInterviewDeferral', uid] });
        navigation.replace('PostInterview', { userId: uid });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, navigation, queryClient]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? userId;
      if (!uid) return;
      const [{ data: codeRow }, { data: userRow }] = await Promise.all([
        supabase.from('referral_codes').select('code').eq('referrer_user_id', uid).maybeSingle(),
        supabase
          .from(USER_INTERVIEW_ROUTING_TABLE)
          .select(USER_REFERRAL_NOTICE_SELECT)
          .eq('id', uid)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setMyReferralCode(codeRow?.code ?? null);
      setReferralNotice(userRow?.referral_notice_pending ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? userId;
        if (!uid) {
          if (!cancelled) setProfileCtaLoaded(true);
          return;
        }
        try {
          const [progress, profileResult, assessmentsDone] = await Promise.all([
            modalOnboardingService.getProgress(uid),
            profilesRepo.getProfile(uid),
            areDatingProfileAssessmentsComplete(uid),
          ]);
          if (cancelled) return;
          if (progress.success && progress.data?.currentStep) {
            setDatingModalResumeStep(progress.data.currentStep);
          } else {
            setDatingModalResumeStep(null);
          }
          if (profileResult.success && profileResult.data) {
            const profile = profileResult.data as Record<string, unknown>;
            setDatingProfileFullyComplete(profile.onboardingCompleted === true);
            setAssessmentsComplete(assessmentsDone);
          } else {
            setDatingProfileFullyComplete(false);
            setAssessmentsComplete(assessmentsDone);
          }
        } catch (e) {
          if (__DEV__) {
            console.warn('[PostInterviewPassed] profile progress refresh', e);
          }
        } finally {
          if (!cancelled) setProfileCtaLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const profileReadyForMatching = datingProfileFullyComplete && assessmentsComplete;
  const profileCtaLabel = profileReadyForMatching ? 'Edit your profile' : 'Complete your profile';

  const profileTimeEstimateLabel = profileReadyForMatching
    ? null
    : POST_INTERVIEW_PROFILE_TIME_ESTIMATE;

  /**
   * Re-resolve modal progress at tap time (React state can lag `useFocusEffect`) and use `push` for edit so React
   * Navigation does not briefly activate an older `DatingProfileOnboarding` route via `navigate` deduping.
   */
  const openProfileCta = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? userId;
    if (!uid) return;
    setProfileCtaBusy(true);
    try {
      const progress = await modalOnboardingService.getProgress(uid);
      const profileResult = await profilesRepo.getProfile(uid);
      const profileAssessmentsComplete = await areDatingProfileAssessmentsComplete(uid);
      let goEdit = datingProfileFullyComplete && assessmentsComplete;
      if (progress.success && progress.data?.currentStep) {
        const step = progress.data.currentStep;
        setDatingModalResumeStep(step);
      }
      if (profileResult.success && profileResult.data) {
        const profile = profileResult.data as Record<string, unknown>;
        const profileOnboardingComplete = profile.onboardingCompleted === true;
        goEdit = profileOnboardingComplete && profileAssessmentsComplete;
        setDatingProfileFullyComplete(profileOnboardingComplete);
        setAssessmentsComplete(profileAssessmentsComplete);
      }
      if (goEdit) {
        navigation.dispatch(StackActions.push('DatingProfileEdit', { userId: uid }));
      } else {
        navigateToDatingProfileOnboardingEntry(navigation, uid);
      }
    } finally {
      setProfileCtaBusy(false);
    }
  }, [userId, navigation, datingProfileFullyComplete, assessmentsComplete]);

  const confirmAndRetakeInterview = () => {
    const msg =
      'Start a new interview run? Your previous scores stay on the server for review; you will go through the interview again.';
    const run = () => {
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? userId;
        if (!uid) return;
        setRetakeBusy(true);
        try {
          await enableInterviewRetake(uid);
          await queryClient.invalidateQueries({ queryKey: ['profile', uid] });
          navigation.replace('Aria', { userId: uid });
        } catch (e) {
          const detail =
            e instanceof Error ? e.message : typeof e === 'string' ? e : 'Could not reset the interview.';
          showSimpleAlert('Could not reset', detail);
        } finally {
          setRetakeBusy(false);
        }
      })();
    };
    showConfirmDialog(
      { title: 'Retake test?', message: msg, confirmText: 'Retake' },
      run
    );
  };

  const dismissReferralNotice = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? userId;
    if (!uid || !referralNotice) return;
    try {
      await clearReferralNoticePending(uid);
    } catch (error) {
      if (__DEV__) {
        console.warn(
          '[PostInterviewPassed] clear referral notice',
          error instanceof Error ? error.message : error,
        );
      }
    }
    setReferralNotice(null);
    queryClient.invalidateQueries({ queryKey: ['profile', uid] });
  };

  const copyReferralCode = async () => {
    if (!myReferralCode) return;
    try {
      await Clipboard.setStringAsync(myReferralCode);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    } catch (e) {
      if (__DEV__) console.warn('[PostInterviewPassed] clipboard', e);
    }
  };

  const openWhatsAppCommunity = () => {
    void Linking.openURL(WHATSAPP_COMMUNITY_URL);
  };

  return (
    <PostInterviewScrollLayout>
        <FlickeringFlame size={104} />
        <Text style={styles.h1}>You passed the interview!</Text>
        <Text style={styles.sub}>
          Welcome to a small, exclusive group of relationship-ready singles who are serious about connection — and willing
          to do the work.
        </Text>

        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <View style={styles.pulseWrap}>
              <View style={styles.pulseDot} />
            </View>
            <View style={styles.badgePass}>
              <Text style={styles.badgeTextPass}>You&apos;re in</Text>
            </View>
          </View>

          {referralNotice ? (
            <View style={styles.referralNoticeBanner}>
              <Text style={styles.referralNoticeText}>{referralNotice}</Text>
              <Pressable onPress={dismissReferralNotice} style={styles.referralNoticeDismiss} hitSlop={8}>
                <Text style={styles.referralNoticeDismissLabel}>Dismiss</Text>
              </Pressable>
            </View>
          ) : null}

          {profileCtaLoaded ? (
            <>
              <PostInterviewProfileEncouragement timeEstimateLabel={profileTimeEstimateLabel} />

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
                  <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.9)" style={{ marginLeft: 8 }} />
                )}
              </Pressable>
              {!profileReadyForMatching ? (
                <Text style={styles.profileOnboardingHint}>
                  Photos, match preferences, and short questionnaires — pick up where you left off anytime.
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

          <View style={styles.divider} />

          <Text style={styles.stayTitle}>Join the community on WhatsApp</Text>
          <Text style={styles.stayLead}>
            You&apos;re invited to our exclusive Amoraea group — get live event updates and connect with other members who
            passed the interview.
          </Text>
          <Pressable
            onPress={openWhatsAppCommunity}
            style={({ pressed }) => [styles.whatsAppCta, pressed && { opacity: 0.9 }]}
            accessibilityRole="link"
            accessibilityLabel="Open WhatsApp community invite"
          >
            <Ionicons name="logo-whatsapp" size={22} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.whatsAppCtaText}>Join the WhatsApp group</Text>
            <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.95)" style={{ marginLeft: 8 }} />
          </Pressable>
          <Text style={styles.linkUrl} selectable>
            {WHATSAPP_COMMUNITY_URL}
          </Text>

          <View style={styles.divider} />
          <DownloadPersonalReportButton userId={userId} variant="dark" />

          <ValidationFlowOptInCard userId={userId} returnRoute="PostInterviewPassed" />

          {myReferralCode ? (
            <View style={styles.referFriendSection}>
              <View style={styles.referFriendDivider} />
              <Text style={styles.referFriendTitle}>Know someone who can pass?</Text>
              <Text style={styles.referFriendBody}>
                Share your personal code with someone you think is ready. If they complete the full interview,
                you will both receive a 20% discount at our next event!
              </Text>
              <View style={styles.codeBlockRow}>
                <Text style={styles.codeBlockText} selectable>
                  {myReferralCode}
                </Text>
                <Pressable
                  onPress={copyReferralCode}
                  style={({ pressed }) => [styles.copyCodeBtn, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.copyCodeBtnLabel}>{copyFeedback ? 'Copied' : 'Copy'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
        {showPostInterviewRetake ? (
          <View style={styles.retakeSection}>
            <Pressable
              onPress={confirmAndRetakeInterview}
              disabled={retakeBusy}
              style={({ pressed }) => [
                styles.retakeButton,
                pressed && !retakeBusy && { opacity: 0.88 },
                retakeBusy && { opacity: 0.55 },
              ]}
            >
              {retakeBusy ? <ActivityIndicator color="#93c5fd" /> : <Text style={styles.retakeButtonLabel}>Retake test</Text>}
            </Pressable>
            <Text style={styles.retakeHint}>
              Starts a new interview run. Your prior scores stay on file for review.
            </Text>
          </View>
        ) : null}
    </PostInterviewScrollLayout>
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
    padding: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  pulseWrap: { marginRight: 8, justifyContent: 'center' },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  badgePass: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.45)',
    backgroundColor: 'rgba(34, 197, 94, 0.14)',
  },
  badgeTextPass: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: '#86efac',
    letterSpacing: 0.3,
  },
  profileCtaLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: 8,
    marginBottom: 10,
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
    marginTop: 8,
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
    marginBottom: 8,
    textAlign: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginVertical: 22,
  },
  stayTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 20,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 10,
  },
  stayLead: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.88)',
    marginBottom: 12,
  },
  linkUrl: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 4,
  },
  whatsAppCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#128C7E',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(37, 211, 102, 0.45)',
  },
  whatsAppCtaText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  referralNoticeBanner: {
    width: '100%',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 18,
  },
  referralNoticeText: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.92)',
    marginBottom: 10,
  },
  referralNoticeDismiss: { alignSelf: 'flex-end' },
  referralNoticeDismissLabel: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '600', color: ACCENT },
  referFriendSection: { width: '100%', marginTop: 20, marginBottom: 4 },
  referFriendDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 20 },
  referFriendTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 19,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 10,
  },
  referFriendBody: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 14,
  },
  codeBlockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  codeBlockText: {
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: 1.2,
    color: '#f8fafc',
  },
  copyCodeBtn: { backgroundColor: 'rgba(59,130,246,0.25)', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  copyCodeBtnLabel: { fontFamily: FONT_BODY, fontSize: 13, fontWeight: '600', color: '#93c5fd' },
  retakeSection: { width: '100%', maxWidth: 440, alignSelf: 'center', marginTop: 28, paddingHorizontal: 4, alignItems: 'center' },
  retakeButton: {
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.55)',
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  retakeButtonLabel: { fontFamily: FONT_BODY, fontSize: 15, fontWeight: '600', color: '#93c5fd' },
  retakeHint: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 8,
  },
});
