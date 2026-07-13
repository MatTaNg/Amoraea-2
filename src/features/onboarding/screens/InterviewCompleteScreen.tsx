import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Platform,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlameOrb } from '@app/screens/FlameOrb';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { DownloadPartialReportButton } from '@features/psychometrics/DownloadPartialReportButton';
import { ValidationFlowOptInCard } from '@features/relationshipValidation/ValidationFlowOptInCard';
import {
  PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES,
} from '@features/psychometrics/assessmentContent';
import { PSYCHOMETRICS_ENABLED } from '@features/psychometrics/interviewCompletionStatus';
import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';
import {
  refreshInterviewReportAttemptForPartialReport,
  type InterviewReportAttempt,
} from '@features/onboarding/loadInterviewReportAttempt';
import {
  loadPsychometricsWebFontsOnce,
  PSYCHOMETRICS_ACCENT,
  PSYCHOMETRICS_BG,
  PSYCHOMETRICS_FONT_BODY,
  PSYCHOMETRICS_FONT_DISPLAY,
  PSYCHOMETRICS_TIP_CARD_BG,
  PSYCHOMETRICS_TIP_CARD_BORDER,
  psychometricsScrollContent,
} from '@features/psychometrics/psychometricsTheme';
import { spacing } from '@ui/theme/spacing';
import { showConfirmDialog } from '@utilities/alerts/confirmDialog';

const PARTIAL_REPORT_INCLUDES = [
  'A personalized summary of how you tend to show up in close relationships',
  'Honest, constructive feedback on what is working well for you',
  'Specific growth areas and practical next steps you can act on today',
] as const;

const ASSESSMENT_TIPS = [
  {
    icon: 'heart-outline' as const,
    title: 'What to expect',
    body: 'Some questions may feel repetitive, that\'s completely intentional! Repetition helps us build the most accurate picture of you possible',
  },
  {
    icon: 'cafe-outline' as const,
    title: 'Find a quiet moment',
    body: 'Give yourself ~10 uninterrupted minutes so you can reflect without rushing.',
  },
  {
    icon: 'refresh-outline' as const,
    title: 'Be yourself, not your best self',
    body: 'The assessments work best when you describe how you actually are — not how you wish you were.',
  },
] as const;

type Props = {
  navigation: {
    replace: (screen: InterviewStackRoute, params?: Record<string, unknown>) => void;
  };
  route: { params?: { userId?: string } };
};

