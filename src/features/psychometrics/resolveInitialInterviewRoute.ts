import { fetchInterviewAttemptRevealSnapshot } from '@utilities/fetchInterviewAttemptRevealSnapshot';

import { determinePostInterviewRoute } from '@features/psychometrics/determinePostInterviewRoute';
import {
  fetchUserInterviewCompletionStatus,
  resolveInterviewStackScreenFromStatus,
} from '@features/psychometrics/interviewCompletionStatus';

export type InterviewStackRoute =
  | 'PsychometricAssessment'
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
 * Market research (root overlay) → psychometrics → interview / post-interview.
 */
export async function resolveInitialInterviewRoute(userId: string): Promise<InitialInterviewRouteResult> {
  const { interviewCompleted, psychometricsCompletedAt, routingRow } =
    await fetchUserInterviewCompletionStatus(userId);

  const needsMarketResearch =
    routingRow != null && routingRow.market_research_completed_at == null;

  let postInterviewScreen: InterviewStackRoute | null = null;
  if (psychometricsCompletedAt != null && interviewCompleted) {
    const snapshot = await fetchInterviewAttemptRevealSnapshot(userId);
    postInterviewScreen = determinePostInterviewRoute(snapshot).route;
  }

  const routed = resolveInterviewStackScreenFromStatus({
    psychometricsCompletedAt,
    interviewCompleted,
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
