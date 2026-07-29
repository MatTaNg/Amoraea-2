import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { MarketResearchModal } from '@features/onboarding/MarketResearchModal';
import { useMarketResearchCompletion } from '@features/referrals/MarketResearchCompletionContext';
import { WelcomeModal } from '@features/psychometrics/WelcomeModal';
import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';
import {
  fetchUserLoginRoutingRow,
  resolveInterviewCompletedForUser,
} from '@features/psychometrics/interviewCompletionStatus';
import { storedInterviewHasResumableScenarioProgress } from '@utilities/interviewResumeCursor';
import { clearInterviewFromStorage, loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { PSYCHOMETRICS_ACCENT, PSYCHOMETRICS_BG } from '@features/psychometrics/psychometricsTheme';
import { markUserEnteredInterviewFlow } from '@utilities/interviewEntryLock';

type Props = {
  navigation: {
    replace: (screen: InterviewStackRoute, params?: Record<string, unknown>) => void;
  };
  route: { params?: { userId?: string; needsMarketResearch?: boolean } };
};

export function AssessmentWelcomeScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { notifyMarketResearchComplete } = useMarketResearchCompletion();
  const userId = route.params?.userId ?? user?.id ?? '';
  const [needsMarketResearch, setNeedsMarketResearch] = useState(
    () => route.params?.needsMarketResearch === true,
  );
  const [checkingResume, setCheckingResume] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCheckingResume(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const routingRow = await fetchUserLoginRoutingRow(userId);
      const interviewCompleted = await resolveInterviewCompletedForUser(userId, routingRow);
      if (cancelled) return;
      if (interviewCompleted) {
        await clearInterviewFromStorage(userId);
        void queryClient.invalidateQueries({ queryKey: ['initialInterviewRoute', userId] });
        void queryClient.invalidateQueries({ queryKey: ['profile', userId] });
        navigation.replace('InterviewComplete', { userId });
        return;
      }

      const saved = await loadInterviewFromStorage(userId);
      if (cancelled) return;
      if (saved != null && storedInterviewHasResumableScenarioProgress(saved)) {
        navigation.replace('Amoraea', { userId });
        return;
      }
      setCheckingResume(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation, queryClient, userId]);

  function handleContinue() {
    if (!userId || needsMarketResearch) return;
    markUserEnteredInterviewFlow(userId);
    queryClient.setQueryData(['interviewEntryLock', userId], true);
    navigation.replace('Amoraea', { userId });
  }

  function handleMarketResearchComplete() {
    notifyMarketResearchComplete();
    setNeedsMarketResearch(false);
    void queryClient.invalidateQueries({ queryKey: ['initialInterviewRoute', userId] });
  }

  if (checkingResume) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color={PSYCHOMETRICS_ACCENT} />
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.screen}>
      <WelcomeModal
        visible={!needsMarketResearch}
        variant="interviewFirst"
        continueLabel="Continue"
        continueDisabled={needsMarketResearch}
        onContinue={handleContinue}
      />
      {needsMarketResearch && userId ? (
        <MarketResearchModal
          visible
          userId={userId}
          onComplete={handleMarketResearchComplete}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
  },
  loading: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
