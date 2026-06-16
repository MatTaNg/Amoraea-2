import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import type { RouteProp } from '@react-navigation/native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { authStyles } from '@app/screens/authStyles';
import { isValidPartnerEmail } from '@features/relationshipValidation/validationPsychometricsProgress';
import {
  savePartnerEmailEntered,
  startNewPartnerComparison,
  fetchComparisonByPartnerEmail,
} from '@features/relationshipValidation/relationshipValidationRepo';
import {
  resolveValidationFlowStepAfterPartnerSwitch,
} from '@features/relationshipValidation/relationshipValidationService';
import type { RelationshipValidationStackParamList } from '@app/navigation/RelationshipValidationNavigator';

type Nav = {
  navigate: (screen: string) => void;
  replace: (screen: string) => void;
};

const STEP_TO_SCREEN: Record<string, string> = {
  partner_email: 'ValidationPartnerEmail',
  pre_assessment: 'ValidationPreAssessment',
  psychometrics: 'ValidationPsychometricsHub',
  report: 'ValidationReport',
};

async function routeAfterPartnerEmail(userId: string, email: string): Promise<string> {
  const comparison = await fetchComparisonByPartnerEmail(userId, email);
  if (!comparison) return 'ValidationPreAssessment';
  const step = await resolveValidationFlowStepAfterPartnerSwitch(userId, comparison.id);
  return STEP_TO_SCREEN[step] ?? 'ValidationReport';
}

type Props = {
  userId: string;
  navigation: Nav;
  route: RouteProp<RelationshipValidationStackParamList, 'ValidationPartnerEmail'>;
};

export function ValidationPartnerEmailScreen({ userId, navigation, route }: Props) {
  const newComparison = route.params?.newComparison === true;
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleContinue = async () => {
    const trimmed = email.trim();
    if (!isValidPartnerEmail(trimmed)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      if (newComparison) {
        await startNewPartnerComparison(userId, trimmed);
      } else {
        await savePartnerEmailEntered(userId, trimmed);
      }
      const nextScreen = await routeAfterPartnerEmail(userId, trimmed);
      navigation.replace(nextScreen);
    } catch {
      setError('Could not save your partner email. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {newComparison ? (
            <Pressable
              onPress={() => navigation.replace('ValidationReport')}
              style={styles.backLink}
              accessibilityRole="button"
            >
              <Text style={styles.backLinkText}>← Back to your results</Text>
            </Pressable>
          ) : null}
          <Text style={styles.title}>
            {newComparison ? 'Compare with another partner' : 'Link with your partner'}
          </Text>
          <Text style={styles.body}>
            {newComparison
              ? "Enter your new partner's email. You'll answer the relationship survey and report feedback again — your psychometric results will be reused."
              : "Enter your partner's email address — they'll need to enter yours when they complete their assessment."}
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="partner@email.com"
            placeholderTextColor="#5B6B80"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            style={authStyles.input}
          />
          {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
          <Pressable
            onPress={() => void handleContinue()}
            disabled={saving}
            style={[authStyles.primaryButton, saving && { opacity: 0.6 }]}
          >
            <Text style={authStyles.primaryButtonText}>{saving ? 'Saving…' : 'Continue'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  safeBg: { flex: 1, backgroundColor: '#05060D' },
  flex: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 24,
    color: '#E8F0F8',
    textAlign: 'center',
    marginBottom: 12,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: '#95A8BD',
    textAlign: 'center',
    marginBottom: 20,
  },
  backLink: { alignSelf: 'flex-start', marginBottom: 16 },
  backLinkText: { color: '#5BA8E8', fontSize: 14 },
});
