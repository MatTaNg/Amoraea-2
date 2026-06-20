import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  Pressable,
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
  const [passedCount, setPassedCount] = useState<number | null>(null);
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

  const counterDisplay = passedCount == null ? '—' : String(passedCount);

  return (
    <PostInterviewScrollLayout>
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
