import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { authStyles } from '@app/screens/authStyles';
import {
  PLATONIC_PAST_RELATIONSHIP_ENDED_OPTIONS,
  RELATIONSHIP_DURATION_OPTIONS,
  type PlatonicPastRelationshipEndedOption,
  type RelationshipDurationOption,
  type RelationshipValidationTestMode,
} from '@features/relationshipValidation/constants';
import {
  savePlatonicTestPastRelationshipContext,
  saveRelationshipTestMode,
  saveRomanticTestRelationshipDuration,
} from '@features/relationshipValidation/relationshipValidationRepo';

import { useAssessmentScrollContent } from '@utilities/assessmentMobileLayout';

type Props = {
  userId: string;
  navigation: { navigate: (screen: string) => void; replace: (screen: string) => void };
};

type Step = 'choose_mode' | 'romantic_duration' | 'platonic_context';

export function ValidationRelationshipTestModeScreen({ userId, navigation }: Props) {
  const scrollContentStyle = useAssessmentScrollContent();
  const [step, setStep] = useState<Step>('choose_mode');
  const [mode, setMode] = useState<RelationshipValidationTestMode | null>(null);
  const [romanticDuration, setRomanticDuration] = useState<RelationshipDurationOption | null>(null);
  const [pastEnded, setPastEnded] = useState<PlatonicPastRelationshipEndedOption | null>(null);
  const [pastDuration, setPastDuration] = useState<RelationshipDurationOption | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const finishToRelationshipSurvey = () => {
    navigation.replace('ValidationPreAssessment');
  };

  const handleChooseMode = async (selected: RelationshipValidationTestMode) => {
    setError(null);
    setSaving(true);
    try {
      await saveRelationshipTestMode(userId, selected);
      setMode(selected);
      if (selected === 'romantic') {
        setStep('romantic_duration');
      } else {
        setStep('platonic_context');
      }
    } catch {
      setError('Could not save your selection. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleRomanticContinue = async () => {
    if (!romanticDuration) {
      setError('Please select how long you have been together.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await saveRomanticTestRelationshipDuration(userId, romanticDuration);
      finishToRelationshipSurvey();
    } catch {
      setError('Could not save your responses. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handlePlatonicContinue = async () => {
    if (!pastEnded || !pastDuration) {
      setError('Please answer both questions about your past relationship.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await savePlatonicTestPastRelationshipContext(userId, pastEnded, pastDuration);
      finishToRelationshipSurvey();
    } catch {
      setError('Could not save your responses. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <ScrollView contentContainerStyle={scrollContentStyle} keyboardShouldPersistTaps="handled">
        {step === 'choose_mode' ? (
          <>
            <Text style={styles.trust}>
              Your individual answers are never shown to the other person — only a compatibility
              result is calculated and shared. This helps us validate Amoraea's matching algorithm.
            </Text>
            <Text style={styles.title}>
              Is the person you're being compared with a romantic partner, or a friend helping us
              test the app?
            </Text>
            <Pressable
              onPress={() => void handleChooseMode('romantic')}
              disabled={saving}
              style={[styles.choice, mode === 'romantic' && styles.choiceActive]}
            >
              <Text style={styles.choiceText}>My romantic partner</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleChooseMode('platonic')}
              disabled={saving}
              style={[styles.choice, mode === 'platonic' && styles.choiceActive]}
            >
              <Text style={styles.choiceText}>A friend (platonic)</Text>
            </Pressable>
          </>
        ) : null}

        {step === 'romantic_duration' ? (
          <>
            <Text style={styles.title}>How long have you been together?</Text>
            {RELATIONSHIP_DURATION_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => setRomanticDuration(opt.value)}
                style={[styles.choice, romanticDuration === opt.value && styles.choiceActive]}
              >
                <Text
                  style={[
                    styles.choiceText,
                    romanticDuration === opt.value && styles.choiceTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => void handleRomanticContinue()}
              disabled={saving}
              style={[authStyles.primaryButton, saving && { opacity: 0.6 }]}
            >
              <Text style={authStyles.primaryButtonText}>
                {saving ? 'Saving…' : 'Continue to relationship survey'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {step === 'platonic_context' ? (
          <>
            <Text style={styles.reframe}>
              Since you're testing this with a friend, we'll ask you to think about a past romantic
              relationship as you answer. This helps us see how the underlying assessments perform,
              even though the compatibility result won't reflect a real partnership.
            </Text>
            <View style={styles.questionBlock}>
              <Text style={styles.questionLabel}>When did this relationship end?</Text>
              {PLATONIC_PAST_RELATIONSHIP_ENDED_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setPastEnded(opt.value)}
                  style={[styles.choice, pastEnded === opt.value && styles.choiceActive]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      pastEnded === opt.value && styles.choiceTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.questionBlock}>
              <Text style={styles.questionLabel}>How long were you together?</Text>
              {RELATIONSHIP_DURATION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  onPress={() => setPastDuration(opt.value)}
                  style={[styles.choice, pastDuration === opt.value && styles.choiceActive]}
                >
                  <Text
                    style={[
                      styles.choiceText,
                      pastDuration === opt.value && styles.choiceTextActive,
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable
              onPress={() => void handlePlatonicContinue()}
              disabled={saving}
              style={[authStyles.primaryButton, saving && { opacity: 0.6 }]}
            >
              <Text style={authStyles.primaryButtonText}>
                {saving ? 'Saving…' : 'Continue to relationship survey'}
              </Text>
            </Pressable>
          </>
        ) : null}

        {error ? <Text style={authStyles.errorText}>{error}</Text> : null}
      </ScrollView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  safeBg: { flex: 1, backgroundColor: '#05060D' },
  trust: {
    fontSize: 14,
    lineHeight: 21,
    color: '#95A8BD',
    marginBottom: 20,
    textAlign: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
    color: '#E8F0F8',
    textAlign: 'center',
    marginBottom: 20,
  },
  reframe: {
    fontSize: 15,
    lineHeight: 22,
    color: '#C8E4FF',
    marginBottom: 22,
  },
  questionBlock: { marginBottom: 22 },
  questionLabel: {
    fontSize: 15,
    lineHeight: 22,
    color: '#C8E4FF',
    marginBottom: 10,
  },
  choice: {
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.25)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  choiceActive: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91, 168, 232, 0.12)',
  },
  choiceText: { color: '#95A8BD', fontSize: 16, textAlign: 'center' },
  choiceTextActive: { color: '#E8F0F8' },
});
