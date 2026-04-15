import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Platform,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { Ionicons } from '@expo/vector-icons';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { supabase } from '@data/supabase/client';
import { FlameOrb } from '@app/screens/FlameOrb';
import * as Clipboard from 'expo-clipboard';
import { useQueryClient } from '@tanstack/react-query';
import {
  isQaRetakeSignupCode,
  resetInterviewForQaRetake,
} from '@features/onboarding/qaRetake';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';

const BG = '#0a0a0f';
const ACCENT = '#3b82f6';
/** Success callout for launch-notification confirmation (readable on dark BG). */
const LAUNCH_CONFIRM_TEXT = '#86efac';
const LAUNCH_CONFIRM_BORDER = 'rgba(74, 222, 128, 0.38)';
const LAUNCH_CONFIRM_BG = 'rgba(34, 197, 94, 0.14)';
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

function digitsOnly(s: string): string {
  return s.replace(/\D/g, '');
}

/**
 * Validate and normalize to E.164 for `users.launch_notification_phone`.
 * libphonenumber first; fallback for common US 10/11-digit entry without +country.
 */
function normalizeLaunchNotificationPhone(
  raw: string
): { ok: true; e164: string } | { ok: false } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false };

  const parsed =
    parsePhoneNumberFromString(trimmed, 'US') ?? parsePhoneNumberFromString(trimmed);
  if (parsed && (parsed.isValid() || parsed.isPossible()) && parsed.number && parsed.number.length >= 8) {
    return { ok: true, e164: parsed.number };
  }

  const d = digitsOnly(trimmed);
  if (d.length === 10 && /^[2-9]\d{2}[2-9]\d{6}$/.test(d)) {
    return { ok: true, e164: `+1${d}` };
  }
  if (d.length === 11 && d.startsWith('1')) {
    const rest = d.slice(1);
    if (/^[2-9]\d{2}[2-9]\d{6}$/.test(rest)) {
      return { ok: true, e164: `+1${rest}` };
    }
  }
  if (d.length >= 11 && d.length <= 15 && d[0] !== '0') {
    return { ok: true, e164: `+${d}` };
  }
  return { ok: false };
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
          useNativeDriver: true,
        }),
        Animated.timing(flicker, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
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
      ])
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

/**
 * Post-interview confirmation for standard (non–alpha) applicants: no scores, no pass/fail, application in review.
 */
