import { useQuery } from '@tanstack/react-query';
import { supabase } from '@data/supabase/client';
import { profilesRepo } from '@/data/repos/profilesRepo';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';
import { areDatingProfileAssessmentsComplete } from '@/data/services/assessmentService';
import {
  USER_INTERVIEW_ROUTING_TABLE,
  USER_REFERRAL_NOTICE_SELECT,
} from '@data/supabase/userInterviewRoutingSelect';
import {
  fetchReferralDiscountStatus,
  type ReferralDiscountStatus,
} from '@features/referrals/referralInterview';
import { fetchLaunchWaitlistPassedCount } from '@features/onboarding/fetchLaunchWaitlistPassedCount';
import { fetchLaunchWaitlistScoreAverages } from '@features/onboarding/fetchLaunchWaitlistScoreAverages';
import { loadInterviewReportAttempt } from '@features/onboarding/loadInterviewReportAttempt';
import { resolveFinalModifiedScoreForDisplay } from '@features/onboarding/launchWaitlistScorePresentation';

/** Keep congrats-page reads warm for the session; avoid refetch on every navigation focus. */
export const POST_INTERVIEW_LAUNCH_QUERY_STALE_MS = 30 * 60 * 1000;

const postInterviewLaunchQueryOptions = {
  staleTime: POST_INTERVIEW_LAUNCH_QUERY_STALE_MS,
  gcTime: 60 * 60 * 1000,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export const postInterviewLaunchQueryKeys = {
  all: ['post-interview-launch'] as const,
  passedCount: () => [...postInterviewLaunchQueryKeys.all, 'passed-count'] as const,
  scoreSummary: (userId: string) =>
    [...postInterviewLaunchQueryKeys.all, 'score-summary', userId] as const,
  referralState: (userId: string) =>
    [...postInterviewLaunchQueryKeys.all, 'referral-state', userId] as const,
  profileCta: (userId: string) =>
    [...postInterviewLaunchQueryKeys.all, 'profile-cta', userId] as const,
};

export function useLaunchWaitlistPassedCountQuery() {
  return useQuery({
    queryKey: postInterviewLaunchQueryKeys.passedCount(),
    queryFn: fetchLaunchWaitlistPassedCount,
    ...postInterviewLaunchQueryOptions,
  });
}

export type LaunchWaitlistScoreSummary = {
  finalModifiedScore: number | null;
  cohortAverageScore: number | null;
};

export async function fetchLaunchWaitlistScoreSummary(
  userId: string,
): Promise<LaunchWaitlistScoreSummary> {
  const [attemptResult, averagesResult] = await Promise.allSettled([
    loadInterviewReportAttempt(userId),
    fetchLaunchWaitlistScoreAverages(),
  ]);

  if (attemptResult.status === 'rejected' || averagesResult.status === 'rejected') {
    if (__DEV__) {
      console.warn('[PostInterviewLaunch] score summary refresh', {
        attempt: attemptResult.status === 'rejected' ? attemptResult.reason : null,
        averages: averagesResult.status === 'rejected' ? averagesResult.reason : null,
      });
    }
  }

  return {
    finalModifiedScore:
      attemptResult.status === 'fulfilled'
        ? resolveFinalModifiedScoreForDisplay(attemptResult.value)
        : null,
    cohortAverageScore:
      averagesResult.status === 'fulfilled'
        ? averagesResult.value.cohortAverageFinalScore
        : null,
  };
}

export function useLaunchWaitlistScoreSummaryQuery(userId: string) {
  return useQuery({
    queryKey: postInterviewLaunchQueryKeys.scoreSummary(userId),
    queryFn: () => fetchLaunchWaitlistScoreSummary(userId),
    enabled: Boolean(userId),
    ...postInterviewLaunchQueryOptions,
  });
}

export type PostInterviewReferralState = {
  referralStatus: ReferralDiscountStatus | null;
  referralNotice: string | null;
};

export async function fetchPostInterviewReferralState(
  userId: string,
): Promise<PostInterviewReferralState> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? userId;
  if (!uid) {
    return { referralStatus: null, referralNotice: null };
  }

  const [status, userRow] = await Promise.all([
    fetchReferralDiscountStatus(uid),
    supabase
      .from(USER_INTERVIEW_ROUTING_TABLE)
      .select(USER_REFERRAL_NOTICE_SELECT)
      .eq('id', uid)
      .maybeSingle(),
  ]);

  return {
    referralStatus: status,
    referralNotice: userRow.data?.referral_notice_pending ?? null,
  };
}

export function usePostInterviewReferralStateQuery(userId: string) {
  return useQuery({
    queryKey: postInterviewLaunchQueryKeys.referralState(userId),
    queryFn: () => fetchPostInterviewReferralState(userId),
    enabled: Boolean(userId),
    ...postInterviewLaunchQueryOptions,
  });
}

export type PostInterviewProfileCtaState = {
  datingProfileFullyComplete: boolean;
  assessmentsComplete: boolean;
};

export async function fetchPostInterviewProfileCtaState(
  userId: string,
): Promise<PostInterviewProfileCtaState> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id ?? userId;
  if (!uid) {
    return { datingProfileFullyComplete: false, assessmentsComplete: false };
  }

  try {
    const [progress, profileResult, assessmentsDone] = await Promise.all([
      modalOnboardingService.getProgress(uid),
      profilesRepo.getProfile(uid),
      areDatingProfileAssessmentsComplete(uid),
    ]);
    void progress;

    if (profileResult.success && profileResult.data) {
      const profile = profileResult.data as Record<string, unknown>;
      return {
        datingProfileFullyComplete: profile.onboardingCompleted === true,
        assessmentsComplete: assessmentsDone,
      };
    }

    return { datingProfileFullyComplete: false, assessmentsComplete: assessmentsDone };
  } catch (e) {
    if (__DEV__) {
      console.warn('[usePostInterviewProfileCta] profile progress refresh', e);
    }
    return { datingProfileFullyComplete: false, assessmentsComplete: false };
  }
}

export function usePostInterviewProfileCtaQuery(userId: string) {
  return useQuery({
    queryKey: postInterviewLaunchQueryKeys.profileCta(userId),
    queryFn: () => fetchPostInterviewProfileCtaState(userId),
    enabled: Boolean(userId),
    ...postInterviewLaunchQueryOptions,
  });
}
