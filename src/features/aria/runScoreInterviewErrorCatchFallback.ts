import { updateUserInterviewApplication } from '@data/repos/usersInterviewRepo';
import { attachSkipPenaltyGateOptions } from '@features/aria/interviewSessionUtilities';
import { computeGateResult } from '@features/aria/computeGateResult';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { FALLBACK_MARKER_SCORES_MID } from '@features/aria/scoreInterviewModuleConstants';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { resolveWeightedPassMinAfterReferralEffects } from '@features/referrals/referralInterview';
import { remoteLog } from '@utilities/remoteLog';

export type RunScoreInterviewErrorCatchFallbackParams = {
  deps: ScoreInterviewDeps;
  isOnboardingFlow: boolean;
  isAdminConsoleAccount: boolean;
  err: unknown;
};

/** Top-level scoreInterview catch — mid-marker results + onboarding or congratulations navigation. */
export async function runScoreInterviewErrorCatchFallback(
  params: RunScoreInterviewErrorCatchFallbackParams,
): Promise<void> {
  const { deps, isOnboardingFlow, isAdminConsoleAccount, err } = params;
  await remoteLog('[ERROR] scoreInterview threw', {
    message: err instanceof Error ? err.message : String(err),
    name: err instanceof Error ? err.name : 'unknown',
    stack: err instanceof Error ? err.stack?.slice(0, 500) : undefined,
  });
  if (__DEV__) console.error('=== COMPLETION ERROR ===', err);
  const weightedMinErr = await resolveWeightedPassMinAfterReferralEffects(deps.userId);
  const skipOptsErr = attachSkipPenaltyGateOptions(deps.scenarioSkipConfirmedCountRef?.current ?? 0);
  const fallbackResults: InterviewResults = {
    pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
    keyEvidence: {},
    narrativeCoherence: 'moderate',
    behavioralSpecificity: 'moderate',
    notableInconsistencies: [],
    interviewSummary: 'A grounded spoken deps.profile. See individual construct scores for detail.',
    skipBreakdown: skipOptsErr.skipBreakdown,
    gateResult: computeGateResult({ ...FALLBACK_MARKER_SCORES_MID }, null, {
      weightedPassMin: weightedMinErr,
      skipPenaltyTotal: skipOptsErr.skipPenaltyTotal,
      skipAutoFail: skipOptsErr.skipAutoFail,
      mentalizingOvercertaintyCount: 0,
    }),
  };
  deps.setResults(fallbackResults);
  if (isOnboardingFlow) {
    await updateUserInterviewApplication(deps.userId, {
      applicationStatus: 'under_review',
      onboardingStage: 'complete',
    });
    deps.queryClient.invalidateQueries({ queryKey: ['profile', deps.userId] });
    deps.queryClient.invalidateQueries({ queryKey: ['initialInterviewRoute', deps.userId] });
  }
  await deps.saveInterviewResults(fallbackResults, fallbackResults.gateResult!, deps.userId);
  const standardCatch = isOnboardingFlow && !!deps.userId && !isAdminConsoleAccount;
  if (standardCatch) {
    const attemptIdForPoll = deps.interviewSessionAttemptIdRef.current;
    if (typeof attemptIdForPoll === 'string' && attemptIdForPoll.length > 0) {
      deps.setPendingScoringSyncAttemptId(attemptIdForPoll);
    }
    deps.setStatus('results');
    return;
  }
  void remoteLog('[RESULTS_SCREEN_TRANSITION]', {
    destination: 'in_app_congratulations',
    userId: deps.userId ?? null,
    interviewSessionId: deps.interviewSessionIdRef.current,
    source: 'scoreInterview_catch_fallback',
  });
  deps.setInterviewStatus('congratulations');
  deps.setStatus('results');
}
