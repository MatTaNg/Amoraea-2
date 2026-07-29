import { useCallback, useEffect, useRef, useState } from 'react';
import { StackActions, useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@data/supabase/client';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';
import { navigateToDatingProfileOnboardingEntry } from '@/datingProfile/onboarding/navigateToDatingProfileOnboardingEntry';
import { profilesRepo } from '@/data/repos/profilesRepo';
import { areDatingProfileAssessmentsComplete } from '@/data/services/assessmentService';
import { POST_INTERVIEW_PROFILE_TIME_ESTIMATE } from '@features/onboarding/postInterviewProfileCompletion';
import {
  postInterviewLaunchQueryKeys,
  usePostInterviewProfileCtaQuery,
} from '@features/onboarding/postInterviewLaunchQueries';
import {
  invalidateEditProfileQueries,
  isEditProfileQueryCacheWarm,
  prefetchEditProfileQueries,
} from '@/screens/profile/editProfile/editProfileQueries';

type NavigationLike = {
  dispatch: (action: ReturnType<typeof StackActions.push>) => void;
  navigate: (name: string, params?: object) => void;
};

export function usePostInterviewProfileCta(userId: string, navigation: NavigationLike) {
  const queryClient = useQueryClient();
  const onboardingFlowOpenedRef = useRef(false);
  const [profileCtaBusy, setProfileCtaBusy] = useState(false);
  const { data, isPending } = usePostInterviewProfileCtaQuery(userId);

  const datingProfileFullyComplete = data?.datingProfileFullyComplete ?? false;
  const assessmentsComplete = data?.assessmentsComplete ?? false;
  const profileReadyForMatching = datingProfileFullyComplete && assessmentsComplete;

  useEffect(() => {
    if (!userId || !profileReadyForMatching) return;
    void prefetchEditProfileQueries(queryClient, userId);
  }, [profileReadyForMatching, queryClient, userId]);

  useFocusEffect(
    useCallback(() => {
      if (!onboardingFlowOpenedRef.current || !userId) {
        return undefined;
      }
      onboardingFlowOpenedRef.current = false;
      void queryClient.invalidateQueries({
        queryKey: postInterviewLaunchQueryKeys.profileCta(userId),
      });
      invalidateEditProfileQueries(queryClient, userId);
      return undefined;
    }, [queryClient, userId]),
  );

  const profileCtaLabel = profileReadyForMatching ? 'Edit your profile' : 'Complete your profile';
  const profileTimeEstimateLabel = profileReadyForMatching
    ? null
    : POST_INTERVIEW_PROFILE_TIME_ESTIMATE;

  const openProfileCta = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? userId;
    if (!uid) return;

    if (profileReadyForMatching) {
      if (!isEditProfileQueryCacheWarm(queryClient, uid)) {
        setProfileCtaBusy(true);
        try {
          await prefetchEditProfileQueries(queryClient, uid);
        } finally {
          setProfileCtaBusy(false);
        }
      }
      navigation.dispatch(StackActions.push('DatingProfileEdit', { userId: uid }));
      return;
    }

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
        queryClient.setQueryData(postInterviewLaunchQueryKeys.profileCta(userId), {
          datingProfileFullyComplete: profileOnboardingComplete,
          assessmentsComplete: profileAssessmentsComplete,
        });
      }
      if (goEdit) {
        if (!isEditProfileQueryCacheWarm(queryClient, uid)) {
          await prefetchEditProfileQueries(queryClient, uid);
        }
        navigation.dispatch(StackActions.push('DatingProfileEdit', { userId: uid }));
      } else {
        onboardingFlowOpenedRef.current = true;
        navigateToDatingProfileOnboardingEntry(navigation, uid);
      }
    } finally {
      setProfileCtaBusy(false);
    }
  }, [
    userId,
    navigation,
    datingProfileFullyComplete,
    assessmentsComplete,
    profileReadyForMatching,
    queryClient,
  ]);

  return {
    profileCtaLoaded: Boolean(userId) ? !isPending : true,
    profileCtaBusy,
    profileCtaLabel,
    profileTimeEstimateLabel,
    profileReadyForMatching,
    openProfileCta,
  };
}
