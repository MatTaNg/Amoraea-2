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
  Linking,
} from 'react-native';
import {
  AUTH_SMS_RESEND_COOLDOWN_MS,
  useAuth,
} from '@features/authentication/hooks/useAuth';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { FlameOrb } from '@app/screens/FlameOrb';
import { AUTH_FLAME_ORB_SIZE } from '@app/screens/flameOrbLogo';
import { authStyles } from '@app/screens/authStyles';
import { supabase } from '@data/supabase/client';
import { isAlphaTesterReferralCode } from '@/constants/alphaReferral';
import {
  isBareDevScenarioJumpReferralCode,
} from '@features/aria/devScenarioJumpReferral';
import { isRelationshipValidationReferralCode } from '@features/relationshipValidation/constants';
import { readAuthErrorMessageForDisplay } from '@features/authentication/confirmTestAccountEmail';
import type { Gender } from '@domain/models/Profile';
import { LEGAL_PRIVACY_POLICY_URL, LEGAL_TERMS_OF_SERVICE_URL } from '@/constants/legalUrls';
import {
  getRegisterFormFieldErrors,
  type RegisterFormFieldErrors,
} from '@features/authentication/registerFormValidation';
import {
  persistSignupLeadToken,
  readSignupLeadFromWebUrl,
  normalizeSignupLeadToken,
} from '@features/authentication/signupLead';
import { useRoute } from '@react-navigation/native';

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

type RegisterGenderOption = 'Male' | 'Female' | 'Non-Binary';

const GENDER_OPTIONS: RegisterGenderOption[] = ['Male', 'Female', 'Non-Binary'];

function mapRegisterGenderToProfileGender(value: RegisterGenderOption): Gender {
  if (value === 'Male') return 'Man';
  if (value === 'Female') return 'Woman';
  return 'Non-binary';
}

function openLegalUrl(url: string): void {
  void Linking.openURL(url).catch((err) => console.warn('[Register] Failed to open legal URL:', err));
}

function RegisterFieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <Text style={authStyles.fieldErrorText}>{message}</Text>;
}

