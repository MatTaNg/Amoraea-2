import { useEffect } from 'react';

import type { InterviewStackRoute } from '@features/psychometrics/resolveInitialInterviewRoute';
import type { StandardPostInterviewStackRoute } from '@utilities/postInterviewProcessingGate';

/** Temporary: hide pass/fail/pending post-interview screens; show launch waitlist instead. */
export const POST_INTERVIEW_LAUNCH_WAITLIST_MODE = true;

export const LAUNCH_WAITLIST_USER_GOAL = 500;

export const LAUNCH_WAITLIST_VALUE_PROPS = [
  'Scientifically backed compatibility matching',
  "Know exactly who you're the best fit for before our exclusive events",
  'An exclusive community of people who have done the work',
] as const;

const LEGACY_POST_INTERVIEW_ROUTES = new Set<string>([
  'PostInterview',
  'PostInterviewProcessing',
  'PostInterviewPassed',
  'PostInterviewFailed',
]);

export function isLaunchWaitlistPostInterviewModeEnabled(): boolean {
  return POST_INTERVIEW_LAUNCH_WAITLIST_MODE;
}

export function standardApplicantPostInterviewDestination(): 'PostInterviewLaunch' | 'PostInterview' {
  return POST_INTERVIEW_LAUNCH_WAITLIST_MODE ? 'PostInterviewLaunch' : 'PostInterview';
}

export function mapPostInterviewStackRouteForLaunchMode(
  route: StandardPostInterviewStackRoute,
): StandardPostInterviewStackRoute | 'PostInterviewLaunch' {
  if (!POST_INTERVIEW_LAUNCH_WAITLIST_MODE) return route;
  if (LEGACY_POST_INTERVIEW_ROUTES.has(route)) {
    return 'PostInterviewLaunch';
  }
  return route;
}

export function mapInterviewStackRouteForLaunchMode(route: InterviewStackRoute): InterviewStackRoute {
  if (!POST_INTERVIEW_LAUNCH_WAITLIST_MODE) return route;
  if (LEGACY_POST_INTERVIEW_ROUTES.has(route)) {
    return 'PostInterviewLaunch';
  }
  return route;
}

/** Redirect legacy pass/fail/pending screens to the launch waitlist screen when mode is on. */
export function useRedirectPostInterviewLaunchWhenEnabled(
  navigation: { replace: (name: 'PostInterviewLaunch', params: { userId: string }) => void },
  userId: string,
): boolean {
  useEffect(() => {
    if (!POST_INTERVIEW_LAUNCH_WAITLIST_MODE || !userId) return;
    navigation.replace('PostInterviewLaunch', { userId });
  }, [navigation, userId]);
  return POST_INTERVIEW_LAUNCH_WAITLIST_MODE;
}
