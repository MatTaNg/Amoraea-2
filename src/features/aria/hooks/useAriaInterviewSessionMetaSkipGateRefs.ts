import { useRef } from 'react';

import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';

export function useAriaInterviewSessionMetaSkipGateRefs() {
  const interviewAttemptCreationInFlightRef = useRef(false);
  const scenarioSkipConfirmedCountRef = useRef(0);
  const scenarioSkipPenaltySumRef = useRef(0);
  const elongatingProbeFiredRef = useRef(false);
  const metaCommentFrustrationCountByMomentRef = useRef<Record<number, number>>({});
  const inabilityCountByMomentRef = useRef<Record<number, number>>({});
  const substantiveInterviewQuestionDeliveredSeqRef = useRef(0);
  const metaCommentAckAwaitingSubstantiveBaselineSeqRef = useRef<number | null>(null);
  const metaClassificationForPendingAssistantRef = useRef<MetaCommentClassification | null>(null);
  const recoveryAssistantSpokenAtSubstantiveSeqRef = useRef<number | null>(null);
  const frustrationSkipOfferPendingRef = useRef(false);
  const frustrationSkipAwaitingConfirmationRef = useRef(false);
  const frustrationSkipHadPriorAnswerRef = useRef<boolean | null>(null);
  const scenarioSkipOfferSourceRef = useRef<
    | 'frustration_meta'
    | 'proactive_utterance'
    | 'skip_request_meta'
    | 'inability_escalation'
    | 'already_answered_meta'
    | null
  >(null);
  const skipRequestClassificationSeenByMomentRef = useRef<Record<number, boolean>>({});
  const scenarioFrustrationSkipNullMarkersRef = useRef<Partial<Record<1 | 2 | 3, boolean>>>({});
  const skipContinuationSystemSuffixRef = useRef('');
  const recordInterviewAssistantDeliveryForMetaExemptionRef = useRef<(deliveredQuestionText: string) => void>(
    () => {},
  );
  const finalizePendingMetaAckBaselineAfterAssistantTextRef = useRef<(fullAssistantText: string) => void>(() => {});
  const tryRunEmotionModalFromScenarioTransitionRef = useRef<
    (params: {
      completedScenario: 1 | 2 | 3;
      transitionText: string;
      priorScenario: 1 | 2 | 3 | null;
      source: string;
    }) => Promise<void>
  >(async () => {});

  return {
    interviewAttemptCreationInFlightRef,
    scenarioSkipConfirmedCountRef,
    scenarioSkipPenaltySumRef,
    elongatingProbeFiredRef,
    metaCommentFrustrationCountByMomentRef,
    inabilityCountByMomentRef,
    substantiveInterviewQuestionDeliveredSeqRef,
    metaCommentAckAwaitingSubstantiveBaselineSeqRef,
    metaClassificationForPendingAssistantRef,
    recoveryAssistantSpokenAtSubstantiveSeqRef,
    frustrationSkipOfferPendingRef,
    frustrationSkipAwaitingConfirmationRef,
    frustrationSkipHadPriorAnswerRef,
    scenarioSkipOfferSourceRef,
    skipRequestClassificationSeenByMomentRef,
    scenarioFrustrationSkipNullMarkersRef,
    skipContinuationSystemSuffixRef,
    recordInterviewAssistantDeliveryForMetaExemptionRef,
    finalizePendingMetaAckBaselineAfterAssistantTextRef,
    tryRunEmotionModalFromScenarioTransitionRef,
  };
}
