import React, { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { Button } from '@/shared/ui/Button';
import {
  ASSESSMENT_IDS,
  FIRST_DATING_PROFILE_ASSESSMENT_ID,
  markAssessmentsStarted,
  TYPOLOGY_ASSESSMENT_DURATION_MIN,
  TYPOLOGY_ONBOARDING_TOTAL_DURATION_LABEL,
  TYPOLOGY_PROFILE_SETUP_DURATION_MIN,
} from '@/data/services/assessmentService';
import { exitDatingProfileOnboardingToPostInterview } from '@/datingProfile/onboarding/exitDatingProfileOnboardingToPostInterview';
import { theme } from '@/shared/theme/theme';

const INSTRUMENT_LABELS: Record<(typeof ASSESSMENT_IDS)[number], string> = {
  'ECR-36': 'Attachment style',
  'CONFLICT-30': 'Conflict style',
  'PVQ-21': 'Core values (Schwartz)',
  SEXUAL_COMMUNICATION: 'Sexual communication',
};

function formatTypologyDurationMinutes(minutes: number): string {
  return `${minutes}m`;
}

/**
 * One-time overview before the first profile psychometric instrument (shortest test first).
 */
export function RelationshipTypologyIntroScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<DatingProfileStackParamList>>();
  const { user } = useAuth();

  const handleBackToPostInterview = useCallback(() => {
    exitDatingProfileOnboardingToPostInterview(navigation, user?.id);
  }, [navigation, user?.id]);

  const handleBegin = () => {
    void (async () => {
      if (!user?.id) return;
      const result = await markAssessmentsStarted(user.id, FIRST_DATING_PROFILE_ASSESSMENT_ID);
      if (!result.success) {
        console.error(result.error);
        return;
      }
      navigation.replace('DatingInstrument', { instrument: FIRST_DATING_PROFILE_ASSESSMENT_ID });
    })();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <Pressable style={styles.backBtn} onPress={handleBackToPostInterview} accessibilityRole="button">
        <Text style={styles.backText}>← Back to your results</Text>
      </Pressable>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.inner}>
          <View style={styles.card}>
            <View style={styles.cardAccent} pointerEvents="none" />
            <Text style={styles.overline}>Relationship typology</Text>
            <Text style={styles.title}>How we learn how you connect</Text>
            <Text style={styles.subtitle}>
              You will complete four brief psychometric tests and your profile—about{' '}
              {TYPOLOGY_ONBOARDING_TOTAL_DURATION_LABEL} total, with pauses between each step.
            </Text>

            <Text style={styles.sectionLabel}>What you will complete</Text>
            {ASSESSMENT_IDS.map((id, index) => (
              <View key={id} style={styles.testRow}>
                <View style={styles.testNum}>
                  <Text style={styles.testNumText}>{index + 1}</Text>
                </View>
                <Text style={styles.testLabel}>{INSTRUMENT_LABELS[id] ?? id}</Text>
                <Text style={styles.testDuration}>
                  {formatTypologyDurationMinutes(TYPOLOGY_ASSESSMENT_DURATION_MIN[id])}
                </Text>
              </View>
            ))}
            <View style={[styles.testRow, styles.testRowLast]}>
              <View style={styles.testNum}>
                <Text style={styles.testNumText}>5</Text>
              </View>
              <Text style={styles.testLabel}>Profile setup</Text>
              <Text style={styles.testDuration}>
                {formatTypologyDurationMinutes(TYPOLOGY_PROFILE_SETUP_DURATION_MIN)}
              </Text>
            </View>

            <Text style={styles.body}>
              These are validated research instruments. Together they
              help us understand how you connect, communicate, and show up in relationships.
            </Text>

            <View style={styles.tip}>
              <Text style={styles.tipText}>
                Answer honestly, there are no right or wrong patterns. You can leave and come back
                anytime; progress is saved automatically after each test.
              </Text>
            </View>
          </View>

          <Text style={styles.meta}>
            Four psychometric assessments + profile · ~{TYPOLOGY_ONBOARDING_TOTAL_DURATION_LABEL} total
          </Text>

          <View style={styles.buttonBlock}>
            <Button title="Begin Sexual Communication Test →" onPress={handleBegin} variant="solid" />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 15,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  inner: {
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    flexGrow: 1,
  },
  card: {
    backgroundColor: theme.colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: theme.colors.primary,
    opacity: 0.85,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: theme.colors.primary,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 22,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 10,
  },
  testRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: 12,
  },
  testRowLast: {
    borderBottomWidth: 0,
  },
  testNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(91, 168, 232, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  testNumText: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  testLabel: {
    flex: 1,
    fontSize: 16,
    color: theme.colors.text,
    lineHeight: 22,
  },
  testDuration: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textSecondary,
    minWidth: 28,
    textAlign: 'right',
  },
  body: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    lineHeight: 24,
    marginTop: 18,
  },
  tip: {
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: 'rgba(91, 168, 232, 0.08)',
    borderLeftWidth: 3,
    borderLeftColor: theme.colors.primary,
  },
  tipText: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  meta: {
    marginTop: 14,
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  buttonBlock: {
    marginTop: 28,
  },
});
