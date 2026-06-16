import React, { useCallback, useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { FlameOrb } from '@app/screens/FlameOrb';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { isAmoraeaAdminConsoleEmail } from '@/constants/adminConsole';
import { finalizeGateResultAfterPsychometrics } from '@features/onboarding/finalizeGateResultAfterPsychometrics';
import { PSYCHOMETRICS_ENABLED } from '@features/psychometrics/interviewCompletionStatus';
import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';
import {
  loadPsychometricsWebFontsOnce,
  PSYCHOMETRICS_ACCENT,
  PSYCHOMETRICS_BG,
  PSYCHOMETRICS_FONT_BODY,
  PSYCHOMETRICS_FONT_DISPLAY,
  psychometricsScrollContent,
} from '@features/psychometrics/psychometricsTheme';
import { spacing } from '@ui/theme/spacing';
import { PreparingResultsView } from '@app/screens/PreparingResultsView';
import {
  RELATIONSHIP_VALIDATION_TRACK,
} from '@features/relationshipValidation/constants';
import { fetchUserValidationTrack } from '@features/relationshipValidation/relationshipValidationRepo';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  navigation: {
    replace: (screen: InterviewStackRoute, params?: { userId: string }) => void;
  };
  route: {
    params?: {
      userId?: string;
    };
  };
};

export function PsychometricsCompleteScreen({ navigation, route }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const userId = route.params?.userId ?? '';
  const isAdminUser = isAmoraeaAdminConsoleEmail(user?.email);
  const [phase, setPhase] = useState<'finalizing' | 'failed' | 'validation_redirect'>('finalizing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const advanceToFullReport = useCallback(async () => {
    if (!userId) return;
    const track = await fetchUserValidationTrack(userId);
    if (track === RELATIONSHIP_VALIDATION_TRACK) {
      setPhase('validation_redirect');
      await queryClient.invalidateQueries({ queryKey: ['validationTrack', userId] });
      return;
    }
    navigation.replace('PostInterview', { userId });
  }, [navigation, queryClient, userId]);

  useEffect(() => {
    loadPsychometricsWebFontsOnce();
  }, []);

  useEffect(() => {
    if (!PSYCHOMETRICS_ENABLED || !userId) return;
    let cancelled = false;
    void (async () => {
      const result = await finalizeGateResultAfterPsychometrics(userId);
      if (cancelled) return;
      if (result.ok) {
        advanceToFullReport();
        return;
      }
      setErrorMessage(result.message ?? 'Finalization did not complete.');
      setPhase('failed');
    })();
    return () => {
      cancelled = true;
    };
  }, [advanceToFullReport, userId]);

  if (phase === 'validation_redirect') {
    return <PreparingResultsView />;
  }

  if (!PSYCHOMETRICS_ENABLED) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <TouchableOpacity style={styles.cta} onPress={advanceToFullReport}>
            <Text style={styles.ctaText}>Continue</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <FlameOrb state="idle" size={72} minimalGlow />
        </View>

        <Text style={styles.eyebrow}>Assessment Complete</Text>
        <Text style={styles.title}>You've finished everything.</Text>

        {phase === 'finalizing' ? (
          <View style={styles.finalizingBlock}>
            <ActivityIndicator color={PSYCHOMETRICS_ACCENT} />
            <Text style={styles.finalizingText}>We're preparing your full report now.</Text>
          </View>
        ) : (
          <>
            <Text style={styles.lead}>
              {errorMessage ?? 'We could not finalize your gate result automatically.'}
            </Text>
            <TouchableOpacity style={styles.cta} onPress={advanceToFullReport}>
              <Text style={styles.ctaText}>View My Results</Text>
            </TouchableOpacity>
          </>
        )}

        {isAdminUser ? (
          <TouchableOpacity
            style={styles.adminLink}
            onPress={() => navigation.replace('Aria', { userId, openAdminPanel: true })}
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
  content: {
    ...psychometricsScrollContent,
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: spacing.xl,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logoWrap: { alignItems: 'center', marginBottom: spacing.md },
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
    fontSize: 28,
    fontWeight: '600',
    color: '#F4F8FC',
    textAlign: 'center',
    lineHeight: 34,
    marginBottom: spacing.lg,
  },
  lead: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    color: '#B8C9DC',
    textAlign: 'center',
    lineHeight: 23,
    marginBottom: spacing.lg,
  },
  finalizingBlock: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  finalizingText: {
    fontFamily: PSYCHOMETRICS_FONT_BODY,
    fontSize: 15,
    color: '#B8C9DC',
    textAlign: 'center',
  },
  cta: {
    marginTop: 8,
    backgroundColor: 'rgba(59,130,246,0.35)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.5)',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 22,
  },
  ctaText: { color: '#F4F8FC', fontSize: 15, fontWeight: '600' },
  adminLink: { marginTop: spacing.lg },
  adminLinkText: { color: '#7A9ABE', fontSize: 13 },
});
