import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { PostInterviewScrollLayout } from '@app/screens/onboarding/PostInterviewScrollLayout';
import { getPostInterviewAssessment } from '@features/psychometrics/assessmentContent';
import { getInsightContent } from '@/data/assessments/insightContent';
import { contentToSnapshot } from '@/screens/assessments/useAssessmentInsightPayload';
import { AssessmentInsightBody } from '@/shared/components/assessments/AssessmentInsightBody';
import { buildSexualCommunicationScores } from '@features/psychometrics/sexualCommunicationInsight';
import {
  fetchSexualCommunicationResponses,
  fetchSexualCommunicationStatus,
  loadSexualCommunicationResume,
  saveSexualCommunicationProgress,
  saveSexualCommunicationResult,
  skipSexualCommunicationAssessment,
} from '@features/psychometrics/postInterviewSexualCommunicationService';

const ACCENT = '#3b82f6';
const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type Props = {
  navigation: { goBack: () => void };
  route: { params?: { userId?: string } };
};

export function PostInterviewSexualCommunicationScreen({ navigation, route }: Props) {
  const userId = route.params?.userId ?? '';
  const assessment = getPostInterviewAssessment('sexual_communication');
  const totalQuestions = assessment.questions.length;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [responses, setResponses] = useState<Record<number, number>>({});
  const [done, setDone] = useState(false);
  const [resultScores, setResultScores] = useState<Record<string, number> | null>(null);

  const loadState = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    const status = await fetchSexualCommunicationStatus(userId);
    if (status.completed) {
      setDone(true);
      setLoading(false);
      return;
    }
    const resume = await loadSexualCommunicationResume(userId);
    setQuestionIndex(Math.min(resume.questionIndex, totalQuestions - 1));
    setResponses(resume.responses);
    setLoading(false);
  }, [totalQuestions, userId]);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  async function handleAnswer(value: number) {
    if (!userId || saving) return;
    const question = assessment.questions[questionIndex];
    if (!question) return;

    const nextResponses = { ...responses, [question.id]: value };
    setResponses(nextResponses);

    const isLast = questionIndex >= totalQuestions - 1;
    if (!isLast) {
      const nextIndex = questionIndex + 1;
      setQuestionIndex(nextIndex);
      await saveSexualCommunicationProgress(userId, nextIndex, nextResponses);
      return;
    }

    setSaving(true);
    try {
      await saveSexualCommunicationResult(userId, nextResponses);
      setResultScores(buildSexualCommunicationScores(nextResponses));
      setDone(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      await skipSexualCommunicationAssessment(userId);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (questionIndex > 0) {
      const prev = questionIndex - 1;
      setQuestionIndex(prev);
      void saveSexualCommunicationProgress(userId, prev, responses);
      return;
    }
    navigation.goBack();
  }

  if (loading) {
    return (
      <PostInterviewScrollLayout>
        <ActivityIndicator color={ACCENT} size="large" />
      </PostInterviewScrollLayout>
    );
  }

  if (done) {
    return (
      <PostInterviewScrollLayout>
        <Text style={styles.title}>Thank you</Text>
        <Text style={styles.subtitle}>
          Your responses help us understand communication comfort for better matching.
        </Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.primaryButtonText}>Done</Text>
        </TouchableOpacity>
      </PostInterviewScrollLayout>
    );
  }

  const question = assessment.questions[questionIndex];
  const scaleEntries = Object.entries(assessment.scale.labels).sort(
    ([a], [b]) => Number(a) - Number(b),
  );
  const progress = (questionIndex + 1) / totalQuestions;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressLabel}>
          Question {questionIndex + 1} of {totalQuestions}
        </Text>
        <Text style={styles.framing}>While you wait, help us find your best matches</Text>
        <Text style={styles.instrumentName}>{assessment.name}</Text>
        <Text style={styles.instrumentDescription}>{assessment.description}</Text>
        <Text style={styles.questionText}>{question?.text}</Text>
        <Text style={styles.prompt}>How comfortable would you feel…</Text>

        <View style={styles.options}>
          {scaleEntries.map(([value, label]) => (
            <TouchableOpacity
              key={value}
              style={styles.option}
              onPress={() => void handleAnswer(Number(value))}
              disabled={saving}
            >
              <Text style={styles.optionText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.footerRow}>
          <TouchableOpacity onPress={handleBack} disabled={saving} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => void handleSkip()} disabled={saving} style={styles.skipButton}>
            <Text style={styles.skipButtonText}>Skip for now</Text>
          </TouchableOpacity>
        </View>
        {saving ? <ActivityIndicator color={ACCENT} style={{ marginTop: 16 }} /> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0a0a0f' },
  scroll: {
    flexGrow: 1,
    padding: 24,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 2,
    marginBottom: 8,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: ACCENT },
  progressLabel: {
    fontFamily: FONT_BODY,
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 20,
  },
  framing: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    color: 'rgba(255,255,255,0.72)',
    marginBottom: 8,
    textAlign: 'center',
  },
  instrumentName: {
    fontFamily: FONT_DISPLAY,
    fontSize: 22,
    fontWeight: '600',
    color: '#fafafa',
    textAlign: 'center',
    marginBottom: 12,
  },
  instrumentDescription: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 20,
  },
  questionText: {
    fontFamily: FONT_DISPLAY,
    fontSize: 20,
    fontWeight: '500',
    color: '#f4f4f5',
    lineHeight: 28,
    textAlign: 'center',
    marginBottom: 8,
  },
  prompt: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 20,
  },
  options: { gap: 10 },
  option: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  optionText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: '#e8f0f8',
    textAlign: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    gap: 12,
  },
  secondaryButton: { paddingVertical: 12, paddingHorizontal: 8 },
  secondaryButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: 'rgba(255,255,255,0.75)',
  },
  skipButton: { paddingVertical: 12, paddingHorizontal: 8 },
  skipButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    color: ACCENT,
    fontWeight: '500',
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 26,
    fontWeight: '600',
    color: '#fafafa',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  primaryButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resultsScroll: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingBottom: 16,
  },
});
