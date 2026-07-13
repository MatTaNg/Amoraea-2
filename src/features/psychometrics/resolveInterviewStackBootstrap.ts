import type { InterviewAttemptRevealFields } from '@utilities/postInterviewProcessingGate';
import { resolveStandardPostInterviewStackRoute } from '@utilities/postInterviewProcessingGate';

import { PSYCHOMETRICS_ENABLED } from './psychometricsFeatureFlags';
import type { ValidationStandardReturnRoute } from '@features/relationshipValidation/validationShellRouting';
import {
  mapInterviewStackRouteForLaunchMode,
  standardApplicantPostInterviewDestination,
} from '@features/onboarding/postInterviewLaunchMode';

import type { InitialInterviewRouteResult, InterviewStackRoute } from './resolveInitialInterviewRoute';

export function shouldFetchPostInterviewDeferralSnapshot(
  initialRoute: Pick<InitialInterviewRouteResult, 'screen'> | undefined | null,
  profileShowsStandardInterviewComplete: boolean,
): boolean {
  // Psychometrics-enabled partial report / battery must not be overridden by post-interview deferral.
  if (
    initialRoute?.screen === 'PsychometricAssessment' ||
    initialRoute?.screen === 'InterviewComplete' ||
    initialRoute?.screen === 'PsychometricsComplete'
  ) {
    return false;
  }

  return (
    initialRoute?.screen === 'PostInterviewProcessing' ||
    initialRoute?.screen === 'PostInterviewPassed' ||
    initialRoute?.screen === 'PostInterviewFailed' ||
    initialRoute?.screen === 'PostInterview' ||
    initialRoute?.screen === 'PostInterviewLaunch' ||
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
  /** Restores the post-interview screen after exiting the validation flow. */
  validationStandardReturnRoute?: ValidationStandardReturnRoute | null;
}): ResolvedInterviewStackBootstrap {
  const {
    initialRoute,
    profileShowsStandardInterviewComplete,
    deferralSnapshot,
    isAdminEmail,
    lockedPostInterviewRoute,
    validationStandardReturnRoute,
  } = input;

  let initialRouteName: InterviewStackRoute = initialRoute?.screen ?? 'Amoraea';
  let interviewAlreadyCompleted =
    initialRoute?.interviewAlreadyCompleted === true || profileShowsStandardInterviewComplete;
  let legacyPsychometricsMode = initialRoute?.legacyPsychometricsMode === true;

  if (profileShowsStandardInterviewComplete && (initialRouteName === 'Amoraea' || initialRouteName === 'AssessmentWelcome')) {
    if (!PSYCHOMETRICS_ENABLED) {
      initialRouteName = standardApplicantPostInterviewDestination();
      interviewAlreadyCompleted = true;
      legacyPsychometricsMode = false;
    }
  }

  const serverResolvedPostInterviewScreen = initialRoute?.screen;
  if (
    serverResolvedPostInterviewScreen === 'PostInterviewPassed' ||
    serverResolvedPostInterviewScreen === 'PostInterviewFailed'
  ) {
    initialRouteName = serverResolvedPostInterviewScreen;
  } else if (
    initialRouteName !== 'PsychometricAssessment' &&
    initialRouteName !== 'InterviewComplete' &&
    initialRouteName !== 'PsychometricsComplete' &&
    shouldFetchPostInterviewDeferralSnapshot(initialRoute, profileShowsStandardInterviewComplete) &&
    deferralSnapshot != null &&
    !isAdminEmail
  ) {
    initialRouteName = resolveStandardPostInterviewStackRoute(deferralSnapshot);
  }

  if (lockedPostInterviewRoute === 'PostInterviewPassed' || lockedPostInterviewRoute === 'PostInterviewFailed') {
    initialRouteName = lockedPostInterviewRoute;
  }

  if (validationStandardReturnRoute) {
    initialRouteName = mapInterviewStackRouteForLaunchMode(validationStandardReturnRoute);
    interviewAlreadyCompleted = true;
    legacyPsychometricsMode = false;
  }

  initialRouteName = mapInterviewStackRouteForLaunchMode(initialRouteName);

  return {
    initialRouteName,
    interviewAlreadyCompleted,
    legacyPsychometricsMode,
    needsMarketResearch: initialRoute?.needsMarketResearch === true,
  };
}
