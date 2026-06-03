import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { theme } from '@/shared/theme/theme';
import { getPostInterviewAssessment } from '@features/psychometrics/assessmentContent';
import {
  fetchSexualCommunicationStatus,
  formatSexualCommunicationCompletedAt,
  sexualCommunicationBand,
} from '@features/psychometrics/postInterviewSexualCommunicationService';

type Props = { userId: string };

export function SexualCommunicationProfilePanel({ userId }: Props) {
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [completed, setCompleted] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [completedAt, setCompletedAt] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void fetchSexualCommunicationStatus(userId).then((s) => {
      setCompleted(s.completed);
      setScore(s.score);
      setCompletedAt(s.completedAt);
      setLoading(false);
    });
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusRefresh(refresh);

  if (loading) {
    return (
      <View style={styles.wrap}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  const info = sexualCommunicationBand(score);
  const assessment = getPostInterviewAssessment('sexual_communication');
  const completedLabel = formatSexualCommunicationCompletedAt(completedAt);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{assessment.name}</Text>
      <Text style={styles.sectionSub}>{assessment.description}</Text>
      {completed ? (
        <>
          <Text style={styles.scoreLine}>
            Score: {score?.toFixed(2) ?? '—'}/5.0 — {info.band}
            {completedLabel ? ` · Completed ${completedLabel}` : ''}
          </Text>
          <Pressable
            style={styles.cta}
            onPress={() =>
              navigation.navigate('PostInterviewSexualCommunication', { userId })
            }
          >
            <Text style={styles.ctaText}>Retake assessment</Text>
          </Pressable>
        </>
      ) : (
        <Pressable
          style={styles.ctaPrimary}
          onPress={() =>
            navigation.navigate('PostInterviewSexualCommunication', { userId })
          }
        >
          <Text style={styles.ctaPrimaryText}>Take Sexual Communication</Text>
        </Pressable>
      )}
    </View>
  );
}

function useFocusRefresh(refresh: () => void) {
  const navigation = useNavigation();
  useEffect(() => {
    const unsub = navigation.addListener('focus', refresh);
    return unsub;
  }, [navigation, refresh]);
}

const styles = StyleSheet.create({
  wrap: {
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.card,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 6,
  },
  sectionSub: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  scoreLine: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
    color: theme.colors.textSecondary,
    marginBottom: 12,
  },
  cta: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.primary,
  },
  ctaPrimary: {
    backgroundColor: theme.colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaPrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
