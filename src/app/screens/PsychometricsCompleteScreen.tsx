import React, { useEffect, useState } from 'react';
import { finalizeGateResultAfterPsychometrics } from '@features/onboarding/finalizeGateResultAfterPsychometrics';
import { PSYCHOMETRICS_ENABLED } from '@features/psychometrics/interviewCompletionStatus';
import { standardApplicantPostInterviewDestination } from '@features/onboarding/postInterviewLaunchMode';
import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';
import { PreparingResultsView } from '@app/screens/PreparingResultsView';
import { fetchValidationShellRouting } from '@features/relationshipValidation/relationshipValidationRepo';
import { shouldUseRelationshipValidationNavigator } from '@features/relationshipValidation/validationShellRouting';
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
  const queryClient = useQueryClient();
  const userId = route.params?.userId ?? '';
  const [validationRedirect, setValidationRedirect] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const routing = await fetchValidationShellRouting(userId);
      if (cancelled) return;
      if (shouldUseRelationshipValidationNavigator(routing)) {
        setValidationRedirect(true);
        await queryClient.invalidateQueries({ queryKey: ['validationShellRouting', userId] });
        await queryClient.invalidateQueries({ queryKey: ['validationTrack', userId] });
        return;
      }
      navigation.replace(standardApplicantPostInterviewDestination(), { userId });
      if (PSYCHOMETRICS_ENABLED) {
        void finalizeGateResultAfterPsychometrics(userId);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigation, queryClient, userId]);

  if (validationRedirect) {
    return <PreparingResultsView />;
  }

  return null;
}
