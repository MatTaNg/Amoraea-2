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
  AUTH_SMS_RESEND_COOLDOWN_MS,
  useAuth,
} from '@features/authentication/hooks/useAuth';
import { getAuthSmsSendErrorMessage } from '@features/authentication/authPhoneErrors';
import {
  isValidAuthPhoneInput,
  normalizeAuthPhoneE164,
} from '@features/authentication/normalizeAuthPhone';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { authStyles } from '@app/screens/authStyles';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

type Step = 'phone' | 'reset';

export const ForgotPasswordScreen: React.FC<{ navigation: { navigate: (route: string) => void; goBack: () => void } }> = ({
  navigation,
}) => {
  const [phone, setPhone] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const lastSubmitMsRef = useRef(0);
  const { sendPhonePasswordResetOtp, resetPasswordWithPhoneOtp } = useAuth();

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

  const handleSendCode = async () => {
    if (loading) return;
    if (!isValidAuthPhoneInput(phone)) {
      setError('Please enter a valid phone number (include area code).');
      return;
    }
    const e164 = normalizeAuthPhoneE164(phone);
    if (!e164) {
      setError('Please enter a valid phone number.');
      return;
    }
    const now = Date.now();
    const elapsed = now - lastSubmitMsRef.current;
    if (lastSubmitMsRef.current > 0 && elapsed < AUTH_SMS_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((AUTH_SMS_RESEND_COOLDOWN_MS - elapsed) / 1000);
      setError(`Please wait ${waitSec} seconds before requesting another code.`);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await sendPhonePasswordResetOtp(phone);
      setPhoneE164(e164);
      lastSubmitMsRef.current = Date.now();
      setStep('reset');
    } catch (err) {
      lastSubmitMsRef.current = Date.now();
      setError(getAuthSmsSendErrorMessage(err, 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (loading) return;
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (otpCode.trim().length < 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await resetPasswordWithPhoneOtp(phone, otpCode.trim(), newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password. Check your code and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setResendError(null);
    setResendSent(false);
    try {
      await sendPhonePasswordResetOtp(phone);
      lastSubmitMsRef.current = Date.now();
      setResendSent(true);
    } catch (err) {
      setResendError(getAuthSmsSendErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setResending(false);
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

            {done ? (
              <>
                <Text style={authStyles.sentScreenTitle}>Password updated</Text>
                <Text style={[authStyles.sentScreenBody, styles.sentBodySpacing]}>
                  Sign in with your phone number and new password.
                </Text>
                <Pressable
                  onPress={() => navigation.navigate('Login')}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>Back to sign in</Text>
                </Pressable>
              </>
            ) : step === 'reset' && phoneE164 ? (
              <>
                <Text style={authStyles.sentScreenTitle}>Reset your password</Text>
                <Text style={[authStyles.sentScreenBody, styles.sentBodySpacing]}>
                  Enter the 6-digit code we texted you, then choose a new password.
                </Text>
                <TextInput
                  placeholder="6-digit code"
                  placeholderTextColor="#5B6B80"
                  value={otpCode}
                  onChangeText={(t) => setOtpCode(t.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={authStyles.input}
                />
                <TextInput
                  placeholder="New password"
                  placeholderTextColor="#5B6B80"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  style={authStyles.input}
                />
                <TextInput
                  placeholder="Confirm new password"
                  placeholderTextColor="#5B6B80"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  style={authStyles.input}
                />
                {resendSent ? <Text style={styles.successText}>Code sent again.</Text> : null}
                {resendError ? <Text style={authStyles.errorText}>{resendError}</Text> : null}
                {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
                <Pressable
                  onPress={() => void handleResetPassword()}
                  disabled={loading}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>
                    {loading ? '...' : 'Update password →'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void handleResend()} disabled={resending} style={styles.resendWrap}>
                  <Text style={authStyles.link}>{resending ? 'Sending…' : 'Resend code'}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[authStyles.tagline, styles.taglineTight]}>
                  Enter your phone number and we&apos;ll text you a verification code.
                </Text>
                <TextInput
                  testID="forgot-password-phone-input"
                  placeholder="Phone number"
                  placeholderTextColor="#5B6B80"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  returnKeyType="go"
                  style={authStyles.input}
                  onSubmitEditing={() => void handleSendCode()}
                />
                {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
                <Pressable
                  testID="forgot-password-submit-button"
                  onPress={() => void handleSendCode()}
                  disabled={loading}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>
                    {loading ? '...' : 'Send verification code'}
                  </Text>
                </Pressable>
              </>
            )}

            {!done ? (
              <Text style={authStyles.footerText}>
                <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                  ← Back to sign in
                </Text>
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  safeBg: { backgroundColor: '#05060D', flex: 1 },
  keyboard: { flex: 1, width: '100%', backgroundColor: '#05060D' },
  scroll: { flex: 1, width: '100%' },
  scrollContent: {
    flexGrow: 1,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 40,
  },
  innerCentered: { alignItems: 'center' },
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: 8 },
  wordmarkNoBottomMargin: { marginBottom: 0, textAlign: 'left' },
  wordmarkBeta: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    color: '#3D5470',
  },
  wordmarkTight: { marginBottom: 18 },
  taglineTight: { marginBottom: 20 },
  flameWrap: { marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  flameScale: { transform: [{ scale: 0.78 }] },
  button: { marginTop: 16, marginBottom: 12 },
  sentBodySpacing: { marginBottom: 28 },
  successText: {
    color: '#5BA8E8',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
  },
  resendWrap: { paddingVertical: 8, marginBottom: 12 },
});
