import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Pressable,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { LikertScale } from '@/shared/components/assessments/LikertScale';
import { getInstrumentConfig } from '@/data/assessments/instruments';
import type { ECRItem } from '@/data/assessments/instruments/ecrItems';
import { getShuffledItems } from '@/data/assessments/instruments/ecrItems';
import { saveAssessmentResult } from '@/data/services/assessmentService';
import type { AssessmentId } from '@/data/services/assessmentService';
import { theme } from '@/shared/theme/theme';
import type { RelationshipValidationTestMode } from '@features/relationshipValidation/constants';
import { fetchRelationshipTestMode } from '@features/relationshipValidation/relationshipValidationRepo';
import { reframePlatonicAssessmentStem } from '@features/relationshipValidation/platonicAssessmentReframe';
import { skipValidationSexualCommunication } from '@features/relationshipValidation/validationPsychometricsProgress';
import { useAssessmentScrollContent } from '@utilities/assessmentMobileLayout';

type Props = {
  navigation: { replace: (screen: string, params?: Record<string, unknown>) => void };
  route: { params?: { instrument?: AssessmentId } };
};

export function ValidationInstrumentScreen({ navigation, route }: Props) {
  const scrollContentStyle = useAssessmentScrollContent();
  const { user } = useAuth();
  const instrumentId = (route.params?.instrument ?? 'ECR-36') as AssessmentId;
  const config = getInstrumentConfig(instrumentId);
  const ecrShuffle = instrumentId === 'ECR-36';
  const sexualCommunication = instrumentId === 'SEXUAL_COMMUNICATION';

  const sessionSeed = useMemo(
    () => (user?.id || 'anon').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    [user?.id],
  );

  const [responses, setResponses] = useState<Record<string, number>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [ecrOrder, setEcrOrder] = useState<ECRItem[] | null>(null);
  const [testMode, setTestMode] = useState<RelationshipValidationTestMode | null>(null);
  const [testModeLoading, setTestModeLoading] = useState(true);

  const totalQuestions = config?.items.length ?? 0;

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

  useEffect(() => {
    if (ecrShuffle) {
      setEcrOrder(getShuffledItems(sessionSeed));
    } else {
      setEcrOrder(null);
    }
  }, [ecrShuffle, sessionSeed, instrumentId]);

  const finalizeAssessment = useCallback(
    async (next: Record<string, number>) => {
      if (!user?.id || !config) return;
      setSaving(true);
      try {
        const scores = config.score(next);
        const result = await saveAssessmentResult(user.id, instrumentId, scores, next, {
          skipProfileUpdate: true,
        });
        if (result.success) {
          navigation.replace('ValidationPsychometricsHub');
        } else {
          Alert.alert('Could not save', result.error?.message ?? 'Please try again.');
        }
      } finally {
        setSaving(false);
      }
    },
    [user?.id, config, instrumentId, navigation],
  );

  const handleSkipSection = useCallback(async () => {
    if (!user?.id || !sexualCommunication) return;
    setSkipping(true);
    try {
      await skipValidationSexualCommunication(user.id);
      navigation.replace('ValidationPsychometricsHub');
    } catch {
      Alert.alert('Could not skip', 'Please try again.');
    } finally {
      setSkipping(false);
    }
  }, [navigation, sexualCommunication, user?.id]);

  const handleResponse = useCallback(
    (value: number) => {
      const idx = Math.max(0, Math.min(currentIndex, Math.max(totalQuestions - 1, 0)));
      const activeItem = ecrShuffle && ecrOrder ? ecrOrder[idx] : null;
      const responseKey = activeItem ? activeItem.id : idx + 1;

      setResponses((prev) => {
        const next = { ...prev, [String(responseKey)]: value };
        if (idx >= totalQuestions - 1) {
          queueMicrotask(() => void finalizeAssessment(next));
        }
        return next;
      });

      if (idx < totalQuestions - 1) {
        setTimeout(() => setCurrentIndex(idx + 1), 250);
      }
    },
    [currentIndex, totalQuestions, ecrShuffle, ecrOrder, finalizeAssessment],
  );

  if (!config || (ecrShuffle && !ecrOrder) || testModeLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#5BA8E8" />
      </View>
    );
  }

  const questionNumber = currentIndex + 1;
  const activeEcrItem = ecrShuffle && ecrOrder ? ecrOrder[currentIndex] : null;
  const rawItemText = activeEcrItem?.text ?? config.items[currentIndex];
  const itemText = reframePlatonicAssessmentStem(rawItemText, testMode);
  const canonicalId = activeEcrItem?.id ?? currentIndex + 1;
  const flowProgressPct = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0;
  const showSkipSection = sexualCommunication && currentIndex === 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.flowProgressTrack}>
        <View style={[styles.flowProgressFill, { width: `${flowProgressPct}%` }]} />
      </View>
      <ScrollView contentContainerStyle={scrollContentStyle}>
        <Text style={styles.meta}>
          {config.title} · Question {questionNumber} of {totalQuestions}
        </Text>
        {showSkipSection ? (
          <Pressable
            onPress={() => void handleSkipSection()}
            disabled={saving || skipping}
            style={styles.skipButton}
          >
            <Text style={styles.skipButtonText}>
              {skipping ? 'Skipping…' : 'Skip this section'}
            </Text>
          </Pressable>
        ) : null}
        <Text style={styles.questionText}>{itemText}</Text>
        <LikertScale
          value={responses[String(canonicalId)] ?? null}
          onChange={handleResponse}
          min={config.min}
          max={config.max}
          minLabel={config.minLabel}
          maxLabel={config.maxLabel}
        />
        {currentIndex > 0 ? (
          <Pressable onPress={() => setCurrentIndex((i) => Math.max(0, i - 1))} disabled={saving}>
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        ) : null}
      </ScrollView>
      {saving ? (
        <View style={styles.savingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  centered: {
    flex: 1,
    backgroundColor: '#05060D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowProgressTrack: {
    height: 4,
    backgroundColor: 'rgba(82, 142, 220, 0.15)',
  },
  flowProgressFill: {
    height: 4,
    backgroundColor: '#5BA8E8',
  },
  meta: {
    color: '#5BA8E8',
    fontSize: 13,
    marginBottom: 16,
  },
  skipButton: {
    alignSelf: 'flex-start',
    marginBottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(82, 142, 220, 0.35)',
  },
  skipButtonText: {
    color: '#95A8BD',
    fontSize: 14,
  },
  questionText: {
    color: '#E8F0F8',
    fontSize: 18,
    lineHeight: 26,
    marginBottom: 24,
    fontFamily: Platform.OS === 'web' ? "'Jost', sans-serif" : undefined,
  },
  backText: {
    color: '#95A8BD',
    marginTop: 20,
    fontSize: 15,
  },
  savingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 6, 13, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
