import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Platform, StyleSheet } from 'react-native';
import { authStyles } from '@app/screens/authStyles';
import { formatAuthPhoneForDisplay } from '@features/authentication/normalizeAuthPhone';

type AuthPhoneOtpPanelProps = {
  phoneE164: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  resending?: boolean;
  verifying?: boolean;
  resendSent?: boolean;
  resendError?: string | null;
  verifyError?: string | null;
  title?: string;
  body?: string;
};

export function AuthPhoneOtpPanel({
  phoneE164,
  onVerify,
  onResend,
  resending = false,
  verifying = false,
  resendSent = false,
  resendError = null,
  verifyError = null,
  title = 'Enter verification code',
  body,
}: AuthPhoneOtpPanelProps) {
  const [code, setCode] = useState('');

  const displayPhone = formatAuthPhoneForDisplay(phoneE164);

  return (
    <View style={styles.wrap}>
      <Text style={authStyles.sentScreenTitle}>{title}</Text>
      <Text style={[authStyles.sentScreenBody, styles.body]}>
        {body ?? `We sent a 6-digit code to ${displayPhone}.`}
      </Text>
      <TextInput
        testID="auth-phone-otp-input"
        placeholder="6-digit code"
        placeholderTextColor="#5B6B80"
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        style={authStyles.input}
        autoComplete={Platform.OS === 'web' ? 'one-time-code' : 'sms-otp'}
      />
      {verifyError ? <Text style={authStyles.errorText}>{verifyError}</Text> : null}
      {resendError ? <Text style={authStyles.errorText}>{resendError}</Text> : null}
      {resendSent ? (
        <Text style={styles.successText}>Verification code sent again.</Text>
      ) : null}
      <Pressable
        testID="auth-phone-otp-verify-button"
        onPress={() => void onVerify(code)}
        disabled={verifying || code.length < 6}
        style={[authStyles.primaryButton, styles.button, (verifying || code.length < 6) && styles.muted]}
      >
        <Text style={authStyles.primaryButtonText}>{verifying ? 'Verifying…' : 'Verify code →'}</Text>
      </Pressable>
      <Pressable
        testID="auth-phone-otp-resend-button"
        onPress={() => void onResend()}
        disabled={resending}
        style={styles.resendWrap}
      >
        <Text style={authStyles.link}>{resending ? 'Sending…' : 'Resend code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
  },
  body: {
    marginBottom: 16,
  },
  button: {
    marginBottom: 8,
  },
  muted: {
    opacity: 0.72,
  },
  resendWrap: {
    paddingVertical: 8,
  },
  successText: {
    color: '#5BA8E8',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
  },
});
