import React, { useState, useEffect, useRef } from 'react';
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
import {
  AUTH_EMAIL_RESEND_COOLDOWN_MS,
  getAuthEmailSendErrorMessage,
  useAuth,
} from '@features/authentication/hooks/useAuth';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ForgotPasswordScreen: React.FC<{ navigation: { navigate: (route: string) => void; goBack: () => void } }> = ({
  navigation,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPasswordForEmail } = useAuth();
  const lastSubmitMsRef = useRef(0);

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

  const handleSubmit = async () => {
    if (loading) return;
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Please enter your email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    const now = Date.now();
    const elapsed = now - lastSubmitMsRef.current;
    if (lastSubmitMsRef.current > 0 && elapsed < AUTH_EMAIL_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((AUTH_EMAIL_RESEND_COOLDOWN_MS - elapsed) / 1000);
      setError(`Please wait ${waitSec} seconds before requesting another reset link.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPasswordForEmail(trimmed);
      lastSubmitMsRef.current = Date.now();
      setSent(true);
    } catch (err) {
      lastSubmitMsRef.current = Date.now();
      setError(
        getAuthEmailSendErrorMessage(
          err,
          'Something went wrong. Please try again in a moment.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator
          bounces
        >
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}
          {Platform.OS === 'web' && <View style={authStyles.ambientGlow} pointerEvents="none" />}

          <View style={[authStyles.inner, styles.innerCentered]}>
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

            {sent ? (
              <>
                <Text style={authStyles.sentScreenTitle}>Check your email</Text>
                <Text style={[authStyles.sentScreenBody, styles.sentBodySpacing]}>
                  {"We've sent a password reset link."}
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('Login')}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>Back to sign in</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[authStyles.tagline, styles.taglineTight]}>
                  Enter your email and we&apos;ll send a reset link.
                </Text>

                <TextInput
                  testID="forgot-password-email-input"
                  placeholder="Email"
                  placeholderTextColor="#5B6B80"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="go"
                  style={authStyles.input}
                  onSubmitEditing={() => void handleSubmit()}
                  onKeyPress={(e) => {
                    if (Platform.OS === 'web' && e.nativeEvent.key === 'Enter') {
                      (e as unknown as { preventDefault?: () => void }).preventDefault?.();
                      void handleSubmit();
                    }
                  }}
                />

                {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

                <Pressable
                  testID="forgot-password-submit-button"
                  onPress={() => void handleSubmit()}
                  disabled={loading}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>
                    {loading ? '...' : 'Send reset link'}
                  </Text>
                </Pressable>

                <Text style={authStyles.footerText}>
                  <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                    ← Back to sign in
                  </Text>
                </Text>
              </>
            )}
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
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  innerCentered: {
    alignItems: 'center',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: 8,
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
  sentBodySpacing: {
    marginBottom: 28,
  },
});
