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
import { AuthPhoneOtpPanel } from '@features/authentication/components/AuthPhoneOtpPanel';
import {
  getAuthSmsSendErrorMessage,
  isPhoneNotConfirmedAuthError,
} from '@features/authentication/authPhoneErrors';
import { isEmailNotConfirmedAuthError } from '@features/authentication/confirmTestAccountEmail';
import {
  isValidAuthPhoneInput,
  normalizeAuthPhoneE164,
} from '@features/authentication/normalizeAuthPhone';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { AUTH_FLAME_ORB_SIZE } from '@app/screens/flameOrbLogo';
import { authStyles } from '@app/screens/authStyles';
import { TEMP_EMAIL_AUTH_WHILE_TWILIO_PENDING } from '@features/authentication/tempEmailAuthWhileTwilioPending';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

/** Temporary: restore email on the main login screen while Twilio number verification is pending. */
const TEMP_EMAIL_LOGIN_ON_MAIN_SCREEN = TEMP_EMAIL_AUTH_WHILE_TWILIO_PENDING;

type LoginMode = 'phone' | 'email';

function isConfirmationResendContext(message: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('confirm your phone') ||
    lower.includes('verification code') ||
    lower.includes('phone not confirmed')
  );
}

export const LoginScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [loginMode, setLoginMode] = useState<LoginMode>(
    TEMP_EMAIL_LOGIN_ON_MAIN_SCREEN ? 'email' : 'phone',
  );
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsOtp, setNeedsOtp] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const lastResendMsRef = useRef(0);
  const passwordInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const emailInputRef = useRef<React.ElementRef<typeof TextInput>>(null);
  const {
    signInWithPhone,
    signInWithEmail,
    resendConfirmationSms,
    resendConfirmationEmail,
    verifyPhoneOtp,
    clearEmailConfirmationLinkError,
  } = useAuth();

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
    if (loading) return;
    if (loginMode === 'email') {
      await handleEmailLogin();
      return;
    }
    if (!phone?.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (!isValidAuthPhoneInput(phone)) {
      setError('Please enter a valid phone number (include area code).');
      return;
    }
    const e164 = normalizeAuthPhoneE164(phone);
    if (!e164) {
      setError('Please enter a valid phone number.');
      return;
    }
    setError(null);
    setResendSent(false);
    setVerifyError(null);
    clearEmailConfirmationLinkError();
    setLoading(true);
    try {
      await signInWithPhone(phone, password);
    } catch (err) {
      if (isPhoneNotConfirmedAuthError(err)) {
        setPhoneE164(e164);
        setNeedsOtp(true);
        setError(
          'Please verify your phone number before signing in. Enter the code we texted you, or resend a new code below.',
        );
      } else {
        setError(err instanceof Error ? err.message : 'Incorrect phone number or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }
    setError(null);
    setResendSent(false);
    setVerifyError(null);
    clearEmailConfirmationLinkError();
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
    } catch (err) {
      if (isEmailNotConfirmedAuthError(err)) {
        setNeedsEmailConfirmation(true);
        setError('Please confirm your email before signing in. Check your inbox or resend the confirmation email below.');
      } else {
        setError(err instanceof Error ? err.message : 'Incorrect email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmailConfirmation = async () => {
    if (!email.trim() || resending) return;
    const now = Date.now();
    const elapsed = now - lastResendMsRef.current;
    if (lastResendMsRef.current > 0 && elapsed < AUTH_SMS_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((AUTH_SMS_RESEND_COOLDOWN_MS - elapsed) / 1000);
      setResendError(`Please wait ${waitSec} seconds before requesting another email.`);
      return;
    }
    setResending(true);
    setResendError(null);
    setResendSent(false);
    clearEmailConfirmationLinkError();
    try {
      await resendConfirmationEmail(email.trim());
      lastResendMsRef.current = Date.now();
      setResendSent(true);
      setError(null);
    } catch (err) {
      lastResendMsRef.current = Date.now();
      setResendSent(false);
      setResendError(err instanceof Error ? err.message : 'Failed to resend confirmation email.');
    } finally {
      setResending(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!phone?.trim() || resending) return;
    const now = Date.now();
    const elapsed = now - lastResendMsRef.current;
    if (lastResendMsRef.current > 0 && elapsed < AUTH_SMS_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((AUTH_SMS_RESEND_COOLDOWN_MS - elapsed) / 1000);
      setResendError(`Please wait ${waitSec} seconds before requesting another code.`);
      return;
    }
    setResending(true);
    setResendError(null);
    setResendSent(false);
    clearEmailConfirmationLinkError();
    try {
      await resendConfirmationSms(phone);
      const e164 = normalizeAuthPhoneE164(phone);
      if (e164) setPhoneE164(e164);
      setNeedsOtp(true);
      lastResendMsRef.current = Date.now();
      setResendSent(true);
      setError(null);
    } catch (err) {
      lastResendMsRef.current = Date.now();
      setResendSent(false);
      setResendError(getAuthSmsSendErrorMessage(err, 'Failed to resend verification code'));
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    if (verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await verifyPhoneOtp(phone, code, 'sms');
      setNeedsOtp(false);
      setError(null);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setVerifying(false);
    }
  };

  const showResendConfirmation =
    loginMode === 'phone' &&
    Boolean(phone?.trim()) &&
    (needsOtp || isConfirmationResendContext(error) || resendSent);

  const showResendEmailConfirmation =
    loginMode === 'email' &&
    Boolean(email.trim()) &&
    (needsEmailConfirmation || resendSent);

  const onEmailEnterAction = () => {
    if (!password) {
      passwordInputRef.current?.focus();
      return;
    }
    void handleEmailLogin();
  };

  const onPhoneEnterAction = () => {
    if (!password) {
      passwordInputRef.current?.focus();
      return;
    }
    void handleLogin();
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
              <FlameOrb state="idle" size={AUTH_FLAME_ORB_SIZE} minimalGlow />
            </View>

            <Text style={[authStyles.tagline, styles.taglineTight]}>Enter to continue your journey.</Text>

            {loginMode === 'email' && !needsOtp ? (
              <>
                <TextInput
                  ref={emailInputRef}
                  testID="login-email-input"
                  placeholder="Email"
                  placeholderTextColor="#5B6B80"
                  value={email}
                  onChangeText={(value) => {
                    setEmail(value);
                    if (resendSent) setResendSent(false);
                    if (needsEmailConfirmation) setNeedsEmailConfirmation(false);
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={onEmailEnterAction}
                  style={authStyles.input}
                />

                <TextInput
                  ref={passwordInputRef}
                  testID="login-password-input"
                  placeholder="Password"
                  placeholderTextColor="#5B6B80"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="go"
                  style={authStyles.input}
                  onSubmitEditing={() => void handleLogin()}
                />

                <View style={styles.linksRow}>
                  <Pressable
                    testID="login-forgot-password-link"
                    onPress={() => navigation.navigate('ForgotPassword')}
                    style={styles.linkWrap}
                  >
                    <Text style={styles.secondaryLink}>Forgot password?</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {loginMode === 'phone' && needsOtp && phoneE164 ? (
              <AuthPhoneOtpPanel
                phoneE164={phoneE164}
                onVerify={handleVerifyOtp}
                onResend={handleResendConfirmation}
                verifying={verifying}
                resending={resending}
                resendSent={resendSent}
                resendError={resendError}
                verifyError={verifyError}
              />
            ) : null}

            {loginMode === 'phone' && !needsOtp ? (
              <>
                <TextInput
                  testID="login-phone-input"
                  placeholder="Phone number"
                  placeholderTextColor="#5B6B80"
                  value={phone}
                  onChangeText={(value) => {
                    setPhone(value);
                    if (resendSent) setResendSent(false);
                  }}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  returnKeyType="next"
                  blurOnSubmit={false}
                  onSubmitEditing={onPhoneEnterAction}
                  style={authStyles.input}
                />

                <TextInput
                  ref={passwordInputRef}
                  testID="login-password-input"
                  placeholder="Password"
                  placeholderTextColor="#5B6B80"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  returnKeyType="go"
                  style={authStyles.input}
                  onSubmitEditing={() => void handleLogin()}
                />

                <View style={styles.linksRow}>
                  <Pressable
                    testID="login-forgot-password-link"
                    onPress={() => navigation.navigate('ForgotPassword')}
                    style={styles.linkWrap}
                  >
                    <Text style={styles.secondaryLink}>Forgot password?</Text>
                  </Pressable>
                </View>
              </>
            ) : null}

            {resendSent && loginMode === 'email' ? (
              <Text style={styles.successText}>Confirmation email sent.</Text>
            ) : null}

            {resendSent && loginMode === 'phone' && !needsOtp ? (
              <Text style={styles.successText}>Verification code sent.</Text>
            ) : null}

            {error && !resendSent ? <Text style={authStyles.errorText}>{error}</Text> : null}

            {showResendEmailConfirmation ? (
              <Pressable
                onPress={() => void handleResendEmailConfirmation()}
                disabled={resendSent || resending}
                style={[
                  authStyles.primaryButton,
                  styles.button,
                  (resendSent || resending) && styles.buttonMuted,
                ]}
              >
                <Text style={authStyles.primaryButtonText}>
                  {resendSent ? 'Email sent' : resending ? 'Sending…' : 'Resend confirmation email'}
                </Text>
              </Pressable>
            ) : null}

            {resendError && loginMode === 'email' ? (
              <Text style={authStyles.errorText}>{resendError}</Text>
            ) : null}

            {showResendConfirmation && !needsOtp ? (
              <Pressable
                onPress={() => void handleResendConfirmation()}
                disabled={resendSent || resending}
                style={[
                  authStyles.primaryButton,
                  styles.button,
                  (resendSent || resending) && styles.buttonMuted,
                ]}
              >
                <Text style={authStyles.primaryButtonText}>
                  {resendSent ? 'Code sent' : resending ? 'Sending…' : 'Resend verification code'}
                </Text>
              </Pressable>
            ) : null}

            {!needsOtp ? (
              <Pressable
                testID="login-submit-button"
                onPress={handleLogin}
                disabled={loading}
                style={[authStyles.primaryButton, styles.button]}
              >
                <Text style={authStyles.primaryButtonText}>{loading ? '...' : 'Sign In →'}</Text>
              </Pressable>
            ) : null}

            {loginMode === 'phone' && !TEMP_EMAIL_LOGIN_ON_MAIN_SCREEN ? (
              <Text style={styles.tempHint}>
                Need to attach a phone to an existing email account?{' '}
                <Text style={authStyles.link} onPress={() => navigation.navigate('LinkPhone')}>
                  Link phone
                </Text>
              </Text>
            ) : null}

            <View style={authStyles.divider} />

            <Text style={authStyles.footerText}>
              {"Don't have an account? "}
              <Text style={authStyles.link} onPress={() => navigation.navigate('Register')}>
                Apply to join
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
  modeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    width: '100%',
    justifyContent: 'center',
  },
  modeChip: {
    borderWidth: 1,
    borderColor: 'rgba(91, 168, 232, 0.25)',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  modeChipActive: {
    backgroundColor: 'rgba(30, 111, 217, 0.18)',
    borderColor: 'rgba(91, 168, 232, 0.45)',
  },
  modeChipText: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 12,
    fontWeight: '400',
    color: '#5B6B80',
    letterSpacing: 0.4,
  },
  modeChipTextActive: {
    color: '#C8E4FF',
    fontWeight: '500',
  },
  tempHint: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 11,
    lineHeight: 16,
    color: '#3D5470',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 8,
  },
  flameWrap: {
    marginBottom: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: AUTH_FLAME_ORB_SIZE,
    width: '100%',
    overflow: 'visible',
  },
  button: {
    marginBottom: 12,
  },
  linksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 18,
  },
  linkWrap: {
    paddingVertical: 2,
  },
  secondaryLink: {
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 12,
    fontWeight: '300',
    color: '#3D5470',
    letterSpacing: 0.3,
  },
  successText: {
    color: '#5BA8E8',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    lineHeight: 21,
  },
  buttonMuted: {
    opacity: 0.72,
  },
});