/** Temporary email signup while Twilio SMS verification is pending (matches login). */

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const route = useRoute();
  const routeLead = normalizeSignupLeadToken(
    (route.params as { lead?: string } | undefined)?.lead,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<RegisterGenderOption | ''>('');
  const [genderOpen, setGenderOpen] = useState(false);
  const [hoveredGender, setHoveredGender] = useState<RegisterGenderOption | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [referralHint, setReferralHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<RegisterFormFieldErrors>({});
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);
  const lastResendMsRef = useRef(0);
  const { signUp, resendConfirmationEmail } = useAuth();

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

  useEffect(() => {
    const leadToken = routeLead ?? readSignupLeadFromWebUrl();
    if (!leadToken) return;
    void persistSignupLeadToken(leadToken);
  }, [routeLead]);

  const clearFieldError = (field: keyof RegisterFormFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleRegister = async () => {
    if (loading) return;
    const nextFieldErrors = getRegisterFormFieldErrors({
      email,
      password,
      confirm,
      age,
      gender,
    });
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      setError(null);
      return;
    }
    if (!gender) return;
    const parsedAge = Number.parseInt(age, 10);
    setError(null);
    setReferralHint(null);
    setLoading(true);
    try {
      const raw = inviteCode.trim();
      let codeToSend: string | undefined;
      if (raw) {
        if (isBareDevScenarioJumpReferralCode(raw)) {
          codeToSend = raw;
        } else if (isRelationshipValidationReferralCode(raw)) {
          codeToSend = raw;
        } else if (isAlphaTesterReferralCode(raw)) {
          codeToSend = raw;
        } else {
          const { data: available, error: rpcErr } = await supabase.rpc('invite_code_is_available', {
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
            setReferralHint("That code doesn't look right.");
            setLoading(false);
            return;
          }
        }
      }
      const signUpResult = await signUp(email.trim(), password, {
        ...(codeToSend ? { inviteCode: codeToSend } : {}),
        age: parsedAge,
        gender: mapRegisterGenderToProfileGender(gender),
      });
      if (signUpResult.session) {
        return;
      }
      lastResendMsRef.current = Date.now();
      setSent(true);
    } catch (err) {
      setError(readAuthErrorMessageForDisplay(err));
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!email?.trim() || resending) return;
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
    try {
      await resendConfirmationEmail(email.trim());
      lastResendMsRef.current = Date.now();
      setResendSent(true);
    } catch (err) {
      lastResendMsRef.current = Date.now();
      setResendSent(false);
      setResendError(err instanceof Error ? err.message : 'Failed to resend confirmation email.');
    } finally {
      setResending(false);
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
              We sent a confirmation link to {email.trim()}. Open it to finish creating your account,
              then sign in.
            </Text>
            {resendSent ? (
              <Text style={[authStyles.confirmationNote, { marginTop: 20 }]}>Confirmation email sent.</Text>
            ) : null}
            {resendError ? <Text style={authStyles.errorText}>{resendError}</Text> : null}
            <Pressable
              onPress={() => void handleResendConfirmation()}
              disabled={resendSent || resending}
              style={[
                authStyles.primaryButton,
                styles.sentResendButton,
                (resendSent || resending) && authStyles.primaryButtonDisabled,
              ]}
            >
              <Text style={authStyles.primaryButtonText}>
                {resendSent ? 'Email sent' : resending ? 'Sending…' : 'Resend confirmation email'}
              </Text>
            </Pressable>
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
            <FlameOrb state="idle" size={AUTH_FLAME_ORB_SIZE} minimalGlow />
          </View>
          <Text style={[authStyles.tagline, styles.taglineTight]}>Begin with honesty.</Text>

          <View style={[authStyles.inner, styles.innerCentered]}>
            <TextInput
              placeholder="Email"
              placeholderTextColor="#5B6B80"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                clearFieldError('email');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              style={[
                authStyles.input,
                fieldErrors.email && authStyles.inputWithFieldError,
                fieldErrors.email && authStyles.inputError,
              ]}
            />
            <RegisterFieldError message={fieldErrors.email} />

            <TextInput
              placeholder="Password"
              placeholderTextColor="#5B6B80"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                clearFieldError('password');
              }}
              secureTextEntry
              style={[
                authStyles.input,
                fieldErrors.password && authStyles.inputWithFieldError,
                fieldErrors.password && authStyles.inputError,
              ]}
            />
            <RegisterFieldError message={fieldErrors.password} />

            <TextInput
              placeholder="Confirm password"
              placeholderTextColor="#5B6B80"
              value={confirm}
              onChangeText={(t) => {
                setConfirm(t);
                clearFieldError('confirm');
              }}
              secureTextEntry
              style={[
                authStyles.input,
                fieldErrors.confirm && authStyles.inputWithFieldError,
                fieldErrors.confirm && authStyles.inputError,
              ]}
            />
            <RegisterFieldError message={fieldErrors.confirm} />

            <View style={[styles.demographicsRow, (fieldErrors.gender || fieldErrors.age) && styles.demographicsRowWithError]}>
              <View style={styles.genderPickerColumn}>
                <Pressable
                  style={[styles.genderPickerWrap, fieldErrors.gender && authStyles.inputError]}
                  onPress={() => setGenderOpen((open) => !open)}
                  accessibilityRole="button"
                  accessibilityLabel="Select gender"
                >
                  <Text style={[styles.genderPickerText, !gender && styles.genderPickerPlaceholder]}>
                    {gender || 'Gender'}
                  </Text>
                  <Text style={styles.genderPickerChevron}>⌄</Text>
                </Pressable>
                {genderOpen ? (
                  <View style={styles.genderOptionsMenu}>
                    {GENDER_OPTIONS.map((option) => (
                      <Pressable
                        key={option}
                        style={[styles.genderOption, hoveredGender === option && styles.genderOptionHover]}
                        onHoverIn={() => setHoveredGender(option)}
                        onHoverOut={() => setHoveredGender(null)}
                        onPress={() => {
                          setGender(option);
                          setGenderOpen(false);
                          setHoveredGender(null);
                          clearFieldError('gender');
                        }}
                      >
                        <Text style={styles.genderOptionText}>{option}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                <RegisterFieldError message={fieldErrors.gender} />
              </View>

              <View style={styles.ageColumn}>
                <TextInput
                  placeholder="Age"
                  placeholderTextColor="#5B6B80"
                  value={age}
                  onChangeText={(t) => {
                    setAge(t.replace(/\D/g, '').slice(0, 2));
                    clearFieldError('age');
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={[
                    authStyles.input,
                    styles.ageInput,
                    fieldErrors.age && authStyles.inputWithFieldError,
                    fieldErrors.age && authStyles.inputError,
                  ]}
                />
                <RegisterFieldError message={fieldErrors.age} />
              </View>
            </View>

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

            <Text style={[authStyles.confirmationNote, styles.termsNote]}>
              By creating an account, you agree to our{' '}
              <Text style={authStyles.link} onPress={() => openLegalUrl(LEGAL_PRIVACY_POLICY_URL)}>
                Privacy Policy
              </Text>
              {' '}and{' '}
              <Text style={authStyles.link} onPress={() => openLegalUrl(LEGAL_TERMS_OF_SERVICE_URL)}>
                Terms of Service
              </Text>
              . We'll send a confirmation link to your email.
            </Text>

            <Pressable
              onPress={handleRegister}
              disabled={loading}
              style={[
                authStyles.primaryButton,
                styles.button,
                loading && authStyles.primaryButtonDisabled,
              ]}
            >
              <Text style={authStyles.primaryButtonText}>
                {loading ? '...' : 'Create Account →'}
              </Text>
            </Pressable>

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
    minHeight: AUTH_FLAME_ORB_SIZE,
    width: '100%',
    overflow: 'visible',
  },
  demographicsRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
    zIndex: 5,
    alignItems: 'flex-start',
  },
  demographicsRowWithError: {
    marginBottom: 0,
  },
  ageColumn: {
    width: 86,
  },
  genderPickerColumn: {
    flex: 1,
    position: 'relative',
    zIndex: 10,
  },
  genderPickerWrap: {
    minHeight: 50,
    backgroundColor: 'rgba(13,17,32,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.15)',
    borderRadius: 10,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  genderPickerText: {
    flex: 1,
    color: '#E8F0F8',
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 14,
    fontWeight: '300',
  },
  genderPickerPlaceholder: {
    color: '#7A9ABE',
  },
  genderPickerChevron: {
    color: '#7A9ABE',
    fontSize: 16,
    lineHeight: 16,
  },
  genderOptionsMenu: {
    position: 'absolute',
    top: 54,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(13,17,32,0.98)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.18)',
    borderRadius: 10,
    overflow: 'hidden',
    zIndex: 20,
    ...(Platform.OS === 'web' ? ({ boxShadow: '0 10px 24px rgba(0,0,0,0.35)' } as const) : {}),
  },
  genderOption: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: 'rgba(13,17,32,0.98)',
  },
  genderOptionHover: {
    backgroundColor: 'rgba(30,111,217,0.22)',
  },
  genderOptionText: {
    color: '#E8F0F8',
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
    fontSize: 14,
    fontWeight: '300',
  },
  ageInput: {
    width: '100%',
    marginBottom: 0,
    textAlign: 'center',
  },
  termsNote: {
    marginTop: 8,
    marginBottom: 8,
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    marginBottom: 0,
  },
  sentResendButton: {
    marginTop: 8,
    marginBottom: 8,
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
