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
import { getAuthSmsSendErrorMessage } from '@features/authentication/authPhoneErrors';
import { isValidAuthPhoneInput, normalizeAuthPhoneE164 } from '@features/authentication/normalizeAuthPhone';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { AUTH_FLAME_ORB_SIZE } from '@app/screens/flameOrbLogo';
import { authStyles } from '@app/screens/authStyles';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

type Step = 'credentials' | 'verify';

export const LinkPhoneScreen: React.FC<{ navigation: { navigate: (route: string) => void; goBack: () => void } }> = ({
  navigation,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneE164, setPhoneE164] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('credentials');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const [linked, setLinked] = useState(false);
  const lastResendMsRef = useRef(0);
  const { startLinkPhoneToEmailAccount, completeLinkPhoneToEmailAccount, resendPhoneChangeSms } = useAuth();

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
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
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
    setLoading(true);
    try {
      await startLinkPhoneToEmailAccount(email.trim(), password, phone);
      setPhoneE164(e164);
      lastResendMsRef.current = Date.now();
      setStep('verify');
    } catch (err) {
      setError(
        getAuthSmsSendErrorMessage(
          err,
          err instanceof Error ? err.message : 'Could not verify your account. Check email and password.',
        ),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (!phoneE164 || verifying) return;
    setVerifying(true);
    setVerifyError(null);
    try {
      await completeLinkPhoneToEmailAccount(phone, code);
      setLinked(true);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : 'Invalid or expired code. Try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!phoneE164 || resending) return;
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
    try {
      await resendPhoneChangeSms(phone);
      lastResendMsRef.current = Date.now();
      setResendSent(true);
    } catch (err) {
      setResendError(getAuthSmsSendErrorMessage(err, 'Failed to resend verification code.'));
    } finally {
      setResending(false);
    }
  };

  if (linked) {
    return (
      <SafeAreaContainer style={styles.safeBg}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[authStyles.inner, styles.innerCentered]}>
            <Text style={styles.sentIcon}>✦</Text>
            <Text style={authStyles.sentScreenTitle}>Phone linked.</Text>
            <Text style={authStyles.sentScreenBody}>
              Your phone number is verified. Sign in on the next screen with your phone number and password.
            </Text>
            <Pressable
              onPress={() => navigation.navigate('Login')}
              style={[authStyles.primaryButton, styles.button]}
            >
              <Text style={authStyles.primaryButtonText}>Go to sign in →</Text>
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
        >
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}

          <View style={[authStyles.inner, styles.innerCentered]}>
            <View style={styles.wordmarkRow}>
              <Text style={[authStyles.wordmark, styles.wordmarkNoBottomMargin]}>
                amor<Text style={authStyles.wordmarkAe}>æ</Text>a
              </Text>
            </View>
            <View style={styles.flameWrap}>
              <FlameOrb state="idle" size={AUTH_FLAME_ORB_SIZE} minimalGlow />
            </View>

            {step === 'verify' && phoneE164 ? (
              <AuthPhoneOtpPanel
                phoneE164={phoneE164}
                onVerify={handleVerify}
                onResend={handleResend}
                verifying={verifying}
                resending={resending}
                resendSent={resendSent}
                resendError={resendError}
                verifyError={verifyError}
                title="Verify your phone"
                body="Enter the code we texted to link this number to your account."
              />
            ) : (
              <>
                <Text style={[authStyles.tagline, styles.taglineTight]}>
                  Link a phone number to your existing email account.
                </Text>
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
                  placeholder="Phone number"
                  placeholderTextColor="#5B6B80"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                  style={authStyles.input}
                />
                <Text style={authStyles.confirmationNote}>
                  We&apos;ll text a verification code to this number. After that, you can sign in with your phone
                  and password.
                </Text>
                {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
                <Pressable
                  onPress={() => void handleSendCode()}
                  disabled={loading}
                  style={[authStyles.primaryButton, styles.button]}
                >
                  <Text style={authStyles.primaryButtonText}>
                    {loading ? 'Sending code…' : 'Send verification code →'}
                  </Text>
                </Pressable>
              </>
            )}

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
  wordmarkRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', marginBottom: 18 },
  wordmarkNoBottomMargin: { marginBottom: 0, textAlign: 'left' },
  taglineTight: { marginBottom: 20 },
  flameWrap: { marginBottom: 16, alignItems: 'center', minHeight: AUTH_FLAME_ORB_SIZE },
  button: { marginTop: 16, marginBottom: 12 },
  sentIcon: { fontSize: 32, marginBottom: 20, color: '#C8E4FF' },
});
