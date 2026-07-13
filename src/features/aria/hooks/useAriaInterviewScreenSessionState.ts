import { useAriaInterviewClosingQuestionState } from '@features/aria/hooks/useAriaInterviewClosingQuestionState';

export type {
  AriaInterviewScreenSessionGateState,
  AriaInterviewScreenSessionRoutingState,
  AriaInterviewScreenSessionShellState,
  AriaInterviewScreenSessionState,
  InterviewUiPhase,
  ReasoningProgress,
  UseAriaInterviewScreenSessionStateParams,
  WebTtsUtteranceReplayOptions,
} from '@features/aria/hooks/ariaInterviewScreenSessionStateTypes';

import type {
  AriaInterviewScreenSessionState,
  UseAriaInterviewScreenSessionStateParams,
} from '@features/aria/hooks/ariaInterviewScreenSessionStateTypes';
import { useAriaInterviewSessionMetaSkipGateRefs } from '@features/aria/hooks/useAriaInterviewSessionMetaSkipGateRefs';
import { useAriaInterviewSessionProgressResetGateRefs } from '@features/aria/hooks/useAriaInterviewSessionProgressResetGateRefs';
import { useAriaInterviewSessionResumeEmotionGateRefs } from '@features/aria/hooks/useAriaInterviewSessionResumeEmotionGateRefs';
import { useAriaInterviewSessionRoutingState } from '@features/aria/hooks/useAriaInterviewSessionRoutingState';
import { useAriaInterviewSessionScenarioGateRefs } from '@features/aria/hooks/useAriaInterviewSessionScenarioGateRefs';
import { useAriaInterviewSessionShellState } from '@features/aria/hooks/useAriaInterviewSessionShellState';
import { useAriaInterviewSessionWebTtsGateRefs } from '@features/aria/hooks/useAriaInterviewSessionWebTtsGateRefs';

