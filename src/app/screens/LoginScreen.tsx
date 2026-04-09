import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';

const isEmailNotConfirmedError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return lower.includes('email not confirmed') || lower.includes('confirm your email');
};

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

export const LoginScreen: React.FC<{ navigation: any; route?: { params?: { confirmEmail?: boolean } } }> = ({
  navigation,
  route,
}) => {
  const [email, setEmail] = useState('mattang5280@gmail.com');
  const [password, setPassword] = useState('Ab#3dragons');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const { signIn, resendConfirmationEmail } = useAuth();
  const confirmEmailMessage = route?.params?.confirmEmail ?? false;

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

  const handleLogin = async () => {
    if (!email?.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setResendSent(false);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        setError(
          'Please confirm your email before signing in. Check your inbox or resend the confirmation link below.'
        );
      } else {
        setError(err instanceof Error ? err.message : 'Incorrect email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email?.trim()) return;
    setResending(true);
    setError(null);
    try {
      await resendConfirmationEmail(email.trim());
      setResendSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend confirmation email');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <View style={styles.outerLock}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <View style={styles.contentWrap}>
            {Platform.OS === 'web' && <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />}
            {/* Web: soft page glow. Native: omit — bordered circle + shadow reads as a ring behind the flame. */}
            {Platform.OS === 'web' && <View style={authStyles.ambientGlow} pointerEvents="none" />}

            <View style={[authStyles.inner, styles.innerCentered]}>
              <Text style={[authStyles.wordmark, styles.wordmarkTight]}>
                amor<Text style={authStyles.wordmarkAe}>æ</Text>a
              </Text>

              <View style={styles.flameWrap}>
                <View style={styles.flameScale}>
                  <FlameOrb state="idle" minimalGlow />
                </View>
              </View>

              <Text style={[authStyles.tagline, styles.taglineTight]}>Enter to continue your journey.</Text>

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
                style={[authStyles.input, { marginBottom: 18 }]}
                onSubmitEditing={handleLogin}
              />

              {confirmEmailMessage && (
                <Text style={styles.successText}>
                  Check your email to confirm your account, then sign in below.
                </Text>
              )}

              {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

              {error && error.includes('confirm your email') && email?.trim() ? (
                <Pressable
                  onPress={handleResendConfirmation}
                  disabled={resendSent || resending}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>
                    {resendSent ? 'Confirmation email sent' : resending ? '...' : 'Resend confirmation email'}
                  </Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={handleLogin}
                disabled={loading}
                style={[authStyles.primaryButton, styles.button]}
              >
                <Text style={authStyles.primaryButtonText}>
                  {loading ? '...' : 'Sign In →'}
                </Text>
              </Pressable>

              <View style={authStyles.divider} />

              <Text style={authStyles.footerText}>
                Don't have an account?{' '}
                <Text style={authStyles.link} onPress={() => navigation.navigate('Register')}>
                  Apply to join
                </Text>
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  safeBg: {
    backgroundColor: '#05060D',
  },
  outerLock: {
    flex: 1,
    height: '100%',
    overflow: 'hidden',
    backgroundColor: '#05060D',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboard: {
    flex: 1,
    width: '100%',
  },
  contentWrap: {
    flex: 1,
    ...authStyles.fullScreen,
    paddingVertical: 24,
    paddingHorizontal: 24,
  },
  innerCentered: {
    alignItems: 'center',
  },
  wordmarkTight: {
    marginBottom: 18,
  },
  taglineTight: {
    marginBottom: 20,
  },
  flameWrap: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameScale: {
    transform: [{ scale: 0.52 }],
  },
  button: {
    marginBottom: 12,
  },
  successText: {
    color: '#5BA8E8',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
  },
});
