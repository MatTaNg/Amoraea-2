import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { formatTranscriptTurnContentForDisplay } from '@features/aria/interviewTranscriptTurns';
import {
  inferLatestScenarioFromTranscript,
  parseUserTranscript,
} from '@features/admin/interviewDashboard/adminInterviewTranscriptParseUtils';
import { userHasInProgressInterview } from '@features/admin/interviewDashboard/adminInterviewDashboardCohortUtils';
import { userDetailsStyles as styles } from '@features/admin/interviewDashboard/adminInterviewUserDetailsStyles';
import type { AttemptSummary, UserRow } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function AdminInterviewInProgressTranscriptSection({
  user,
  latestAttempt,
  liveTranscript,
  onRefresh,
}: {
  user: UserRow;
  latestAttempt?: AttemptSummary | null;
  liveTranscript?: unknown;
  onRefresh: () => void;
}) {
  if (!userHasInProgressInterview(user, latestAttempt)) return null;
  const lines = parseUserTranscript(liveTranscript);
  const inferredScenario = inferLatestScenarioFromTranscript(lines);
  return (
    <View style={styles.inProgressSection}>
      <View style={styles.inProgressHeaderRow}>
        <Text style={styles.inProgressTitle}>In-progress interview</Text>
        <TouchableOpacity onPress={onRefresh} accessibilityRole="button" accessibilityLabel="Refresh transcript">
          <Text style={styles.refreshLink}>Refresh</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.inProgressMeta}>
        {inferredScenario != null ? `Latest scenario in snapshot: ${inferredScenario} · ` : ''}
        {lines.length} message{lines.length === 1 ? '' : 's'}
      </Text>
      {lines.length === 0 ? (
        <Text style={styles.blockText}>
          No transcript rows yet — live sync runs every few seconds during the interview, or appears after the first
          scenario checkpoint.
        </Text>
      ) : (
        <ScrollView style={styles.inProgressScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {lines.map((m, idx) => (
            <Text key={`live-${m.role}-${idx}`} style={styles.transcriptLine}>
              {m.role}
              {m.scenarioNumber != null ? ` (s${m.scenarioNumber})` : ''}:{' '}
              {formatTranscriptTurnContentForDisplay(m.role, m.content)}
            </Text>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
