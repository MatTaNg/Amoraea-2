import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  Pressable,
  ScrollView,
  Platform,
  Animated,
  Easing,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@data/supabase/client';
import { FlameOrb } from '@app/screens/FlameOrb';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import { isQaRetakeSignupCode, resetInterviewForQaRetake } from '@features/onboarding/qaRetake';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { showConfirmDialog, showSimpleAlert } from '@utilities/alerts/confirmDialog';
import {
  evaluateStandardPostInterviewRevealWithUsersPassedFallback,
  standardPostInterviewRouteFromReveal,
} from '@utilities/postInterviewProcessingGate';
import { fetchInterviewAttemptRevealSnapshot } from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';

const BG = '#0a0a0f';
const ACCENT = '#3b82f6';
const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const EVENT_URL =
  'https://www.eventbrite.com/e/conscious-relating-games-dinner-tickets-1988944369149?aff=oddtdtcreator';
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
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showPostInterviewRetake, setShowPostInterviewRetake] = useState(false);
  const [retakeBusy, setRetakeBusy] = useState(false);
  /** Modal dating onboarding resume step from merged profile + draft (`complete` = all modal steps satisfied). */
  const [datingModalResumeStep, setDatingModalResumeStep] = useState<string | null>(null);
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
      const { data: row } = await supabase
        .from('users')
        .select('interview_passed, interview_completed')
        .eq('id', uid)
        .maybeSingle();
      if (cancelled) return;
      if (row?.interview_passed === false) {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        navigation.replace('PostInterviewFailed', { userId: uid });
        return;
      }
      if (row?.interview_passed === true) {
        return;
      }
      if (row?.interview_passed == null && row?.interview_completed !== true) {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        navigation.replace('Aria', { userId: uid });
        return;
      }
      const snap = await fetchInterviewAttemptRevealSnapshot(uid);
      if (cancelled) return;
      const target = standardPostInterviewRouteFromReveal(
        evaluateStandardPostInterviewRevealWithUsersPassedFallback(snap ?? undefined, row?.interview_passed ?? undefined),
      );
      if (target === 'PostInterviewPassed') {
        return;
      }
      if (target === 'PostInterviewFailed') {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        queryClient.invalidateQueries({ queryKey: ['standardPostInterviewDeferral', uid] });
        navigation.replace('PostInterviewFailed', { userId: uid });
        return;
      }
      if (target === 'PostInterviewProcessing') {
        queryClient.invalidateQueries({ queryKey: ['profile', uid] });
        queryClient.invalidateQueries({ queryKey: ['standardPostInterviewDeferral', uid] });
        navigation.replace('PostInterviewProcessing', { userId: uid });
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
      const meta = auth.user?.user_metadata as { referral_code?: string } | undefined;
      if (!cancelled) setShowPostInterviewRetake(isQaRetakeSignupCode(meta?.referral_code));
      const [{ data: codeRow }, { data: userRow }] = await Promise.all([
        supabase.from('referral_codes').select('code').eq('referrer_user_id', uid).maybeSingle(),
        supabase.from('users').select('referral_notice_pending').eq('id', uid).maybeSingle(),
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
        if (!uid) return;
        const progress = await modalOnboardingService.getProgress(uid);
        if (cancelled || !progress.success || !progress.data?.currentStep) return;
        setDatingModalResumeStep(progress.data.currentStep);
      })();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const datingModalComplete = datingModalResumeStep === 'complete';
  const profileCtaLabel = datingModalComplete ? 'Edit your profile' : 'Complete your profile';

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
      let goEdit = datingModalResumeStep === 'complete';
      if (progress.success && progress.data?.currentStep) {
        const step = progress.data.currentStep;
        setDatingModalResumeStep(step);
        goEdit = step === 'complete';
      }
      if (goEdit) {
        navigation.dispatch(StackActions.push('DatingProfileEdit', { userId: uid }));
      } else {
        navigation.navigate('DatingProfileOnboarding', { userId: uid });
      }
    } finally {
      setProfileCtaBusy(false);
    }
  }, [userId, navigation, datingModalResumeStep]);

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
          await resetInterviewForQaRetake(uid);
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
    const { error } = await supabase.from('users').update({ referral_notice_pending: null }).eq('id', uid);
    if (error && __DEV__) console.warn('[PostInterviewPassed] clear referral notice', error.message);
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

  const openEvent = () => {
    void Linking.openURL(EVENT_URL);
  };

  const openWhatsAppCommunity = () => {
    void Linking.openURL(WHATSAPP_COMMUNITY_URL);
  };

  return (
    <SafeAreaContainer style={{ backgroundColor: BG, flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: BG }}
      >
        <FlickeringFlame size={104} />
        <Text style={styles.h1}>You passed the interview</Text>
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

          <View style={styles.bullets}>
            {[
              'You completed our AI interview and met the bar for the Amoraea community',
              'Get matched on real compatibility — attachment, values, and more',
              'A curated experience for people who want something real, not performative',
            ].map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={18} color={ACCENT} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>

          {/* <Pressable
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
          <Text style={styles.profileOnboardingHint}>
            Next up: your name, photos, match preferences, and a few short assessments — everything we need to introduce
            you properly.
          </Text> */}

          <View style={styles.divider} />

          <Text style={styles.stayTitle}>Conscious Singles Dinner — Austin</Text>
          <Text style={styles.stayLead}>
            We&apos;re hosting a Conscious Relating Games & Dinner on <Text style={styles.strong}>Monday, May 11th</Text> (6:00–8:00
            PM). It&apos;s a curated, in-person evening for pre-screened singles. We will play connection games and then you will have the opportunity to connect deeper during dinner! Spots are limited, reserve yours on
            Eventbrite.
          </Text>
          <Pressable
            onPress={openEvent}
            style={({ pressed }) => [styles.eventCta, pressed && { opacity: 0.9 }]}
            accessibilityRole="link"
            accessibilityLabel="Open Conscious Singles Dinner on Eventbrite"
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.eventCtaText}>View event &amp; sign up</Text>
            <Ionicons name="open-outline" size={18} color="rgba(255,255,255,0.9)" style={{ marginLeft: 8 }} />
          </Pressable>
          <Text style={styles.eventUrl} selectable>
            {EVENT_URL}
          </Text>

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
          <Text style={styles.eventUrl} selectable>
            {WHATSAPP_COMMUNITY_URL}
          </Text>

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
      </ScrollView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 48,
    alignItems: 'center',
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
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
  bullets: { gap: 12 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start' },
  bulletIcon: { marginTop: 2, marginRight: 10 },
  bulletText: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.88)',
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
  strong: { fontWeight: '600', color: '#f4f4f5' },
  eventCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  eventCtaText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  eventUrl: {
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
