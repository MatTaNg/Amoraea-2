import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Animated,
  Easing,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { PostInterviewScrollLayout } from '@app/screens/onboarding/PostInterviewScrollLayout';
import { FlameOrb } from '@app/screens/FlameOrb';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '@data/supabase/client';
import { clearReferralNoticePending } from '@data/repos/usersRoutingRepo';
import {
  USER_INTERVIEW_ROUTING_TABLE,
  USER_REFERRAL_NOTICE_SELECT,
} from '@data/supabase/userInterviewRoutingSelect';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import type { InterviewAttemptRevealFields } from '@utilities/postInterviewProcessingGate';
import { fetchInterviewAttemptRevealSnapshot, fetchUserInterviewRevealPollRow } from '@utilities/fetchInterviewAttemptRevealSnapshot';
import { useInterviewAttemptEgoRepair } from '@features/aria/hooks/useInterviewAttemptEgoRepair';
import { DownloadPersonalReportButton } from '@features/psychometrics/DownloadPersonalReportButton';
import { determinePostInterviewRoute } from '@features/psychometrics/determinePostInterviewRoute';
import { mapInterviewStackRouteForLaunchMode } from '@features/onboarding/postInterviewLaunchMode';
import { PreparingResultsView } from '@app/screens/PreparingResultsView';
import { useRedirectRelationshipValidationFromStandardPostInterview } from '@features/relationshipValidation/validationPostInterviewRouting';
import { useRedirectPostInterviewLaunchWhenEnabled } from '@features/onboarding/postInterviewLaunchMode';
import { PostInterviewReferFriendSection } from '@features/referrals/PostInterviewReferFriendSection';

const BG = '#0a0a0f';
const ACCENT = '#3b82f6';
const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';

const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;
const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;1,9..40,400&display=swap';

const REVIEW_BULLETS = [
  'Exclusive app: Only people who are relationship-ready get in',
  'Matched on real compatibility metrics backed by science, your attachment style, values, and more',
  'Exclusive events filled with people that are relationship-ready. Get to know who you\'re most compatible with before the event even starts!',
] as const;

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

function PulsingDot() {
  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0.35,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <Animated.View
      style={{
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: ACCENT,
        marginRight: 8,
        opacity: pulse,
      }}
    />
  );
}

async function fetchLatestAttemptSnapshotForUser(userId: string): Promise<InterviewAttemptRevealFields | null> {
  return fetchInterviewAttemptRevealSnapshot(userId);
}

/**
 * Legacy entry route — redirects to {@link PostInterviewScreen} or pass/fail when reveal is ready.
 * New completions should hand off to `PostInterview` directly from {@link AriaScreen}.
 */
