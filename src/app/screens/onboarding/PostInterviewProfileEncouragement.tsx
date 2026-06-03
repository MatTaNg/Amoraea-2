import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { POST_INTERVIEW_PROFILE_BENEFITS } from '@features/onboarding/postInterviewProfileCompletion';

const ACCENT = '#3b82f6';
const FONT_BODY = Platform.OS === 'web' ? "'DM Sans', system-ui, sans-serif" : undefined;
const FONT_DISPLAY = Platform.OS === 'web' ? "'Cormorant Garamond', serif" : undefined;

type Props = {
  timeEstimateLabel: string | null;
};

/**
 * Explains why completing the dating profile matters after passing the interview.
 */
export function PostInterviewProfileEncouragement({ timeEstimateLabel }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Complete your profile</Text>
      <Text style={styles.lead}>
        A few more details unlock compatibility matching, pre-event insights, and match emails.
      </Text>
      <View style={styles.benefits}>
        {POST_INTERVIEW_PROFILE_BENEFITS.map((line) => (
          <View key={line} style={styles.benefitRow}>
            <Ionicons name="sparkles-outline" size={17} color={ACCENT} style={styles.benefitIcon} />
            <Text style={styles.benefitText}>{line}</Text>
          </View>
        ))}
      </View>
      {timeEstimateLabel ? (
        <View style={styles.timeRow}>
          <Ionicons name="time-outline" size={16} color="rgba(255,255,255,0.45)" />
          <Text style={styles.timeText}>{timeEstimateLabel}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 4,
    marginBottom: 14,
    paddingTop: 4,
  },
  title: {
    fontFamily: FONT_DISPLAY,
    fontSize: 18,
    fontWeight: '600',
    color: '#f4f4f5',
    marginBottom: 6,
    textAlign: 'center',
  },
  lead: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  benefits: { gap: 10 },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start' },
  benefitIcon: { marginTop: 2, marginRight: 10 },
  benefitText: {
    flex: 1,
    fontFamily: FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(255,255,255,0.9)',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
  },
  timeText: {
    fontFamily: FONT_BODY,
    fontSize: 13,
    fontWeight: '400',
    color: 'rgba(255,255,255,0.55)',
  },
});
