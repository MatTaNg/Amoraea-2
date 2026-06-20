import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlameOrb } from '@app/screens/FlameOrb';
import { Button } from '@/shared/ui/Button';
import { spacing } from '@ui/theme/spacing';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { showConfirmDialog } from '@utilities/alerts/confirmDialog';
import { PsychometricsAdminPanelButton } from './PsychometricsAdminPanelButton';
import { PsychometricsBackButton } from './PsychometricsBackButton';
import {
  PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES,
  PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES_LABEL,
  PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES,
} from './assessmentContent';
import {
  loadPsychometricsWebFontsOnce,
  PSYCHOMETRICS_ACCENT,
  PSYCHOMETRICS_BG,
  PSYCHOMETRICS_FONT_BODY,
  PSYCHOMETRICS_FONT_DISPLAY,
  PSYCHOMETRICS_TIP_CARD_BG,
  PSYCHOMETRICS_TIP_CARD_BORDER,
} from './psychometricsTheme';
import { useAssessmentScrollContent, useNarrowAssessmentViewport } from '@utilities/assessmentMobileLayout';

export type WelcomeModalVariant = 'interviewFirst' | 'psychometricsFirst';

interface WelcomeModalProps {
  visible: boolean;
  onContinue: () => void;
  onOpenAdminPanel?: () => void;
  continueDisabled?: boolean;
  onBackPress?: () => void;
  /** Interview-first (default): AI interview then self assessments. */
  variant?: WelcomeModalVariant;
  continueLabel?: string;
}

