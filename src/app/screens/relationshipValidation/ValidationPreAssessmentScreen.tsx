import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaContainer } from '@ui/components/SafeAreaContainer';
import { authStyles } from '@app/screens/authStyles';
import {
  RELATIONSHIP_DURATION_OPTIONS,
  RELATIONSHIP_ENDING_OPTIONS,
  type RelationshipValidationPreAssessment,
} from '@features/relationshipValidation/constants';
import { savePreAssessment } from '@features/relationshipValidation/relationshipValidationRepo';
import {
  isValidationPsychometricsComplete,
  maybeComputeValidationPairScore,
} from '@features/relationshipValidation/relationshipValidationService';

import { useAssessmentScrollContent } from '@utilities/assessmentMobileLayout';

type Props = {
  userId: string;
  navigation: { navigate: (screen: string) => void; replace: (screen: string) => void };
};

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.questionBlock}>
      <Text style={styles.questionLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(n)}
            style={[styles.sliderChip, value === n && styles.sliderChipActive]}
          >
            <Text style={[styles.sliderChipText, value === n && styles.sliderChipTextActive]}>
              {n}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ValidationPreAssessmentScreen({ userId, navigation }: Props) {
  const scrollContentStyle = useAssessmentScrollContent();
  const [duration, setDuration] = useState<string | null>(null);
  const [overallCompatibility, setOverallCompatibility] = useState(0);
  const [conflictHandling, setConflictHandling] = useState(0);
  const [valuesAlignment, setValuesAlignment] = useState(0);
  const [emotionalAttunement, setEmotionalAttunement] = useState(0);
  const [consideredEnding, setConsideredEnding] = useState<string | null>(null);
  const [overallSatisfaction, setOverallSatisfaction] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const answeredCount = useMemo(() => {
    let n = 0;
    if (duration) n += 1;
    if (overallCompatibility > 0) n += 1;
    if (conflictHandling > 0) n += 1;
    if (valuesAlignment > 0) n += 1;
    if (emotionalAttunement > 0) n += 1;
    if (consideredEnding) n += 1;
    if (overallSatisfaction > 0) n += 1;
    return n;
  }, [
    duration,
    overallCompatibility,
    conflictHandling,
    valuesAlignment,
    emotionalAttunement,
    consideredEnding,
    overallSatisfaction,
  ]);

  const handleSubmit = async () => {
    if (answeredCount < 7) {
      setError('Please answer all questions before continuing.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload: RelationshipValidationPreAssessment = {
        duration: duration as RelationshipValidationPreAssessment['duration'],
        overallCompatibility,
        conflictHandling,
        valuesAlignment,
        emotionalAttunement,
        consideredEnding: consideredEnding as RelationshipValidationPreAssessment['consideredEnding'],
        overallSatisfaction,
      };
      await savePreAssessment(userId, payload);
      const psychometricsDone = await isValidationPsychometricsComplete(userId);
      if (psychometricsDone) {
        await maybeComputeValidationPairScore(userId);
        navigation.replace('ValidationReport');
      } else {
        navigation.replace('ValidationPsychometricsHub');
      }
    } catch {
      setError('Could not save your responses. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaContainer style={styles.safeBg}>
      <ScrollView contentContainerStyle={scrollContentStyle} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>About your relationship</Text>
        <Text style={styles.progress}>
          {answeredCount} of 7 answered
        </Text>

        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>How long have you been together?</Text>
          {RELATIONSHIP_DURATION_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setDuration(opt.value)}
              style={[styles.choice, duration === opt.value && styles.choiceActive]}
            >
              <Text style={[styles.choiceText, duration === opt.value && styles.choiceTextActive]}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <SliderRow
          label="On a scale of 1–10, how compatible do you feel with your partner overall?"
          value={overallCompatibility}
          onChange={setOverallCompatibility}
        />
        <SliderRow
          label="On a scale of 1–10, how well do you handle conflict together?"
          value={conflictHandling}
          onChange={setConflictHandling}
        />
        <SliderRow
          label="On a scale of 1–10, how aligned are your core values?"
          value={valuesAlignment}
          onChange={setValuesAlignment}
        />
        <SliderRow
          label="On a scale of 1–10, how emotionally attuned do you feel your partner is to you?"
          value={emotionalAttunement}
          onChange={setEmotionalAttunement}
        />

        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>
            Have you ever seriously considered ending the relationship?
          </Text>
          {RELATIONSHIP_ENDING_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              onPress={() => setConsideredEnding(opt.value)}
              style={[styles.choice, consideredEnding === opt.value && styles.choiceActive]}
            >
              <Text
                style={[
                  styles.choiceText,
                  consideredEnding === opt.value && styles.choiceTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <SliderRow
          label="How satisfied are you with the relationship overall?"
          value={overallSatisfaction}
          onChange={setOverallSatisfaction}
        />

        {error ? <Text style={authStyles.errorText}>{error}</Text> : null}

        <Pressable
          onPress={() => void handleSubmit()}
          disabled={saving}
          style={[authStyles.primaryButton, saving && { opacity: 0.6 }]}
        >
          <Text style={authStyles.primaryButtonText}>
            {saving ? 'Saving…' : 'Continue to compatibility assessment'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaContainer>
  );
}

const styles = StyleSheet.create({
  safeBg: { flex: 1, backgroundColor: '#05060D' },
  title: {
    fontSize: 24,
    color: '#E8F0F8',
    textAlign: 'center',
    marginBottom: 8,
  },
  progress: {
    fontSize: 13,
    color: '#5BA8E8',
    textAlign: 'center',
    marginBottom: 20,
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  choiceActive: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91, 168, 232, 0.12)',
  },
  choiceText: { color: '#95A8BD', fontSize: 15 },
  choiceTextActive: { color: '#E8F0F8' },
  sliderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    width: '100%',
  },
  sliderChip: {
    flexGrow: 1,
    flexBasis: '9%',
    minWidth: 28,
    maxWidth: 44,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.25)',
    alignItems: 'center',
  },
  sliderChipActive: {
    borderColor: '#5BA8E8',
    backgroundColor: 'rgba(91, 168, 232, 0.2)',
  },
  sliderChipText: { color: '#95A8BD', fontSize: 13 },
  sliderChipTextActive: { color: '#E8F0F8', fontWeight: '600' },
});
