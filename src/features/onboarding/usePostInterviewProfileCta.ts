import { useCallback, useState } from 'react';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { supabase } from '@data/supabase/client';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';
import { navigateToDatingProfileOnboardingEntry } from '@/datingProfile/onboarding/navigateToDatingProfileOnboardingEntry';
import { profilesRepo } from '@/data/repos/profilesRepo';
import { areDatingProfileAssessmentsComplete } from '@/data/services/assessmentService';
import { POST_INTERVIEW_PROFILE_TIME_ESTIMATE } from '@features/onboarding/postInterviewProfileCompletion';

type NavigationLike = {
  dispatch: (action: ReturnType<typeof StackActions.push>) => void;
  navigate: (name: string, params?: object) => void;
};

export function usePostInterviewProfileCta(userId: string, navigation: NavigationLike) {
  const [datingProfileFullyComplete, setDatingProfileFullyComplete] = useState(false);
  const [assessmentsComplete, setAssessmentsComplete] = useState(false);
  const [profileCtaLoaded, setProfileCtaLoaded] = useState(false);
  const [profileCtaBusy, setProfileCtaBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void (async () => {
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id ?? userId;
        if (!uid) {
          if (!cancelled) setProfileCtaLoaded(true);
          return;
        }
        try {
          const [progress, profileResult, assessmentsDone] = await Promise.all([
            modalOnboardingService.getProgress(uid),
            profilesRepo.getProfile(uid),
            areDatingProfileAssessmentsComplete(uid),
          ]);
          if (cancelled) return;
          if (profileResult.success && profileResult.data) {
            const profile = profileResult.data as Record<string, unknown>;
            setDatingProfileFullyComplete(profile.onboardingCompleted === true);
            setAssessmentsComplete(assessmentsDone);
          } else {
            setDatingProfileFullyComplete(false);
            setAssessmentsComplete(assessmentsDone);
          }
          void progress;
        } catch (e) {
          if (__DEV__) {
            console.warn('[usePostInterviewProfileCta] profile progress refresh', e);
          }
        } finally {
          if (!cancelled) setProfileCtaLoaded(true);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [userId]),
  );

  const profileReadyForMatching = datingProfileFullyComplete && assessmentsComplete;
  const profileCtaLabel = profileReadyForMatching ? 'Edit your profile' : 'Complete your profile';
  const profileTimeEstimateLabel = profileReadyForMatching
    ? null
    : POST_INTERVIEW_PROFILE_TIME_ESTIMATE;

  const openProfileCta = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? userId;
    if (!uid) return;
    setProfileCtaBusy(true);
    try {
      const progress = await modalOnboardingService.getProgress(uid);
      const profileResult = await profilesRepo.getProfile(uid);
      const profileAssessmentsComplete = await areDatingProfileAssessmentsComplete(uid);
      let goEdit = datingProfileFullyComplete && assessmentsComplete;
      void progress;
      if (profileResult.success && profileResult.data) {
        const profile = profileResult.data as Record<string, unknown>;
        const profileOnboardingComplete = profile.onboardingCompleted === true;
        goEdit = profileOnboardingComplete && profileAssessmentsComplete;
        setDatingProfileFullyComplete(profileOnboardingComplete);
        setAssessmentsComplete(profileAssessmentsComplete);
      }
      if (goEdit) {
        navigation.dispatch(StackActions.push('DatingProfileEdit', { userId: uid }));
      } else {
        navigateToDatingProfileOnboardingEntry(navigation, uid);
      }
    } finally {
      setProfileCtaBusy(false);
    }
  }, [userId, navigation, datingProfileFullyComplete, assessmentsComplete]);

  return {
    profileCtaLoaded,
    profileCtaBusy,
    profileCtaLabel,
    profileTimeEstimateLabel,
    profileReadyForMatching,
    openProfileCta,
  };
}