export function WelcomeModal({
  visible,
  onContinue,
  onOpenAdminPanel,
  continueDisabled,
  onBackPress,
  variant = 'interviewFirst',
  continueLabel,
}: WelcomeModalProps) {
  const { signOut } = useAuth();
  const scrollContentStyle = useAssessmentScrollContent({ alignItems: 'center' });
  const narrowViewport = useNarrowAssessmentViewport();

  useEffect(() => {
    if (visible) loadPsychometricsWebFontsOnce();
  }, [visible]);

  const handleLogOut = useCallback(() => {
    showConfirmDialog(
      {
        title: 'Log out',
        message: 'Are you sure you want to log out?',
        confirmText: 'Log out',
      },
      () => void signOut(),
    );
  }, [signOut]);

  const interviewFirst = variant === 'interviewFirst';
  const interviewTimeLabel = interviewFirst
    ? `~${PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES_LABEL} min`
    : `~${PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES} min`;
  const psychTimeLabel = `~${PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES} min`;
  const ctaTitle =
    continueLabel ?? (interviewFirst ? 'Continue' : 'Begin Assessments');
  const totalLabel = interviewFirst
    ? `Total: approximately 30-40 min`
    : `Total: approximately ${PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES + PRE_INTERVIEW_AI_INTERVIEW_ESTIMATED_MINUTES} minutes`;

  const parts = interviewFirst
    ? [
        {
          key: 'interview',
          icon: 'chatbubble-ellipses-outline' as const,
          label: 'Part 1 — AI Interview',
          time: interviewTimeLabel,
          description:
            'A conversational interview with Aira, our AI interviewer, exploring how you think about and navigate relationships.',
        },
        {
          key: 'psychometrics',
          icon: 'clipboard-outline' as const,
          label: 'Part 2 — Self Assessments',
          time: psychTimeLabel,
          description:
            'Short questionnaires grounded in validated relationship science. There are no right or wrong answers — just answer honestly.',
        },
      ]
    : [
        {
          key: 'psychometrics',
          icon: 'clipboard-outline' as const,
          label: 'Part 1 — Self Assessments',
          time: psychTimeLabel,
          description:
            'Short questionnaires grounded in validated relationship science. There are no right or wrong answers — just answer honestly.',
        },
        {
          key: 'interview',
          icon: 'chatbubble-ellipses-outline' as const,
          label: 'Part 2 — AI Interview',
          time: interviewTimeLabel,
          description:
            'A conversational interview with Aira, our AI interviewer, exploring how you think about and navigate relationships.',
        },
      ];

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent>
      <SafeAreaView style={styles.safe}>
        {onBackPress ? <PsychometricsBackButton onPress={onBackPress} /> : null}
        <TouchableOpacity
          style={[styles.logoutButton, onOpenAdminPanel ? styles.logoutButtonWithAdmin : null]}
          onPress={handleLogOut}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Log out"
        >
          <Ionicons name="log-out-outline" size={16} color={PSYCHOMETRICS_ACCENT} />
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
        {onOpenAdminPanel ? <PsychometricsAdminPanelButton onPress={onOpenAdminPanel} /> : null}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            scrollContentStyle,
            onBackPress ? styles.scrollContentWithBack : null,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoWrap}>
            <FlameOrb state="idle" size={72} minimalGlow />
          </View>

          <Text style={[styles.title, narrowViewport && styles.titleNarrow]}>Welcome to Amoraea</Text>
          <Text style={styles.subtitle}>
            Before you can be matched, we need to get to know you. These assessments help us understand
            how you show up in relationships and build a profile that reflects who you really are.
          </Text>

          {parts.map((part) => (
            <View key={part.key} style={styles.partCard}>
              <View style={styles.partCardHeader}>
                <Ionicons
                  name={part.icon}
                  size={26}
                  color={PSYCHOMETRICS_ACCENT}
                  style={styles.partIcon}
                />
                <View style={styles.partHeaderText}>
                  <Text style={styles.partLabel}>{part.label}</Text>
                  <Text style={styles.partTime}>{part.time}</Text>
                </View>
              </View>
              <Text style={styles.partDescription}>{part.description}</Text>
            </View>
          ))}

          <View style={styles.totalRow}>
            <Ionicons name="time-outline" size={18} color={PSYCHOMETRICS_ACCENT} />
            <Text style={styles.totalTime}>{totalLabel}</Text>
          </View>

          <Text style={styles.scienceNote}>
            At the end you'll receive a detailed personal report covering your strengths and areas for growth.
          </Text>

          <View style={styles.ctaWrap}>
            <Button
              title={ctaTitle}
              onPress={onContinue}
              disabled={continueDisabled}
              style={styles.cta}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
  },
  scrollContentWithBack: {
    paddingTop: 56,
  },
  logoWrap: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontFamily: PSYCHOMETRICS_FONT_DISPLAY,
    fontSize: 28,
    fontWeight: '600',
    color: '#F4F8FC',
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 34,
  },
  titleNarrow: {
    fontSize: 24,
    lineHeight: 30,
  },
  subtitle: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    color: '#7A9ABE',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.xs,
  },
  partCard: {
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: spacing.md,
    marginBottom: spacing.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: PSYCHOMETRICS_TIP_CARD_BORDER,
    backgroundColor: PSYCHOMETRICS_TIP_CARD_BG,
    alignSelf: 'stretch',
  },
  partCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    marginBottom: spacing.sm,
  },
  partIcon: {
    marginRight: spacing.sm,
    marginTop: 2,
  },
  partHeaderText: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  partLabel: {
    flex: 1,
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 16,
    fontWeight: '600',
    color: '#E8F0F8',
    lineHeight: 22,
  },
  partTime: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: PSYCHOMETRICS_ACCENT,
  },
  partDescription: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    color: '#B8C9DC',
    lineHeight: 21,
    alignSelf: 'stretch',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    alignSelf: 'stretch',
  },
  totalTime: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: '#E8F0F8',
    flexShrink: 1,
    textAlign: 'center',
  },
  scienceNote: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.lg,
    alignSelf: 'stretch',
  },
  ctaWrap: {
    alignSelf: 'stretch',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  cta: {
    minWidth: 260,
    paddingHorizontal: spacing.lg,
  },
  logoutButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(30,111,217,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(82,142,220,0.2)',
    borderRadius: 6,
    zIndex: 100,
  },
  logoutButtonWithAdmin: {
    top: 56,
  },
  logoutButtonText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: PSYCHOMETRICS_ACCENT,
    textTransform: 'uppercase',
    ...(Platform.OS === 'web' ? { userSelect: 'none' as const } : {}),
  },
});