export function InterviewCompleteScreen({ navigation, route }: Props) {
  const { user, signOut } = useAuth();
  const userId = route.params?.userId ?? user?.id ?? '';
  const isAlphaTester = isAmoraeaAdminConsoleEmail(user?.email);
  const [attempt, setAttempt] = useState<InterviewReportAttempt | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scoringReady = attempt?.pillar_scores != null;

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

  const refreshAttempt = useCallback(async () => {
    if (!userId) return null;
    const row = await refreshInterviewReportAttemptForPartialReport(userId);
    setAttempt(row);
    return row;
  }, [userId]);

  useEffect(() => {
    loadPsychometricsWebFontsOnce();
  }, []);

  useEffect(() => {
    const shouldKeepPolling = (row: InterviewReportAttempt | null) => !row || row.pillar_scores == null;

    void (async () => {
      const row = await refreshAttempt();
      if (shouldKeepPolling(row)) {
        pollRef.current = setInterval(() => {
          void refreshAttempt().then((next) => {
            if (!shouldKeepPolling(next) && pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          });
        }, 5000);
      }
    })();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [refreshAttempt]);

  function handleContinue() {
    if (!userId) return;
    navigation.replace('PsychometricAssessment', {
      userId,
      interviewAlreadyCompleted: true,
      legacyPsychometricsMode: true,
    });
  }

  if (!PSYCHOMETRICS_ENABLED) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogOut}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Log out"
      >
        <Ionicons name="log-out-outline" size={16} color="#5BA8E8" />
        <Text style={styles.logoutButtonText}>Log out</Text>
      </TouchableOpacity>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <FlameOrb state="idle" size={64} minimalGlow />
        </View>

        <Text style={styles.eyebrow}>Interview complete</Text>
        <Text style={styles.title}>Congratulations — you're almost there.</Text>

        <View style={styles.progressTracker}>
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotDone]}>
              <Ionicons name="checkmark" size={14} color="#05060d" />
            </View>
            <Text style={[styles.progressStepLabel, styles.progressStepLabelDone]}>AI interview</Text>
          </View>
          <View style={styles.progressLine} />
          <View style={styles.progressStep}>
            <View style={[styles.progressDot, styles.progressDotActive]} />
            <Text style={[styles.progressStepLabel, styles.progressStepLabelActive]}>Self assessments</Text>
          </View>
          <View style={styles.progressLineMuted} />
          <View style={styles.progressStep}>
            <View style={styles.progressDot} />
            <Text style={styles.progressStepLabel}>Full report</Text>
          </View>
        </View>

        
        <View style={styles.reportSection}>
          <DownloadPartialReportButton
            userId={userId}
            scoringReady={scoringReady}
            variant="secondary"
          />
        </View>

        <View style={styles.compatibilitySection}>
          <ValidationFlowOptInCard userId={userId} returnRoute="InterviewComplete" />
        </View>

        <View style={styles.nextStepSection}>
          <Text style={styles.sectionLabel}>What's next</Text>
          <Text style={styles.nextStepLead}>
            Self-assessments — about {PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES} minutes of
            research-backed questionnaires on personality, attachment, and how you relate to others.
          </Text>
        </View>

        <View style={styles.tipsSection}>
          <Text style={styles.sectionLabel}>Before you begin</Text>
          {ASSESSMENT_TIPS.map((tip) => (
            <View key={tip.title} style={styles.tipCard}>
              <Ionicons name={tip.icon} size={20} color={PSYCHOMETRICS_ACCENT} style={styles.tipIcon} />
              <View style={styles.tipTextWrap}>
                <Text style={styles.tipTitle}>{tip.title}</Text>
                <Text style={styles.tipBody}>{tip.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.totalRow}>
          <Ionicons name="time-outline" size={18} color={PSYCHOMETRICS_ACCENT} />
          <Text style={styles.totalTime}>
            Interview done · ~{PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES} min of assessments remaining
          </Text>
        </View>

        <Text style={styles.scienceNote}>
          Your data stays private and is used only to build your personal report and compatibility profile.
        </Text>

        <TouchableOpacity style={styles.cta} onPress={handleContinue} disabled={!userId}>
          <Text style={styles.ctaText}>
            Continue to self assessments (~{PRE_INTERVIEW_PSYCHOMETRICS_ESTIMATED_MINUTES} min)
          </Text>
        </TouchableOpacity>

        {isAlphaTester ? (
          <TouchableOpacity
            style={styles.adminLink}
            onPress={() => navigation.replace('Amoraea', { userId, openAdminPanel: true })}
          >
            <Text style={styles.adminLinkText}>Open admin panel</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: PSYCHOMETRICS_BG },
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
  logoutButtonText: {
    fontFamily: Platform.OS === 'web' ? 'Jost, sans-serif' : PSYCHOMETRICS_FONT_BODY,
    fontSize: 11,
    fontWeight: '400',
    letterSpacing: 1.5,
    color: '#5BA8E8',
    textTransform: 'uppercase',
  },
  content: {
    ...psychometricsScrollContent,
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: spacing.xl,
  },
  logoWrap: { alignItems: 'center', marginBottom: spacing.sm },
  eyebrow: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 13,
    fontWeight: '600',
    color: PSYCHOMETRICS_ACCENT,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  title: {
    fontFamily: PSYCHOMETRICS_FONT_DISPLAY,
    fontSize: 26,
    fontWeight: '600',
    color: '#F4F8FC',
    textAlign: 'center',
    lineHeight: 32,
    marginBottom: spacing.lg,
    maxWidth: 420,
  },
  progressTracker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.lg,
    paddingHorizontal: 8,
  },
  progressStep: {
    alignItems: 'center',
    gap: 6,
    minWidth: 72,
  },
  progressDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotDone: {
    borderColor: '#34d399',
    backgroundColor: '#34d399',
  },
  progressDotActive: {
    borderColor: PSYCHOMETRICS_ACCENT,
    backgroundColor: 'rgba(59,130,246,0.25)',
  },
  progressStepLabel: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 10,
    color: '#7A9ABE',
    textAlign: 'center',
    lineHeight: 14,
  },
  progressStepLabelDone: {
    color: '#34d399',
    fontWeight: '600',
  },
  progressStepLabelActive: {
    color: PSYCHOMETRICS_ACCENT,
    fontWeight: '600',
  },
  progressLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#34d399',
    marginHorizontal: 4,
    marginBottom: 18,
    maxWidth: 48,
  },
  progressLineMuted: {
    flex: 1,
    height: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 4,
    marginBottom: 18,
    maxWidth: 48,
  },
  reportSection: {
    width: '100%',
    maxWidth: 420,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  compatibilitySection: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.md,
    paddingHorizontal: 4,
  },
  nextStepSection: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.lg,
    gap: 10,
    paddingHorizontal: 4,
  },
  nextStepLead: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#E8F0F8',
  },
  nextStepBody: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: '#B8C9DC',
  },
  benefitsSection: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.lg,
    gap: 10,
    paddingHorizontal: 4,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  benefitIcon: {
    marginTop: 2,
    marginRight: 10,
  },
  benefitText: {
    flex: 1,
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    lineHeight: 21,
    color: '#C8D8EC',
  },
  sectionLabel: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 12,
    fontWeight: '600',
    color: '#7A9ABE',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  tipsSection: {
    width: '100%',
    maxWidth: 420,
    marginBottom: spacing.md,
    gap: 8,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: PSYCHOMETRICS_TIP_CARD_BORDER,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  tipIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  tipTextWrap: {
    flex: 1,
    gap: 4,
  },
  tipTitle: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: '#F4F8FC',
  },
  tipBody: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 13,
    lineHeight: 19,
    color: '#B8C9DC',
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.md,
    maxWidth: 420,
    paddingHorizontal: 8,
  },
  totalTime: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    fontWeight: '600',
    color: '#E8F0F8',
    textAlign: 'center',
    flexShrink: 1,
  },
  scienceNote: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: spacing.lg,
    maxWidth: 420,
    paddingHorizontal: 4,
  },
  cta: {
    backgroundColor: PSYCHOMETRICS_ACCENT,
    borderWidth: 1,
    borderColor: 'rgba(147, 197, 253, 0.55)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 22,
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...Platform.select({
      ios: {
        shadowColor: PSYCHOMETRICS_ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      web: {
        boxShadow: '0 4px 20px rgba(59, 130, 246, 0.45)',
      } as ViewStyle,
    }),
  },
  ctaText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  adminLink: { marginTop: spacing.lg },
  adminLinkText: { color: '#7A9ABE', fontSize: 13 },
});
