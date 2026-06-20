import type { InterviewAttemptRevealFields } from '@utilities/postInterviewProcessingGate';
import {
  evaluateStandardPostInterviewReveal,
  standardPostInterviewRouteFromReveal,
  type StandardPostInterviewReveal,
} from '@utilities/postInterviewProcessingGate';
import { mapPostInterviewStackRouteForLaunchMode } from '@features/onboarding/postInterviewLaunchMode';

export type PostInterviewRouteDecision = {
  route:
    | 'PostInterview'
    | 'PostInterviewProcessing'
    | 'PostInterviewPassed'
    | 'PostInterviewFailed'
    | 'PostInterviewLaunch';
  reveal: StandardPostInterviewReveal;
};

/** Post-interview routing — neutral review until admin override or 48h since `completed_at`. */
export function determinePostInterviewRoute(
  revealAttempt: InterviewAttemptRevealFields | null | undefined,
  nowMs: number = Date.now(),
): PostInterviewRouteDecision {
  const reveal = evaluateStandardPostInterviewReveal(revealAttempt, nowMs);

  return {
    route: mapPostInterviewStackRouteForLaunchMode(standardPostInterviewRouteFromReveal(reveal)),
    reveal,
  };
}
