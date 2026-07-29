import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { formatLaunchWaitlistScoreDisplay } from '@features/onboarding/launchWaitlistScorePresentation';
import { useLaunchWaitlistScoreSummaryQuery } from '@features/onboarding/postInterviewLaunchQueries';
import { PostInterviewDidIPassModal } from '@features/onboarding/PostInterviewDidIPassModal';

const GLASS_BG = 'rgba(255,255,255,0.06)';
const GLASS_BORDER = 'rgba(255,255,255,0.12)';
const ACCENT = '#3b82f6';
const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;

type PostInterviewLaunchScoreSummaryProps = {
  userId: string;
};

export function PostInterviewLaunchScoreSummary({ userId }: PostInterviewLaunchScoreSummaryProps) {
  const [passModalVisible, setPassModalVisible] = useState(false);
  const { data, isPending } = useLaunchWaitlistScoreSummaryQuery(userId);
  const finalModifiedScore = data?.finalModifiedScore ?? null;
  const cohortAverageScore = data?.cohortAverageScore ?? null;

  return (
    <>
      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Your Score</Text>
        {isPending ? (
          <ActivityIndicator color={ACCENT} style={styles.loader} />
        ) : (
          <Text style={styles.finalScore}>{formatLaunchWaitlistScoreDisplay(finalModifiedScore)}</Text>
        )}
        <Text style={styles.averageLabel}>Average of all scores</Text>
        {isPending ? (
          <Text style={styles.averageScore}>—</Text>
        ) : (
          <Text style={styles.averageScore}>{formatLaunchWaitlistScoreDisplay(cohortAverageScore)}</Text>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Did I pass?"
          onPress={() => setPassModalVisible(true)}
          style={({ pressed }) => [styles.passLinkWrap, pressed && styles.passLinkPressed]}
        >
          <Text style={styles.passLink}>Did I pass?</Text>
        </Pressable>
      </View>
      <PostInterviewDidIPassModal visible={passModalVisible} onClose={() => setPassModalVisible(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: GLASS_BG,
    borderWidth: 1,
    borderColor: GLASS_BORDER,
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  sectionLabel: {
    fontFamily: FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
    color: 'rgba(255,255,255,0.58)',
    marginBottom: 8,
  },
  loader: {
    marginVertical: 12,
  },
  finalScore: {
    fontFamily: FONT_DISPLAY,
    fontSize: 56,
    fontWeight: '600',
    color: '#F4F4F5',
    lineHeight: 60,
    marginBottom: 18,
  },
  averageLabel: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 4,
  },
  averageScore: {
    fontFamily: FONT_BODY,
    fontSize: 22,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.78)',
    marginBottom: 18,
  },
  passLinkWrap: {
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  passLinkPressed: {
    opacity: 0.85,
  },
  passLink: {
    fontFamily: FONT_BODY,
    fontSize: 15,
    fontWeight: '700',
    color: ACCENT,
    textDecorationLine: 'underline',
  },
});
