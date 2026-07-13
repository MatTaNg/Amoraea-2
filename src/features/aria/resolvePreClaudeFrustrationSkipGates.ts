import { userTurnSuppressesElongatingProbe } from '@features/aria/elongatingProbe';
import { countSpokenWords } from '@features/aria/interviewLanguageGate';
import {
  looksLikeFrustrationSkipAcceptance,
  looksLikeFrustrationSkipConfirmationAffirmative,
  looksLikeProactiveScenarioSkipRequest,
  looksLikeSkipConfirmationDecline,
} from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

export type PreClaudeFrustrationSkipGateState = {
  frustrationSkipAcceptancePipeline: boolean;
  frustrationSkipDeclinePipeline: boolean;
  proactiveScenarioSkipConfirmationInjection: boolean;
};

/** Frustration skip acceptance/decline and proactive scenario skip confirmation. */
export function resolvePreClaudeFrustrationSkipGates(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): PreClaudeFrustrationSkipGateState {
  let frustrationSkipAcceptancePipeline = false;
  let frustrationSkipDeclinePipeline = false;
  if (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    deps.frustrationSkipOfferPendingRef.current
  ) {
    if (deps.frustrationSkipAwaitingConfirmationRef.current) {
      if (looksLikeSkipConfirmationDecline(trimmed)) {
        frustrationSkipDeclinePipeline = true;
      } else if (looksLikeFrustrationSkipConfirmationAffirmative(trimmed)) {
        frustrationSkipAcceptancePipeline = true;
      }
    } else if (looksLikeFrustrationSkipConfirmationAffirmative(trimmed)) {
      frustrationSkipAcceptancePipeline = true;
    }
  }

  if (
    deps.frustrationSkipOfferPendingRef.current &&
    !frustrationSkipAcceptancePipeline &&
    !frustrationSkipDeclinePipeline
  ) {
    if (!deps.frustrationSkipAwaitingConfirmationRef.current) {
      if (!looksLikeFrustrationSkipAcceptance(trimmed)) {
        deps.frustrationSkipOfferPendingRef.current = false;
        deps.frustrationSkipHadPriorAnswerRef.current = null;
        deps.scenarioSkipOfferSourceRef.current = null;
      }
    } else {
      const affirms = looksLikeFrustrationSkipConfirmationAffirmative(trimmed);
      const declines = looksLikeSkipConfirmationDecline(trimmed);
      if (!affirms && !declines) {
        const wc = countSpokenWords(trimmed);
        if (wc >= 12 || userTurnSuppressesElongatingProbe(trimmed)) {
          deps.frustrationSkipOfferPendingRef.current = false;
          deps.frustrationSkipHadPriorAnswerRef.current = null;
          deps.frustrationSkipAwaitingConfirmationRef.current = false;
          deps.scenarioSkipOfferSourceRef.current = null;
        }
      }
    }
  }

  let proactiveScenarioSkipConfirmationInjection = false;
  if (
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    !deps.closingQuestionPending &&
    !deps.frustrationSkipOfferPendingRef.current &&
    !frustrationSkipAcceptancePipeline &&
    !frustrationSkipDeclinePipeline
  ) {
    const mSkip = deps.currentInterviewMomentRef.current;
    if (mSkip >= 1 && mSkip <= 3 && looksLikeProactiveScenarioSkipRequest(trimmed)) {
      proactiveScenarioSkipConfirmationInjection = true;
    }
  }

  return {
    frustrationSkipAcceptancePipeline,
    frustrationSkipDeclinePipeline,
    proactiveScenarioSkipConfirmationInjection,
  };
}