export const PostInterviewProcessingScreen: React.FC<{
  navigation: { replace: (name: string, params: { userId: string }) => void };
  route: { params: { userId: string } };
}> = ({ navigation, route }) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = route.params?.userId ?? '';
  useRedirectPostInterviewLaunchWhenEnabled(navigation, userId);
  const { isRedirecting: validationRedirecting } =
    useRedirectRelationshipValidationFromStandardPostInterview(userId);
  const isAdminEmail = isAmoraeaAdminConsoleEmail(user?.email ?? '');
  useInterviewAttemptEgoRepair({
    userId,
    isAdmin: isAdminEmail,
    sourceScreen: 'PostInterviewProcessing',
  });
  const [latestAttemptId, setLatestAttemptId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** False until first reveal poll finishes — avoids flashing "in review" when routing straight to pass/fail. */
  const [revealGateReady, setRevealGateReady] = useState(false);
  const navigatedRef = useRef(false);

  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const applyRevealIfNeeded = useCallback(
    (
      row: InterviewAttemptRevealFields | null,
      usersInterviewPassed: boolean | null | undefined,
      attemptId: string | null,
      usersInterviewPassedAdminOverride?: boolean | null,
      usersInterviewPassedComputed?: boolean | null,
    ) => {
      if (navigatedRef.current) return;
      void (async () => {
        const decision = determinePostInterviewRoute(row ?? undefined);
        const destination = mapInterviewStackRouteForLaunchMode(decision.route);
        if (navigatedRef.current) return;
        navigatedRef.current = true;
        queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        queryClient.invalidateQueries({ queryKey: ['standardPostInterviewDeferral', userId] });
        navigation.replace(destination, { userId });
      })();
    },
    [navigation, queryClient, userId],
  );

  const refreshAttempt = useCallback(async () => {
    if (!userId) return;
    try {
      const [u, snap] = await Promise.all([
        fetchUserInterviewRevealPollRow(userId),
        fetchLatestAttemptSnapshotForUser(userId),
      ]);
      setLoadError(null);
      const aid = typeof u?.latest_attempt_id === 'string' ? u.latest_attempt_id : null;
      setLatestAttemptId(aid);
      const adminOverride = u?.interview_passed_admin_override;
      const passedComputed = u?.interview_passed_computed;
      applyRevealIfNeeded(snap, u?.interview_passed ?? undefined, aid, adminOverride, passedComputed);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load status');
    } finally {
      if (!navigatedRef.current) {
        setRevealGateReady(true);
      }
    }
  }, [userId, applyRevealIfNeeded]);

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
      navigation.replace('Amoraea', { userId, openAdminPanel: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, user?.email, navigation]);

  /**
   * Referral fields only. Does not branch on `interview_passed` — this screen owns routing
   * via attempt-level 48h reveal (`applyRevealIfNeeded`).
   */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? userId;
      if (!uid) return;
      const [{ data: codeRow }, { data: userRow }] = await Promise.all([
        supabase.from('users').select('invite_code').eq('id', uid).maybeSingle(),
        supabase
          .from(USER_INTERVIEW_ROUTING_TABLE)
          .select(USER_REFERRAL_NOTICE_SELECT)
          .eq('id', uid)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      setMyReferralCode(codeRow?.invite_code ?? null);
      setReferralNotice(userRow?.referral_notice_pending ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    navigatedRef.current = false;
    setRevealGateReady(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    void refreshAttempt();
  }, [userId, refreshAttempt]);

  useEffect(() => {
    if (!userId) return;
    const t = setInterval(() => {
      void refreshAttempt();
    }, 10_000);
    return () => clearInterval(t);
  }, [userId, refreshAttempt]);

  useEffect(() => {
    if (!latestAttemptId) return;
    const channel = supabase
      .channel(`interview_attempt_${latestAttemptId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'interview_attempts',
          filter: `id=eq.${latestAttemptId}`,
        },
        () => {
          void refreshAttempt();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [latestAttemptId, refreshAttempt]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`user_reveal_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${userId}`,
        },
        () => {
          void refreshAttempt();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, refreshAttempt]);

  const dismissReferralNotice = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? userId;
    if (!uid || !referralNotice) return;
    try {
      await clearReferralNoticePending(uid);
    } catch (error) {
      if (__DEV__) {
        console.warn(
          '[PostInterviewProcessing] clear referral notice',
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
      if (__DEV__) console.warn('[PostInterviewProcessing] clipboard', e);
    }
  };

  if (validationRedirecting) {
    return <PreparingResultsView />;
  }

  if (!revealGateReady) {
    return (
      <PostInterviewScrollLayout>
        <View style={styles.revealGate}>
          <ActivityIndicator size="large" color={ACCENT} />
        </View>
      </PostInterviewScrollLayout>
    );
  }

  return (
    <PostInterviewScrollLayout>
        <FlickeringFlame size={104} />

        <Text style={styles.h1}>Your application is in review</Text>
        <Text style={styles.sub}>We&apos;ll be in touch once your application has been reviewed.</Text>

        <View style={styles.card}>
          {loadError ? <Text style={styles.err}>{loadError}</Text> : null}

          {referralNotice ? (
            <View style={styles.referralNoticeBanner}>
              <Text style={styles.referralNoticeText}>{referralNotice}</Text>
              <Pressable onPress={dismissReferralNotice} style={styles.referralNoticeDismiss} hitSlop={8}>
                <Text style={styles.referralNoticeDismissLabel}>Dismiss</Text>
              </Pressable>
            </View>
          ) : null}

          <View style={styles.bullets}>
            {REVIEW_BULLETS.map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={18} color={ACCENT} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.stayTitle}>Stay in the loop</Text>
          <Text style={styles.stayLead}>
            We will email you at the address you used to sign in once your application has been reviewed.
          </Text>

          <View style={styles.divider} />
          <DownloadPersonalReportButton userId={userId} variant="dark" />

          {myReferralCode ? (
            <PostInterviewReferFriendSection
              referralCode={myReferralCode}
              copyFeedback={copyFeedback}
              onCopyPress={() => void copyReferralCode()}
            />
          ) : null}
        </View>
    </PostInterviewScrollLayout>
  );
};

const styles = StyleSheet.create({
  revealGate: {
    flex: 1,
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
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
  err: { fontFamily: FONT_BODY, fontSize: 13, color: '#f87171', marginBottom: 14 },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  badge: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  badgeText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
    letterSpacing: 0.3,
  },
  bullets: {
    gap: 12,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  bulletIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  bulletText: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.88)',
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
  referralNoticeDismiss: {
    alignSelf: 'flex-end',
  },
  referralNoticeDismissLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: ACCENT,
  },
});