/** Session-scoped state and refs between `useAriaInterviewSession` and gate dep-sync wiring. */
export function useAriaInterviewScreenSessionState(
  params: UseAriaInterviewScreenSessionStateParams,
): AriaInterviewScreenSessionState {
  const { userId, routeName, fromValidationTrack, status, setMessages } = params;

  const shell = useAriaInterviewSessionShellState({ status, setMessages });
  const routing = useAriaInterviewSessionRoutingState({
    routeName,
    fromValidationTrack,
    interviewStatus: shell.interviewStatus,
  });
  const metaSkip = useAriaInterviewSessionMetaSkipGateRefs();
  const scenario = useAriaInterviewSessionScenarioGateRefs();
  const webTts = useAriaInterviewSessionWebTtsGateRefs();
  const resumeEmotion = useAriaInterviewSessionResumeEmotionGateRefs({
    setEmotionModalVisible: shell.setEmotionModalVisible,
    setEmotionModalItemIndex: shell.setEmotionModalItemIndex,
    setEmotionItemResponses: shell.setEmotionItemResponses,
    setEmotionItemsComplete: shell.setEmotionItemsComplete,
  });
  const progressReset = useAriaInterviewSessionProgressResetGateRefs(userId);
  const closingQuestion = useAriaInterviewClosingQuestionState();

  return {
    routing,
    closingQuestion,
    gate: {
      resetScenarioCClientGates: {
        scenarioCRepairOnlyEvidenceRef: scenario.scenarioCRepairOnlyEvidenceRef,
        scenarioCSophiePerspectiveProbeFiredRef: scenario.scenarioCSophiePerspectiveProbeFiredRef,
      },
      metaSkip: {
        substantiveInterviewQuestionDeliveredSeqRef: metaSkip.substantiveInterviewQuestionDeliveredSeqRef,
        metaCommentAckAwaitingSubstantiveBaselineSeqRef: metaSkip.metaCommentAckAwaitingSubstantiveBaselineSeqRef,
        metaClassificationForPendingAssistantRef: metaSkip.metaClassificationForPendingAssistantRef,
        scenarioFrustrationSkipNullMarkersRef: metaSkip.scenarioFrustrationSkipNullMarkersRef,
        frustrationSkipOfferPendingRef: metaSkip.frustrationSkipOfferPendingRef,
        frustrationSkipAwaitingConfirmationRef: metaSkip.frustrationSkipAwaitingConfirmationRef,
        frustrationSkipHadPriorAnswerRef: metaSkip.frustrationSkipHadPriorAnswerRef,
        scenarioSkipOfferSourceRef: metaSkip.scenarioSkipOfferSourceRef,
        metaCommentFrustrationCountByMomentRef: metaSkip.metaCommentFrustrationCountByMomentRef,
        inabilityCountByMomentRef: metaSkip.inabilityCountByMomentRef,
        skipRequestClassificationSeenByMomentRef: metaSkip.skipRequestClassificationSeenByMomentRef,
        skipContinuationSystemSuffixRef: metaSkip.skipContinuationSystemSuffixRef,
        scenarioSkipConfirmedCountRef: metaSkip.scenarioSkipConfirmedCountRef,
        scenarioSkipPenaltySumRef: metaSkip.scenarioSkipPenaltySumRef,
        recordInterviewAssistantDeliveryForMetaExemptionRef:
          metaSkip.recordInterviewAssistantDeliveryForMetaExemptionRef,
        finalizePendingMetaAckBaselineAfterAssistantTextRef:
          metaSkip.finalizePendingMetaAckBaselineAfterAssistantTextRef,
        interviewAttemptCreationInFlightRef: metaSkip.interviewAttemptCreationInFlightRef,
        recoveryAssistantSpokenAtSubstantiveSeqRef: metaSkip.recoveryAssistantSpokenAtSubstantiveSeqRef,
        tryRunEmotionModalFromScenarioTransitionRef: metaSkip.tryRunEmotionModalFromScenarioTransitionRef,
        elongatingProbeFiredRef: metaSkip.elongatingProbeFiredRef,
      },
      moments: {
        scenarioCRepairOnlyEvidenceRef: scenario.scenarioCRepairOnlyEvidenceRef,
        scenarioCSophiePerspectiveProbeFiredRef: scenario.scenarioCSophiePerspectiveProbeFiredRef,
        currentInterviewMomentRef: scenario.currentInterviewMomentRef,
        personalHandoffInjectedRef: scenario.personalHandoffInjectedRef,
        interviewMomentsCompleteRef: scenario.interviewMomentsCompleteRef,
        interviewNameRef: scenario.interviewNameRef,
        interviewNameReaskPendingRef: scenario.interviewNameReaskPendingRef,
        interviewNameReaskUsedRef: scenario.interviewNameReaskUsedRef,
        moment4ThresholdProbeAskedRef: scenario.moment4ThresholdProbeAskedRef,
        deliveredReflectionRegistryRef: scenario.deliveredReflectionRegistryRef,
        moment4ClientSpecificityProbeInjectedRef: scenario.moment4ClientSpecificityProbeInjectedRef,
        moment4PostGrudgeSpecificityResolvedRef: scenario.moment4PostGrudgeSpecificityResolvedRef,
        moment4ExpectingPostSpecificityUserTurnRef: scenario.moment4ExpectingPostSpecificityUserTurnRef,
        moment4SpecificityScoringRef: scenario.moment4SpecificityScoringRef,
        deferredMoment4NarrativeRef: scenario.deferredMoment4NarrativeRef,
        moment5QuestionDeliveredRef: scenario.moment5QuestionDeliveredRef,
        moment5QuestionDeliveryInFlightRef: scenario.moment5QuestionDeliveryInFlightRef,
        moment5PrimaryAnchorDeliveredSessionRef: scenario.moment5PrimaryAnchorDeliveredSessionRef,
        moment5PostPromptUserTurnCountRef: scenario.moment5PostPromptUserTurnCountRef,
        moment5AccountabilityProbeFiredRef: scenario.moment5AccountabilityProbeFiredRef,
        moment5ConflictValidityClarificationIssuedRef: scenario.moment5ConflictValidityClarificationIssuedRef,
        moment5SpecificityRedirectIssuedRef: scenario.moment5SpecificityRedirectIssuedRef,
        moment5ResolutionFollowUpIssuedRef: scenario.moment5ResolutionFollowUpIssuedRef,
        moment5ResolutionDeliveredRef: scenario.moment5ResolutionDeliveredRef,
        moment5ClientScoringMetaRef: scenario.moment5ClientScoringMetaRef,
        scenarioAContemptProbeAskedRef: scenario.scenarioAContemptProbeAskedRef,
        scenarioAContemptProbePlaybackConfirmedRef: scenario.scenarioAContemptProbePlaybackConfirmedRef,
        showScenarioCardCanonicalPlaybackConfirmedKindsRef:
          scenario.showScenarioCardCanonicalPlaybackConfirmedKindsRef,
        scenarioAContemptProbeTtsDeliveredSessionRef: scenario.scenarioAContemptProbeTtsDeliveredSessionRef,
        pendingScenarioAContemptProbeStreamMuteRef: scenario.pendingScenarioAContemptProbeStreamMuteRef,
        pendingS3ToM4HandoffStreamMuteRef: scenario.pendingS3ToM4HandoffStreamMuteRef,
        scenarioARepairQuestionAskedRef: scenario.scenarioARepairQuestionAskedRef,
        s2RepairProbeDeliveredRef: scenario.s2RepairProbeDeliveredRef,
        s3RepairProbeDeliveredRef: scenario.s3RepairProbeDeliveredRef,
        turnAudioIndexRef: scenario.turnAudioIndexRef,
        lastUserTurnAudioDurationMsRef: scenario.lastUserTurnAudioDurationMsRef,
        responseTimingsRef: scenario.responseTimingsRef,
      },
      webTts,
      resumeEmotion,
      progressReset,
    },
    shell,
  };
}
