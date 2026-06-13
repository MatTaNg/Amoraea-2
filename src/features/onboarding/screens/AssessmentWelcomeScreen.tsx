import React, { useEffect, useState } from 'react';
import { ActivityIndicator, SafeAreaView, StyleSheet } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/shared/hooks/AuthProvider';
import { MarketResearchModal } from '@features/onboarding/MarketResearchModal';
import { WelcomeModal } from '@features/psychometrics/WelcomeModal';
import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';
import { storedInterviewHasResumableScenarioProgress } from '@utilities/interviewResumeCursor';
import { loadInterviewFromStorage } from '@utilities/storage/InterviewStorage';
import { PSYCHOMETRICS_ACCENT, PSYCHOMETRICS_BG } from '@features/psychometrics/psychometricsTheme';

type Props = {
  navigation: {
    replace: (screen: InterviewStackRoute, params?: Record<string, unknown>) => void;
  };
  route: { params?: { userId?: string; needsMarketResearch?: boolean } };
};

export function AssessmentWelcomeScreen({ navigation, route }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
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
      const saved = await loadInterviewFromStorage(userId);
      if (cancelled) return;
      if (saved != null && storedInterviewHasResumableScenarioProgress(saved)) {
        navigation.replace('Aria', { userId });
        return;
      }
      setCheckingResume(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation, userId]);

  function handleContinue() {
    if (!userId || needsMarketResearch) return;
    navigation.replace('Aria', { userId });
  }

  function handleMarketResearchComplete() {
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
    <>
      <WelcomeModal
        visible
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
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: PSYCHOMETRICS_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