export const PostInterviewScreen: React.FC<{ navigation: any; route: { params: { userId: string } } }> = ({
  route,
  navigation,
}) => {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = route.params?.userId ?? '';
  const [phone, setPhone] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [savedPhone, setSavedPhone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [saveErrorDetail, setSaveErrorDetail] = useState<string | null>(null);
  const [myReferralCode, setMyReferralCode] = useState<string | null>(null);
  const [referralNotice, setReferralNotice] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showPostInterviewRetake, setShowPostInterviewRetake] = useState(false);
  const [retakeBusy, setRetakeBusy] = useState(false);
  /** False until `users` launch-notification fields are read — avoids flashing the phone field then the confirmation. */
  const [launchContactPrefsLoaded, setLaunchContactPrefsLoaded] = useState(false);

  useEffect(() => {
    loadWebFontsOnce();
  }, []);

  /** Admin account uses cohort tools on Aria, not this branded applicant screen. */
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? userId;
        if (!uid) return;
        const meta = auth.user?.user_metadata as { referral_code?: string } | undefined;
        if (!cancelled) setShowPostInterviewRetake(isQaRetakeSignupCode(meta?.referral_code));
        const [{ data: codeRow }, { data: userRow }] = await Promise.all([
          supabase.from('referral_codes').select('code').eq('referrer_user_id', uid).maybeSingle(),
          supabase
            .from('users')
            .select('referral_notice_pending, launch_notification_phone, launch_notification_submitted_at')
            .eq('id', uid)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        setMyReferralCode(codeRow?.code ?? null);
        setReferralNotice(userRow?.referral_notice_pending ?? null);
        const storedPhone =
          typeof userRow?.launch_notification_phone === 'string'
            ? userRow.launch_notification_phone.trim()
            : '';
        const submittedAt =
          typeof userRow?.launch_notification_submitted_at === 'string'
            ? userRow.launch_notification_submitted_at.trim()
            : '';
        if (storedPhone.length > 0) {
          setSubmitted(true);
          setSavedPhone(true);
        } else if (submittedAt.length > 0) {
          setSubmitted(true);
          setSavedPhone(false);
        }
      } finally {
        if (!cancelled) setLaunchContactPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

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
          if (__DEV__) console.warn('[PostInterview] QA retake failed', e);
          const detail =
            e instanceof Error ? e.message : typeof e === 'string' ? e : 'Could not reset the interview.';
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert(`Could not reset: ${detail}`);
          } else {
            Alert.alert('Could not reset', detail);
          }
        } finally {
          setRetakeBusy(false);
        }
      })();
    };
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(msg)) run();
      return;
    }
    Alert.alert('Retake test?', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Retake', style: 'destructive', onPress: run },
    ]);
  };

  /** Validate + save phone to `users.launch_notification_phone`. Omitting SMS is fine — sign-in email is used for updates. */
  const onSavePhone = async () => {
    const trimmed = phone.trim();
    setFieldError(null);
    setSaveError(false);
    setSaveErrorDetail(null);

    if (!trimmed) {
      setFieldError('Enter a valid phone number to save SMS updates.');
      return;
    }

    const normalized = normalizeLaunchNotificationPhone(trimmed);
    if (!normalized.ok) {
      setFieldError(
        "That doesn't look like a valid phone number. For US numbers include area code (10 digits). Use country code for international."
      );
      return;
    }

    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id ?? userId;
    if (!uid) {
      setSaveErrorDetail('Not signed in (no user id).');
      setSaveError(true);
      return;
    }

    setSubmitting(true);
    try {
      const { data: rowExists, error: selErr } = await supabase
        .from('users')
        .select('id')
        .eq('id', uid)
        .maybeSingle();
      if (selErr) throw selErr;
      if (!rowExists?.id) {
        throw new Error(
          'PROFILE_ROW_MISSING: No users row for this account. Try signing out and back in.'
        );
      }

      const { data, error: upErr } = await supabase
        .from('users')
        .update({
          launch_notification_phone: normalized.e164,
          launch_notification_submitted_at: new Date().toISOString(),
        })
        .eq('id', uid)
        .select('id')
        .maybeSingle();

      if (upErr) throw upErr;
      if (!data?.id) {
        throw new Error(
          'ROW_NOT_UPDATED: Update affected 0 rows (check RLS or that users.id matches your login).'
        );
      }
      setSavedPhone(true);
      setSubmitted(true);
    } catch (e: unknown) {
      const raw =
        typeof e === 'object' && e !== null && 'message' in e
          ? String((e as { message: unknown }).message)
          : e instanceof Error
            ? e.message
            : 'Save failed';
      setSaveErrorDetail(raw.length > 220 ? `${raw.slice(0, 220)}…` : raw);
      setSaveError(true);
      if (__DEV__) {
        console.warn('[PostInterviewScreen] save failed', e);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const dismissReferralNotice = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? userId;
    if (!uid || !referralNotice) return;
    const { error } = await supabase.from('users').update({ referral_notice_pending: null }).eq('id', uid);
    if (error && __DEV__) console.warn('[PostInterview] clear referral notice', error.message);
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
      if (__DEV__) console.warn('[PostInterview] clipboard', e);
    }
  };

  return (
    <SafeAreaContainer style={{ backgroundColor: BG, flex: 1 }}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        style={{ backgroundColor: BG }}
      >
        <FlickeringFlame size={104} />

        <Text style={styles.h1}>Your application is in review</Text>
        <Text style={styles.sub}>We&apos;ll be in touch once your application has been reviewed.</Text>

        <View style={styles.card}>
          <View style={styles.badgeRow}>
            <PulsingDot />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Launching Winter 2026</Text>
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
              'Exclusive app: Only people who are relationship-ready get in',
              'Matched on real compatibility metrics backed by science, your attachment style, values, and more',
              'Curated matches through an AI matchmaker that gets to know you more and more over time',
            ].map((line) => (
              <View key={line} style={styles.bulletRow}>
                <Ionicons name="checkmark-circle" size={18} color={ACCENT} style={styles.bulletIcon} />
                <Text style={styles.bulletText}>{line}</Text>
              </View>
            ))}
          </View>

          <View style={styles.divider} />

          <Text style={styles.stayTitle}>Stay in the loop</Text>
          <Text style={styles.stayLead}>
            We will email you once your application has been reviewed or when the app goes live!
          </Text>
          <Text style={styles.staySub}>
            If you would like SMS updates, enter your number below and tap Save. Otherwise we&apos;ll use your sign-in
            email for launch and review news.
          </Text>

          {saveError ? (
            <View style={styles.saveErrBlock}>
              <Text style={styles.saveErr}>Couldn&apos;t save your number. Please try again in a moment.</Text>
              {saveErrorDetail ? (
                <Text style={styles.saveErrDetail} selectable>
                  {saveErrorDetail}
                </Text>
              ) : null}
            </View>
          ) : null}

          {!launchContactPrefsLoaded ? (
            <View style={styles.launchPrefsPlaceholder} accessibilityLabel="Loading">
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : submitted ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirm}>
                {savedPhone
                  ? "You're all set, we'll text you when the app is close to launch!"
                  : "You're all set — we'll email you at the address you used to sign in when there's news."}
              </Text>
            </View>
          ) : (
            <>
              <TextInput
                value={phone}
                onChangeText={(t) => {
                  setPhone(t);
                  if (fieldError) setFieldError(null);
                }}
                placeholder="Phone for SMS updates (optional)"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="phone-pad"
                autoCapitalize="none"
                autoCorrect={false}
                textContentType="telephoneNumber"
                autoComplete="tel"
                style={[styles.input, fieldError && styles.inputError]}
              />
              {fieldError ? <Text style={styles.fieldHint}>{fieldError}</Text> : null}
              <Pressable
                onPress={onSavePhone}
                disabled={submitting}
                style={({ pressed }) => [styles.button, pressed && { opacity: 0.88 }]}
              >
                <Text style={styles.buttonLabel}>{submitting ? '…' : 'Save my number'}</Text>
              </Pressable>
            </>
          )}

          <View style={styles.privacyRow}>
            <Ionicons name="lock-closed-outline" size={14} color="rgba(255,255,255,0.45)" />
            <Text style={styles.privacy}>Your number is private. No spam. No sharing. Ever.</Text>
          </View>

          {myReferralCode ? (
            <View style={styles.referFriendSection}>
              <View style={styles.referFriendDivider} />
              <Text style={styles.referFriendTitle}>Give a friend a better shot.</Text>
              <Text style={styles.referFriendBody}>
                Share your personal code with someone you think is ready. If they complete the full interview,
                you&apos;ll both have a better chance of getting in.
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
              {retakeBusy ? (
                <ActivityIndicator color="#93c5fd" />
              ) : (
                <Text style={styles.retakeButtonLabel}>Retake test</Text>
              )}
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
  wordmark: {
    fontFamily: FONT_DISPLAY,
    fontSize: 32,
    fontWeight: '600',
    color: '#f4f4f5',
    letterSpacing: 1,
    marginBottom: 20,
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
  staySub: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255,255,255,0.65)',
    marginBottom: 16,
  },
  fieldHint: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: '#f87171',
    marginBottom: 10,
    marginTop: -8,
  },
  input: {
    fontFamily: FONT_BODY,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    color: '#fafafa',
    fontSize: 15,
    marginBottom: 12,
    width: '100%',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  button: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonLabel: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  confirmBox: {
    width: '100%',
    backgroundColor: LAUNCH_CONFIRM_BG,
    borderWidth: 1,
    borderColor: LAUNCH_CONFIRM_BORDER,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  confirm: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
    color: LAUNCH_CONFIRM_TEXT,
  },
  saveErr: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: '#f87171',
    marginBottom: 8,
  },
  saveErrBlock: {
    marginBottom: 12,
    width: '100%',
  },
  saveErrDetail: {
    fontFamily: FONT_BODY,
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(248,113,113,0.85)',
  },
  launchPrefsPlaceholder: {
    width: '100%',
    minHeight: 140,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 24,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    width: '100%',
  },
  privacy: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.45)',
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
  referFriendSection: {
    width: '100%',
    marginTop: 8,
    marginBottom: 4,
  },
  referFriendDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
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
  copyCodeBtn: {
    backgroundColor: 'rgba(59,130,246,0.25)',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  copyCodeBtnLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: '#93c5fd',
  },
  retakeSection: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    marginTop: 28,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
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
  retakeButtonLabel: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#93c5fd',
  },
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
