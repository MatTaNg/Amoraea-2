import { updateUserInterviewApplication } from '@data/repos/usersInterviewRepo';
import { attachSkipPenaltyGateOptions } from '@features/aria/interviewSessionUtilities';
import { computeGateResult } from '@features/aria/computeGateResult';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { FALLBACK_MARKER_SCORES_MID } from '@features/aria/scoreInterviewModuleConstants';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { resolveWeightedPassMinAfterReferralEffects } from '@features/referrals/referralInterview';

export type RunNoAnthropicScoringFallbackParams = {
  deps: ScoreInterviewDeps;
  isOnboardingFlow: boolean;
  isAdminConsoleAccount: boolean;
};

/** Completion when neither API key nor proxy is configured — mid-marker gate + save. */
export async function runNoAnthropicScoringFallback(params: RunNoAnthropicScoringFallbackParams): Promise<void> {
  const { deps, isOnboardingFlow, isAdminConsoleAccount } = params;
  const weightedMinFallback = await resolveWeightedPassMinAfterReferralEffects(deps.userId);
  const skipOptsFallback = attachSkipPenaltyGateOptions(deps.scenarioSkipConfirmedCountRef.current);
  const fallbackGate = computeGateResult({ ...FALLBACK_MARKER_SCORES_MID }, null, {
    weightedPassMin: weightedMinFallback,
    scenarioPillarScoresByScenario: {
      1: deps.scenarioScoresRef.current[1]?.pillarScores,
      2: deps.scenarioScoresRef.current[2]?.pillarScores,
      3: deps.scenarioScoresRef.current[3]?.pillarScores,
    },
    skipPenaltyTotal: skipOptsFallback.skipPenaltyTotal,
    skipAutoFail: skipOptsFallback.skipAutoFail,
    mentalizingOvercertaintyCount: 0,
  });
  const fallbackResults: InterviewResults = {
    pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
    keyEvidence: {},
    narrativeCoherence: 'moderate',
    behavioralSpecificity: 'moderate',
    notableInconsistencies: [],
    interviewSummary: 'Interview completed. Scoring was unavailable.',
    gateResult: fallbackGate,
    skipBreakdown: skipOptsFallback.skipBreakdown,
  };
  deps.setResults(fallbackResults);
  if (isOnboardingFlow) {
    await updateUserInterviewApplication(deps.userId, {
      applicationStatus: 'under_review',
      onboardingStage: 'complete',
    });
    deps.queryClient.invalidateQueries({ queryKey: ['deps.profile', deps.userId] });
  }
  await deps.saveInterviewResults(fallbackResults, fallbackResults.gateResult!, deps.userId);
  const standardNoApi = isOnboardingFlow && !!deps.userId && !isAdminConsoleAccount;
  if (standardNoApi) {
    const attemptIdForPoll = deps.interviewSessionAttemptIdRef.current;
    if (typeof attemptIdForPoll === 'string' && attemptIdForPoll.length > 0) {
      deps.setPendingScoringSyncAttemptId(attemptIdForPoll);
    }
    deps.setStatus('results');
    return;
  }
  deps.setInterviewStatus('congratulations');
  deps.setStatus('results');
}
