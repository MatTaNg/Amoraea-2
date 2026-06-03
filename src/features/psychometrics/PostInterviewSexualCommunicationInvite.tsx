import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchSexualCommunicationResponses,
  fetchSexualCommunicationStatus,
  formatSexualCommunicationCompletedAt,
  sexualCommunicationBand,
  skipSexualCommunicationAssessment,
  type SexualCommunicationStatus,
} from '@features/psychometrics/postInterviewSexualCommunicationService';
import {
  buildSexualCommunicationInsightCopy,
  buildSexualCommunicationScores,
} from '@features/psychometrics/sexualCommunicationInsight';

const ACCENT = '#3b82f6';
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;
const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;

type Props = {
  userId: string;
  onStart: () => void;
  onStatusChange?: () => void;
};

export function PostInterviewSexualCommunicationInvite({ userId, onStart, onStatusChange }: Props) {
  const [status, setStatus] = useState<SexualCommunicationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [skipping, setSkipping] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      const s = await fetchSexualCommunicationStatus(userId);
      setStatus(s);
      if (s.completed) {
        const stored = await fetchSexualCommunicationResponses(userId);
        const scores = stored
          ? buildSexualCommunicationScores(stored)
          : s.score != null
            ? { total: s.score }
            : { total: 0 };
        const copy = buildSexualCommunicationInsightCopy(scores);
        setCompletedSummary(copy.body);
      } else {
        setCompletedSummary(null);
      }
      setLoading(false);
      onStatusChange?.();
    })();
  }, [userId, onStatusChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  if (!status || status.completed || status.skipped) {
    if (status?.completed) {
      const info = sexualCommunicationBand(status.score);
      return (
        <View style={styles.completedBox}>
          <Ionicons name="checkmark-circle" size={20} color="#86efac" style={styles.completedIcon} />
          <View style={styles.completedTextWrap}>
            <Text style={styles.completedTitle}>Sexual Communication Assessment complete</Text>
            <Text style={styles.completedMeta}>
              Score: {status.score?.toFixed(2) ?? '—'}/5.0 — {info.band}
            </Text>
          </View>
        </View>
      );
    }
    return null;
  }

  return (
    <View style={styles.inviteBlock}>
      <Text style={styles.inviteTitle}>While you wait, help us find your best matches</Text>
      <Text style={styles.inviteBody}>
        One more short questionnaire helps us understand your communication style better. Your answers are never
        shown to other users.
      </Text>
      <Pressable
        onPress={onStart}
        style={({ pressed }) => [styles.startButton, pressed && { opacity: 0.9 }]}
        accessibilityRole="button"
      >
        <Text style={styles.startButtonText}>Start Sexual Communication</Text>
      </Pressable>
      <Pressable
        onPress={() => {
          setSkipping(true);
          void skipSexualCommunicationAssessment(userId).finally(() => {
            setSkipping(false);
            refresh();
          });
        }}
        disabled={skipping}
        style={styles.skipLink}
      >
        <Text style={styles.skipLinkText}>{skipping ? '…' : 'Skip for now'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { paddingVertical: 16, alignItems: 'center' },
  inviteBlock: { width: '100%', marginBottom: 4 },
  inviteTitle: {
    fontFamily: FONT_DISPLAY,
    fontSize: 19,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 8,
  },
  inviteBody: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 14,
  },
  startButton: {
    backgroundColor: 'rgba(59,130,246,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.45)',
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: 'center',
    marginBottom: 10,
  },
  startButtonText: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '600',
    color: '#93c5fd',
  },
  skipLink: { alignSelf: 'center', paddingVertical: 6 },
  skipLinkText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  completedBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(74,222,128,0.35)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 4,
  },
  completedIcon: { marginRight: 10, marginTop: 2 },
  completedTextWrap: { flex: 1 },
  completedTitle: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: '#86efac',
    marginBottom: 4,
  },
  completedMeta: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 6,
  },
  completedBody: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.68)',
  },
});
