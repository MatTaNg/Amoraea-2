import { profilesRepo } from '@/data/repos/profilesRepo';
import type { DatingProfileStackParamList } from '@app/navigation/DatingProfileOnboardingNavigator';
import {
  FIRST_DATING_PROFILE_ASSESSMENT_ID,
  getCompletedAssessments,
  getFirstIncompleteAssessment,
  isActiveAssessmentId,
  isDatingProfileTypologyBatteryComplete,
  markAssessmentsStarted,
  resolveActiveAssessmentId,
  syncProfileIfTypologyBatteryComplete,
  type AssessmentId,
} from '@/data/services/assessmentService';
import { modalOnboardingService } from '@/datingProfile/screens/onboarding/modals/services/modalOnboardingService';

export type DatingProfileOnboardingRoute = {
  screen: keyof DatingProfileStackParamList;
  params?: DatingProfileStackParamList[keyof DatingProfileStackParamList];
  /** Call before navigating when auto-starting the first instrument. */
  markAssessmentsStarted?: AssessmentId;
};

/** Show typology overview once before the first profile instrument when the user has not started any instrument yet. */
export function shouldShowRelationshipTypologyIntro(
  profile: {
    assessmentsStarted?: boolean | null;
    currentAssessment?: string | null;
  } | null | undefined,
  completedInstrumentCount: number,
): boolean {
  if (profile?.assessmentsStarted) return false;
  if (profile?.currentAssessment) return false;
  if (completedInstrumentCount > 0) return false;
  return true;
}

function assessmentResumeRoute(
  currentAssessment: string | null | undefined,
  completedList: string[] = [],
): DatingProfileOnboardingRoute {
  const instrument = resolveActiveAssessmentId(currentAssessment, completedList);
  if (instrument === 'CONFLICT-30') {
    return { screen: 'DatingConflictStyle', params: {} };
  }
  return {
    screen: 'DatingInstrument',
    params: { instrument },
  };
}

/**
 * First screen inside `DatingProfileOnboarding` after login / CTA.
 * Psychometric instruments → profile modals → profile builder.
 */
export async function resolveDatingProfileOnboardingEntryRoute(
  userId: string,
): Promise<DatingProfileOnboardingRoute> {
  const profileResult = await profilesRepo.getProfile(userId);
  const profile = profileResult.success ? profileResult.data : null;

  if (profile?.onboardingCompleted) {
    return { screen: 'DatingProfileBuilder' };
  }

  const completed = await getCompletedAssessments(userId);
  const completedList = completed.success ? completed.data : [];
  const batteryComplete = isDatingProfileTypologyBatteryComplete(completedList);

  if (!profile?.assessmentsCompleted && batteryComplete) {
    await syncProfileIfTypologyBatteryComplete(userId, completedList, profile);
  } else if (!profile?.assessmentsCompleted) {
    if (shouldShowRelationshipTypologyIntro(profile, completedList.length)) {
      return { screen: 'DatingTypologyIntro' };
    }

    if (profile?.assessmentsStarted || profile?.currentAssessment) {
      return assessmentResumeRoute(profile.currentAssessment ?? null, completedList);
    }

    const next =
      completedList.length > 0 ? getFirstIncompleteAssessment(completedList) : null;
    if (next) {
      if (next === 'CONFLICT-30') {
        return { screen: 'DatingConflictStyle', params: {} };
      }
      return { screen: 'DatingInstrument', params: { instrument: next } };
    }

    return {
      screen: 'DatingInstrument',
      params: { instrument: FIRST_DATING_PROFILE_ASSESSMENT_ID },
      markAssessmentsStarted: FIRST_DATING_PROFILE_ASSESSMENT_ID,
    };
  }

  const progress = await modalOnboardingService.getProgress(userId);
  const modalStep = progress.success ? progress.data?.currentStep : undefined;
  if (modalStep && modalStep !== 'complete') {
    return { screen: 'DatingModals' };
  }

  return { screen: 'DatingProfileSetupTransition' };
}

/** Where to send the user immediately after the last psychometric instrument finishes. */
export async function resolvePostAssessmentsRoute(
  userId: string,
): Promise<DatingProfileOnboardingRoute> {
  const profileResult = await profilesRepo.getProfile(userId);
  const profile = profileResult.success ? profileResult.data : null;
  if (profile?.onboardingCompleted) {
    return { screen: 'DatingProfileBuilder' };
  }

  const completed = await getCompletedAssessments(userId);
  const completedList = completed.success ? completed.data : [];
  const nextIncomplete = getFirstIncompleteAssessment(
    completedList.filter((id): id is AssessmentId => isActiveAssessmentId(id)),
  );
  if (nextIncomplete) {
    if (nextIncomplete === 'CONFLICT-30') {
      return { screen: 'DatingConflictStyle', params: {} };
    }
    return { screen: 'DatingInstrument', params: { instrument: nextIncomplete } };
  }

  await syncProfileIfTypologyBatteryComplete(userId, completedList, profile);

  const progress = await modalOnboardingService.getProgress(userId);
  const modalStep = progress.success ? progress.data?.currentStep : undefined;
  if (modalStep && modalStep !== 'complete') {
    return { screen: 'DatingModals' };
  }

  return { screen: 'DatingModals' };
}

export async function applyDatingProfileOnboardingRoute(
  userId: string,
  route: DatingProfileOnboardingRoute,
  replace: (screen: keyof DatingProfileStackParamList, params?: object) => void,
): Promise<void> {
  if (route.markAssessmentsStarted) {
    const started = await markAssessmentsStarted(userId, route.markAssessmentsStarted);
    if (!started.success) {
      console.error(started.error);
    }
  }
  replace(route.screen, route.params as object | undefined);
}
