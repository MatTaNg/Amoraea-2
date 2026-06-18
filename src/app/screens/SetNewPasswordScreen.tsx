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
import { useAuth, getAuthUpdatePasswordErrorMessage } from '@features/authentication/hooks/useAuth';
import { debugAuthCallbackLog, sanitizeAuthUrlForLog } from '@features/authentication/debugAuthCallbackLog';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

const MIN_PASSWORD_LENGTH = 8;

export const SetNewPasswordScreen: React.FC<{ navigation: { navigate: (route: string) => void } }> = ({
  navigation,
}) => {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { updatePassword, clearPasswordRecoveryPending, passwordRecoveryLinkError, session, loading: authLoading } =
    useAuth();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    // #region agent log
    debugAuthCallbackLog(
      'SetNewPasswordScreen.tsx:mount',
      'SetNewPassword screen mounted',
      {
        ...sanitizeAuthUrlForLog(
          window.location.pathname,
          window.location.search,
          window.location.hash,
        ),
        hasSession: Boolean(session),
        authLoading,
        linkExpired: Boolean(passwordRecoveryLinkError),
      },
      'H5',
      'post-fix',
    );
    // #endregion
  }, []);

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
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await updatePassword(password);
      setSuccess(true);
    } catch (err) {
      setError(getAuthUpdatePasswordErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    clearPasswordRecoveryPending();
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.assign('/');
      return;
    }
    navigation.navigate('Login');
  };

  const linkExpired = Boolean(passwordRecoveryLinkError);
  const awaitingResetLink = !authLoading && !session && !linkExpired && !success;

  if (linkExpired) {
    return (
      <SafeAreaContainer style={styles.safeBg}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}
          {Platform.OS === 'web' && <View style={authStyles.ambientGlow} pointerEvents="none" />}

          <View style={[authStyles.inner, styles.innerCentered]}>
            <Text style={authStyles.sentScreenTitle}>Reset link expired</Text>
            <Text style={[authStyles.sentScreenBody, styles.sentBodySpacing]}>
              {passwordRecoveryLinkError}
            </Text>
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={[authStyles.primaryButton, styles.button]}
            >
              <Text style={authStyles.primaryButtonText}>Request new reset link</Text>
            </Pressable>
            <Text style={authStyles.footerText}>
              <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                ← Back to sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  if (awaitingResetLink) {
    return (
      <SafeAreaContainer style={styles.safeBg}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}
          {Platform.OS === 'web' && <View style={authStyles.ambientGlow} pointerEvents="none" />}

          <View style={[authStyles.inner, styles.innerCentered]}>
            <Text style={authStyles.sentScreenTitle}>Open your reset link</Text>
            <Text style={[authStyles.sentScreenBody, styles.sentBodySpacing]}>
              We sent a password reset link to your email. Open that link in this browser tab, then come
              back here to choose a new password.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('ForgotPassword')}
              style={[authStyles.primaryButton, styles.button]}
            >
              <Text style={authStyles.primaryButtonText}>Request a new reset link</Text>
            </Pressable>
            <Text style={authStyles.footerText}>
              <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                ← Back to sign in
              </Text>
            </Text>
          </View>
        </ScrollView>
      </SafeAreaContainer>
    );
  }

  if (success) {
    return (
      <SafeAreaContainer style={styles.safeBg}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}
          {Platform.OS === 'web' && <View style={authStyles.ambientGlow} pointerEvents="none" />}

          <View style={[authStyles.inner, styles.innerCentered]}>
            <Text style={authStyles.sentScreenTitle}>Password updated</Text>
            <Text style={[authStyles.sentScreenBody, styles.sentBodySpacing]}>
              Your password has been changed. Sign in with your new password.
            </Text>
            <Pressable
              onPress={handleContinue}
              style={[authStyles.primaryButton, styles.button]}
            >
              <Text style={authStyles.primaryButtonText}>Go to sign in</Text>
            </Pressable>
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

            <Text style={[authStyles.tagline, styles.taglineTight]}>Choose a new password.</Text>

            <TextInput
              testID="set-new-password-input"
              placeholder="New password"
              placeholderTextColor="#5B6B80"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="next"
              style={authStyles.input}
            />

            <TextInput
              testID="set-new-password-confirm-input"
              placeholder="Confirm new password"
              placeholderTextColor="#5B6B80"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              returnKeyType="go"
              style={[authStyles.input, { marginBottom: 18 }]}
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
              testID="set-new-password-submit-button"
              onPress={() => void handleSubmit()}
              disabled={loading}
              style={[authStyles.primaryButton, styles.button]}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? '...' : 'Update password'}
              </Text>
            </Pressable>

            <Text style={authStyles.footerText}>
              <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                ← Back to sign in
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
