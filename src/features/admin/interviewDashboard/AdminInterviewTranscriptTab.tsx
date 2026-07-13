import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { formatTranscriptTurnContentForDisplay } from '@features/aria/interviewTranscriptTurns';
import { detailTabStyles as styles } from '@features/admin/interviewDashboard/adminInterviewDetailTabStyles';
import type { AttemptRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function AdminInterviewTranscriptTab({ attempt }: { attempt: AttemptRow }) {
  const transcript = attempt.transcript ?? [];
  if (transcript.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No transcript available for this test.</Text>
      </View>
    );
  }
  return (
    <ScrollView style={styles.innerTabContent}>
      {transcript.map((m, idx) => (
        <Text key={`${m.role}-${idx}`} style={styles.transcriptLine}>
          {m.role}: {formatTranscriptTurnContentForDisplay(m.role, m.content)}
        </Text>
      ))}
    </ScrollView>
  );
}
