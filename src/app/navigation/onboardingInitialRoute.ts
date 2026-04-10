/**
 * Pure onboarding stack initial route for gate-based flow (no AsyncStorage / React).
 * @see App.tsx GatesOnboardingNavigator
 */

/** When true, interview-first alpha paths apply (see App.tsx). */
export const ALPHA_MODE = true;

export type OnboardingInitialRouteProfile = {
  onboardingStage?: string;
  applicationStatus?: string;
  gate1Score?: unknown;
};

export type GetOnboardingInitialRouteOptions = {
  /** User has completed "Before we begin" locally — skip Interview Framing when applicable. */
  hasAcknowledgedInterviewFraming: boolean;
  /** Defaults to {@link ALPHA_MODE}. Tests can override. */
  alphaMode?: boolean;
};

/**
 * Returns React Navigation route name for the gates onboarding stack.
 */
export function getOnboardingInitialRoute(
  profile: OnboardingInitialRouteProfile,
  options: GetOnboardingInitialRouteOptions
): string {
  const { hasAcknowledgedInterviewFraming, alphaMode = ALPHA_MODE } = options;
  const stage = profile.onboardingStage ?? 'interview';
  let route: string;
  if (stage === 'basic_info') {
    if (alphaMode) route = 'InterviewFraming';
    else if (profile.gate1Score && profile.applicationStatus === 'approved') route = 'Stage1BasicInfo';
    else route = 'InterviewFraming';
  } else if (stage === 'interview') {
    if (!alphaMode && profile.applicationStatus === 'approved') route = 'Stage1BasicInfo';
    else if (!alphaMode && profile.gate1Score) route = 'PostInterview';
    else route = 'InterviewFraming';
  } else if (stage === 'psychometrics') {
    if (profile.applicationStatus === 'approved') route = 'Gate2Reentry';
    else if (profile.applicationStatus === 'under_review') route = 'UnderReview';
    else route = 'PostInterview';
  } else if (stage === 'compatibility') route = 'Stage4Compatibility';
  else if (stage === 'complete') route = 'Stage1BasicInfo';
  else route = 'InterviewFraming';

  if (route === 'InterviewFraming' && hasAcknowledgedInterviewFraming) {
    if (stage === 'basic_info') return 'Stage1BasicInfo';
    return 'OnboardingInterview';
  }
  return route;
}
