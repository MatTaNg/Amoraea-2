import type { InterviewAttemptRevealFields } from '@utilities/postInterviewProcessingGate';
import { resolveStandardPostInterviewStackRoute } from '@utilities/postInterviewProcessingGate';

import type { InitialInterviewRouteResult, InterviewStackRoute } from './resolveInitialInterviewRoute';

export function shouldFetchPostInterviewDeferralSnapshot(
  initialRoute: Pick<InitialInterviewRouteResult, 'screen'> | undefined | null,
  profileShowsStandardInterviewComplete: boolean,
): boolean {
  // Legacy users still owe pre-interview psychometrics — do not treat them as post-interview ready.
  if (initialRoute?.screen === 'PsychometricAssessment') {
    return false;
  }

  return (
    initialRoute?.screen === 'PostInterviewProcessing' ||
    initialRoute?.screen === 'PostInterviewPassed' ||
    initialRoute?.screen === 'PostInterviewFailed' ||
    initialRoute?.screen === 'PostInterview' ||
    profileShowsStandardInterviewComplete
  );
}

export type ResolvedInterviewStackBootstrap = {
  initialRouteName: InterviewStackRoute;
  interviewAlreadyCompleted: boolean;
  legacyPsychometricsMode: boolean;
  needsMarketResearch: boolean;
};

/**
 * Maps server routing + profile/deferral hints to the interview stack's initial screen.
 * PsychometricAssessment (including legacy backfill) must not be overridden by post-interview deferral.
 */
export function resolveInterviewStackBootstrap(input: {
  initialRoute: InitialInterviewRouteResult | undefined;
  profileShowsStandardInterviewComplete: boolean;
  deferralSnapshot: InterviewAttemptRevealFields | null | undefined;
  isAdminEmail: boolean;
  lockedPostInterviewRoute: InterviewStackRoute | null;
}): ResolvedInterviewStackBootstrap {
  const {
    initialRoute,
    profileShowsStandardInterviewComplete,
    deferralSnapshot,
    isAdminEmail,
    lockedPostInterviewRoute,
  } = input;

  let initialRouteName: InterviewStackRoute = initialRoute?.screen ?? 'Aria';
  let interviewAlreadyCompleted =
    initialRoute?.interviewAlreadyCompleted === true || profileShowsStandardInterviewComplete;
  let legacyPsychometricsMode = initialRoute?.legacyPsychometricsMode === true;

  if (profileShowsStandardInterviewComplete && initialRouteName === 'Aria') {
    initialRouteName = 'PostInterview';
    interviewAlreadyCompleted = true;
    legacyPsychometricsMode = false;
  }

  const serverResolvedPostInterviewScreen = initialRoute?.screen;
  if (
    serverResolvedPostInterviewScreen === 'PostInterviewPassed' ||
    serverResolvedPostInterviewScreen === 'PostInterviewFailed'
  ) {
    initialRouteName = serverResolvedPostInterviewScreen;
  } else if (
    initialRouteName !== 'PsychometricAssessment' &&
    shouldFetchPostInterviewDeferralSnapshot(initialRoute, profileShowsStandardInterviewComplete) &&
    deferralSnapshot != null &&
    !isAdminEmail
  ) {
    initialRouteName = resolveStandardPostInterviewStackRoute(deferralSnapshot);
  }

  if (lockedPostInterviewRoute === 'PostInterviewPassed' || lockedPostInterviewRoute === 'PostInterviewFailed') {
    initialRouteName = lockedPostInterviewRoute;
  }

  return {
    initialRouteName,
    interviewAlreadyCompleted,
    legacyPsychometricsMode,
    needsMarketResearch: initialRoute?.needsMarketResearch === true,
  };
}
