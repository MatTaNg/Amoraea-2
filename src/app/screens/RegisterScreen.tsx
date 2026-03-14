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

const GOOGLE_FONTS_URL =
  "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Jost:wght@200;300;400&display=swap";

export const RegisterScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
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
    setLoading(true);
    try {
      await signUp(email.trim(), password, inviteCode.trim() ? { inviteCode: inviteCode.trim() } : undefined);
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
        <View style={authStyles.fullScreen}>
          {Platform.OS === 'web' && (
            <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
          )}
          <View style={[authStyles.inner, styles.sentInner]}>
            <Text style={styles.sentIcon}>✦</Text>
            <Text style={authStyles.sentScreenTitle}>Check your email.</Text>
            <Text style={authStyles.sentScreenBody}>
              We've sent a confirmation link to <Text style={{ color: '#C8E4FF' }}>{email}</Text>. Open it to
              complete your registration and begin your interview.
            </Text>
            <View style={authStyles.divider} />
            <Text style={authStyles.footerText}>
              Already have an account?{' '}
              <Text style={authStyles.link} onPress={() => navigation.navigate('Login')}>
                Sign in
              </Text>
            </Text>
          </View>
        </View>
      </SafeAreaContainer>
    );
  }

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <View style={styles.outerLock}>
        {Platform.OS === 'web' && (
          <View style={[StyleSheet.absoluteFill, authStyles.grainOverlay]} pointerEvents="none" />
        )}
        <View style={[authStyles.ambientGlow, authStyles.ambientGlowRegister]} pointerEvents="none" />

        <View style={styles.staticHeader}>
          <Text style={[authStyles.wordmark, styles.wordmarkTight]}>
            amor<Text style={authStyles.wordmarkAe}>æ</Text>a
          </Text>
          <View style={styles.flameWrap}>
            <View style={styles.flameScale}>
              <FlameOrb state="idle" />
            </View>
          </View>
          <Text style={[authStyles.tagline, styles.taglineTight]}>Begin with honesty.</Text>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboard}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.formScrollContent}
          >
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
                placeholder="Invite code (optional)"
                placeholderTextColor="#5B6B80"
                value={inviteCode}
                onChangeText={setInviteCode}
                style={[authStyles.input, authStyles.inputOptional, { marginBottom: 18 }]}
              />

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
                You'll receive a confirmation email to verify your address.
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
  },
  staticHeader: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  wordmarkTight: {
    marginBottom: 18,
  },
  taglineTight: {
    marginBottom: 20,
  },
  keyboard: {
    flex: 1,
    width: '100%',
  },
  formScrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  innerCentered: {
    alignItems: 'center',
  },
  flameWrap: {
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameScale: {
    transform: [{ scale: 0.4 }],
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
