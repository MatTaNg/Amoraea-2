import React, { useState } from 'react';
import { View, StyleSheet, Text, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '@features/authentication/hooks/useAuth';
import { TextInput } from '@ui/components/TextInput';
import { Button } from '@ui/components/Button';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { colors } from '@ui/theme/colors';
import { spacing } from '@ui/theme/spacing';

const isEmailNotConfirmedError = (err: unknown): boolean => {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  return lower.includes('email not confirmed') || lower.includes('confirm your email');
};

export const LoginScreen: React.FC<{ navigation: any; route?: { params?: { confirmEmail?: boolean } } }> = ({ navigation, route }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resending, setResending] = useState(false);
  const { signIn, resendConfirmationEmail } = useAuth();
  const confirmEmailMessage = route?.params?.confirmEmail ?? false;

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setError(null);
    setResendSent(false);
    setLoading(true);

    try {
      await signIn(email, password);
      // Navigation will be handled by auth state change
    } catch (err) {
      if (isEmailNotConfirmedError(err)) {
        setError('Please confirm your email before signing in. Check your inbox or resend the confirmation link below.');
      } else {
        setError(err instanceof Error ? err.message : 'Failed to sign in');
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
    <SafeAreaContainer>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.title}>Welcome to Amoraea</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>

            <TextInput
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <TextInput
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              secureTextEntry
            />

            {confirmEmailMessage && (
              <Text style={styles.successText}>
                Check your email to confirm your account, then sign in below.
              </Text>
            )}

            {error && <Text style={styles.errorText}>{error}</Text>}

            {error && error.includes('confirm your email') && email?.trim() && (
              <Button
                title={resendSent ? 'Confirmation email sent' : 'Resend confirmation email'}
                onPress={handleResendConfirmation}
                disabled={resendSent || resending}
                loading={resending}
                variant="outline"
                style={styles.button}
              />
            )}

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.button}
            />

            <Button
              title="Create Account"
              onPress={() => navigation.navigate('Register')}
              variant="outline"
              style={styles.button}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  content: {
    width: '100%',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.md,
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  successText: {
    color: colors.primary,
    fontSize: 14,
    marginTop: spacing.sm,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
});

