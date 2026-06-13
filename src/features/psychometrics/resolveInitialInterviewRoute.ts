import { fetchInterviewAttemptRevealSnapshot } from '@utilities/fetchInterviewAttemptRevealSnapshot';

import { determinePostInterviewRoute } from '@features/psychometrics/determinePostInterviewRoute';
import {
  fetchUserInterviewCompletionStatus,
  NPI_ENTITLEMENT_ENABLED,
  PSYCHOMETRICS_ENABLED,
  resolveInterviewStackScreenFromStatus,
} from '@features/psychometrics/interviewCompletionStatus';

export { PSYCHOMETRICS_ENABLED, NPI_ENTITLEMENT_ENABLED };

export type InterviewStackRoute =
  | 'AssessmentWelcome'
  | 'PsychometricAssessment'
  | 'PsychometricsComplete'
  | 'InterviewComplete'
  | 'Aria'
  | 'PostInterview'
  | 'PostInterviewProcessing'
  | 'PostInterviewPassed'
  | 'PostInterviewFailed'
  | 'PostInterviewSexualCommunication';

export type InitialInterviewRouteResult = {
  screen: InterviewStackRoute;
  /** True when interview was completed before psychometrics (legacy backfill path). */
  legacyPsychometricsMode: boolean;
  interviewAlreadyCompleted: boolean;
  needsMarketResearch: boolean;
  interviewPassedAdminOverride?: boolean | null;
  interviewPassedComputed?: boolean | null;
};

/**
 * Decides the first screen after login for the interview stack.
 * Market research (root overlay) → psychometrics (when enabled) → interview / post-interview.
 *
 * Feature flag: {@link PSYCHOMETRICS_ENABLED} in interviewCompletionStatus.ts — set to `true` to restore psychometrics.
 */
export async function resolveInitialInterviewRoute(userId: string): Promise<InitialInterviewRouteResult> {
  const { interviewCompleted, psychometricsCompletedAt, gateResultFinalizedAt, routingRow } =
    await fetchUserInterviewCompletionStatus(userId);

  const needsMarketResearch = routingRow?.market_research_completed_at == null;

  let postInterviewScreen: InterviewStackRoute | null = null;
  const shouldResolvePostInterviewRoute = PSYCHOMETRICS_ENABLED
    ? psychometricsCompletedAt != null &&
      interviewCompleted &&
      gateResultFinalizedAt != null
    : interviewCompleted;
  if (shouldResolvePostInterviewRoute) {
    const snapshot = await fetchInterviewAttemptRevealSnapshot(userId);
    postInterviewScreen = determinePostInterviewRoute(snapshot).route;
  }

  const routed = resolveInterviewStackScreenFromStatus({
    psychometricsCompletedAt,
    interviewCompleted,
    gateResultFinalizedAt,
    postInterviewScreen,
  });

  return {
    screen: routed.screen,
    legacyPsychometricsMode: routed.legacyPsychometricsMode,
    interviewAlreadyCompleted: routed.interviewAlreadyCompleted,
    needsMarketResearch,
    interviewPassedAdminOverride: routingRow?.interview_passed_admin_override ?? null,
    interviewPassedComputed: routingRow?.interview_passed_computed ?? null,
  };
}
