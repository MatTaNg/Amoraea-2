import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';
import { supabase } from '@data/supabase/client';
import { isAlphaTesterReferralCode } from '@/constants/alphaReferral';
import { normalizeShareableReferralCode } from '@features/referrals/shareableReferralCode';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [referralHint, setReferralHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { signUp } = useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, []);

  const handleRegister = async () => {
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!email?.trim() || !password || !confirm) {
      setError('Please fill in email and password.');
      return;
    }
    setError(null);
    setReferralHint(null);
    setLoading(true);
    try {
      const raw = inviteCode.trim();
      let codeToSend: string | undefined;
      if (raw) {
        if (isAlphaTesterReferralCode(raw)) {
          codeToSend = raw;
        } else {
          const normalizedShareable = normalizeShareableReferralCode(raw);
          if (normalizedShareable) {
            const { data: available, error: rpcErr } = await supabase.rpc('referral_code_is_available', {
              p_raw: raw,
            });
            if (rpcErr) {
              setError('Could not verify referral code. Try again or continue without one.');
              setLoading(false);
              return;
            }
            if (available === true) {
              codeToSend = raw;
            } else {
              setReferralHint("That code doesn't look right or has already been used.");
            }
          } else {
            codeToSend = raw;
          }
        }
      }
      await signUp(email.trim(), password, codeToSend ? { inviteCode: codeToSend } : undefined);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <SafeAreaContainer style={styles.safeBg}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.sentScrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}
          <View style={[authStyles.inner, styles.sentInner]}>
            <Text style={styles.sentIcon}>✦</Text>
            <Text style={authStyles.sentScreenTitle}>Check your email.</Text>
            <Text style={authStyles.sentScreenBody}>
              {`We've sent a confirmation link to `}
              <Text style={{ color: '#C8E4FF' }}>{email}</Text>
              {`. Open it to complete your registration and begin your interview.`}
            </Text>
            <View style={authStyles.divider} />
            <Text style={authStyles.footerText}>
              Already have an account?{' '}
              <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                Sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {Platform.OS === 'web' && (
          <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
        )}
        {Platform.OS === 'web' ? (
          <View style={[authStyles.ambientGlow, authStyles.ambientGlowRegister]} pointerEvents="none" />
        ) : null}

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <View style={[styles.wordmarkRow, styles.wordmarkTight]}>
            <Text style={[authStyles.wordmark, styles.wordmarkNoBottomMargin]}>
              amor<Text style={authStyles.wordmarkAe}>æ</Text>a
            </Text>
            <Text style={styles.wordmarkBeta}>(BETA)</Text>
          </View>
          <View style={styles.flameWrap}>
            <View style={styles.flameScale}>
              <FlameOrb state="idle" minimalGlow />
            </View>
          </View>
          <Text style={[authStyles.tagline, styles.taglineTight]}>Begin with honesty.</Text>

          <View style={[authStyles.inner, styles.innerCentered]}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#5B6B80"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={authStyles.input}
            />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#5B6B80"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={authStyles.input}
            />

            <TextInput
              placeholder="Confirm password"
              placeholderTextColor="#5B6B80"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              style={authStyles.input}
            />

            <TextInput
              placeholder="Have a referral code? Enter it here."
              placeholderTextColor="#5B6B80"
              value={inviteCode}
              onChangeText={(t) => {
                setInviteCode(t);
                if (referralHint) setReferralHint(null);
              }}
              autoCapitalize="characters"
              style={[authStyles.input, authStyles.inputOptional, { marginBottom: referralHint ? 8 : 18 }]}
            />
            {referralHint ? (
              <Text
                style={[authStyles.footerText, { color: 'rgba(248,180,140,0.95)', marginBottom: 18, lineHeight: 20 }]}
              >
                {referralHint}
              </Text>
            ) : null}

            {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={[authStyles.primaryButton, styles.button]}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? '...' : 'Create Account →'}
              </Text>
            </Pressable>

            <Text style={authStyles.confirmationNote}>
              {"You'll receive a confirmation email to verify your address."}
            </Text>

            <View style={authStyles.divider} />

            <Text style={authStyles.footerText}>
              Already have an account?{' '}
              <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                Sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  safeBg: {
    backgroundColor: '#05060D',
    flex: 1,
  },
  keyboard: {
    flex: 1,
    width: '100%',
    backgroundColor: '#05060D',
  },
  scroll: {
    flex: 1,
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 48,
    alignItems: 'center',
    width: '100%',
  },
  sentScrollContent: {
    flexGrow: 1,
    paddingVertical: 32,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  wordmarkNoBottomMargin: {
    marginBottom: 0,
    textAlign: 'left',
  },
  wordmarkBeta: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#3D5470',
  },
  wordmarkTight: {
    marginBottom: 18,
  },
  taglineTight: {
    marginBottom: 24,
    textAlign: 'center',
    width: '100%',
  },
  innerCentered: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    alignSelf: 'center',
    ...(Platform.OS === 'web'
      ? ({
          marginLeft: 'auto',
          marginRight: 'auto',
        } as const)
      : {}),
  },
  /** minHeight avoids RN Web collapsing the row when a web <div> flame is scaled inside Views. */
  flameWrap: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
    overflow: 'visible',
  },
  /** Match LoginScreen scale so the flame stays visible on narrow / mobile web. */
  flameScale: {
    transform: [{ scale: 0.52 }],
  },
  button: {
    marginBottom: 0,
  },
  sentInner: {
    alignItems: 'center',
    textAlign: 'center',
  },
  sentIcon: {
    fontSize: 32,
    marginBottom: 20,
    color: '#C8E4FF',
  },
});
