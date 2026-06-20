import { standardApplicantPostInterviewDestination } from '@features/onboarding/postInterviewLaunchMode';

type StackNavigationLike = {
  getParent: () => StackNavigationLike | undefined;
  canGoBack?: () => boolean;
  goBack: () => void;
  navigate?: (name: string, params?: object) => void;
};

/**
 * Leaves the nested `DatingProfileOnboarding` stack and returns to the parent
 * interview post-interview screen (Passed, PostInterview, etc.).
 */
export function exitDatingProfileOnboardingToPostInterview(
  navigation: StackNavigationLike,
  userId?: string,
): void {
  const nestedNav = navigation.getParent();
  const interviewNav = nestedNav?.getParent?.() as StackNavigationLike | undefined;

  if (interviewNav?.canGoBack?.()) {
    interviewNav.goBack();
    return;
  }
  if (nestedNav?.canGoBack?.()) {
    nestedNav.goBack();
    return;
  }
  if (!userId) return;

  const destination = standardApplicantPostInterviewDestination();

  if (nestedNav?.navigate) {
    nestedNav.navigate(destination, { userId });
    return;
  }
  navigation.navigate?.(destination, { userId });
}
