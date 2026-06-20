import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { CONFLICT_STYLE_PAIRS } from '@/data/assessments/instruments/conflictStyleQuestions';
import type { ConflictStyleKey } from '@/data/assessments/instruments/conflictStyleTypes';
import { shufflePair } from '@/data/assessments/instruments/conflictStyleShuffle';
import { saveConflictStyleCompletion } from '@/data/services/conflictStyleService';
import type { RelationshipValidationTestMode } from '@features/relationshipValidation/constants';
import { fetchRelationshipTestMode } from '@features/relationshipValidation/relationshipValidationRepo';
import { reframePlatonicAssessmentStem } from '@features/relationshipValidation/platonicAssessmentReframe';
import { useAssessmentScrollContent } from '@utilities/assessmentMobileLayout';

type Props = {
  navigation: {
    replace: (screen: string, params?: Record<string, unknown>) => void;
  };
};

export function ValidationConflictScreen({ navigation }: Props) {
  const scrollContentStyle = useAssessmentScrollContent();
  const { user } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<
    Record<number, { style: ConflictStyleKey; selectedOptionIndex: number }>
  >({});
  const [saving, setSaving] = useState(false);
  const [testMode, setTestMode] = useState<RelationshipValidationTestMode | null>(null);
  const [testModeLoading, setTestModeLoading] = useState(true);
  const selectionInFlightRef = useRef<number | null>(null);

  const sessionSeed = useMemo(
    () => (user?.id || 'anon').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    [user?.id],
  );

  useEffect(() => {
    if (!user?.id) {
      setTestModeLoading(false);
      return;
    }
    let cancelled = false;
    void fetchRelationshipTestMode(user.id)
      .then((mode) => {
        if (!cancelled) setTestMode(mode);
      })
      .finally(() => {
        if (!cancelled) setTestModeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const pair = CONFLICT_STYLE_PAIRS[currentIndex];
  const shuffled = useMemo(
    () => (pair ? shufflePair(pair, sessionSeed + currentIndex) : null),
    [pair, sessionSeed, currentIndex],
  );

  const total = CONFLICT_STYLE_PAIRS.length;

  const finalize = useCallback(
    async (finalAnswers: Record<number, { style: ConflictStyleKey; selectedOptionIndex: number }>) => {
      if (!user?.id) return;
      setSaving(true);
      try {
        const responses = Object.entries(finalAnswers).map(([qi, v]) => ({
          questionIndex: Number(qi),
          selectedOptionIndex: v.selectedOptionIndex,
          selectedStyle: v.style,
        }));
        const result = await saveConflictStyleCompletion(user.id, responses, { isRetake: false });
        if (result.success) {
          navigation.replace('ValidationPsychometricsHub');
        } else {
          Alert.alert('Could not save', result.error?.message ?? 'Please try again.');
        }
      } finally {
        setSaving(false);
      }
    },
    [navigation, user?.id],
  );

  const goBack = useCallback(() => {
    if (saving) return;
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      return;
    }
    navigation.replace('ValidationInstrument', { instrument: 'PVQ-21' });
  }, [currentIndex, navigation, saving]);

  const onSelect = (optionIndex: 0 | 1) => {
    if (saving || selectionInFlightRef.current === currentIndex || !pair || !shuffled) return;
    selectionInFlightRef.current = currentIndex;
    const chosen = optionIndex === 0 ? shuffled.first : shuffled.second;
    const nextAnswers = {
      ...answers,
      [pair.id]: { style: chosen.style, selectedOptionIndex: optionIndex },
    };
    setAnswers(nextAnswers);
    setTimeout(() => {
      selectionInFlightRef.current = null;
      if (currentIndex >= total - 1) {
        void finalize(nextAnswers);
      } else {
        setCurrentIndex((i) => i + 1);
      }
    }, 200);
  };

  if (!pair || !shuffled || testModeLoading) {
    return (
      <View style={styles.overlay}>
        <ActivityIndicator size="large" color="#5BA8E8" />
      </View>
    );
  }

  const progress = ((currentIndex + 1) / total) * 100;
  const prompt = reframePlatonicAssessmentStem(pair.prompt, testMode);
  const optionA = reframePlatonicAssessmentStem(shuffled.first.text, testMode);
  const optionB = reframePlatonicAssessmentStem(shuffled.second.text, testMode);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress}%` }]} />
      </View>
      <ScrollView contentContainerStyle={scrollContentStyle}>
        <Text style={styles.meta}>
          Conflict style · Situation {currentIndex + 1} of {total}
        </Text>
        <Text style={styles.prompt}>{prompt}</Text>
        <Pressable style={styles.option} onPress={() => onSelect(0)} disabled={saving}>
          <Text style={styles.optionText}>{optionA}</Text>
        </Pressable>
        <Pressable style={styles.option} onPress={() => onSelect(1)} disabled={saving}>
          <Text style={styles.optionText}>{optionB}</Text>
        </Pressable>
        <Pressable onPress={goBack} disabled={saving} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
      </ScrollView>
      {saving ? (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05060D' },
  track: { height: 4, backgroundColor: 'rgba(82,142,220,0.15)' },
  fill: { height: 4, backgroundColor: '#5BA8E8' },
  meta: { color: '#5BA8E8', marginBottom: 12, fontSize: 13 },
  prompt: { color: '#E8F0F8', fontSize: 18, lineHeight: 26, marginBottom: 20 },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.3)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  optionText: { color: '#C8E4FF', fontSize: 15, lineHeight: 22 },
  backBtn: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingVertical: 8,
  },
  backText: {
    color: '#95A8BD',
    fontSize: 15,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,6,13,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
