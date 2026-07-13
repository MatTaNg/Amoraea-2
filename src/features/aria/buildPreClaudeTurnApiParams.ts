import {
  PERSONAL_CLOSING_INSTRUCTION,
  SCENARIO_ONLY_CLOSING_INSTRUCTION,
} from '@features/aria/interviewAssistantReflection';
import { buildInterviewerParticipantFirstNameSystemSuffix } from '@features/aria/interviewerFrameworkPrompt';
import { buildInterviewProgressSystemSuffix } from '@features/aria/interviewProgressSync';
import { buildMoment4TranscriptSystemSuffix } from '@features/aria/reflectionTranscriptGrounding';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  buildMetaCommentHandlingSuffix,
  hadPriorSubstantiveAnswerInScenarioForFrustration,
} from '@features/aria/metaCommentClassification';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps, PreClaudeTurnGateParams } from '@features/aria/preClaudeTurnGateTypes';
import { moment5TranscriptHasConcreteAnchor } from '@features/aria/probeAndScoringUtils';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

export type BuildPreClaudeTurnApiParamsContext = {
  messagesToUse: MessageWithScenario[];
  userScenarioTag: number;
  participantFirstNameForSpoken: string;
  isPersonalOpening: boolean;
  lastAssistantContent: string;
  isNameEntryTurn: boolean;
  trimmed: string;
  shouldForceMoment4ThresholdProbe: boolean;
  moment4ThresholdHintInAnswer: boolean;
  moment5CombinedUserText: string;
  metaCommentClassification: MetaCommentClassification | null;
  repeatedFrustrationInMoment: boolean;
  alreadyAnsweredPriorSubstantiveVerified: boolean | undefined;
  checkingInFrustrationAdjacent: boolean;
  suppressForcedConstructProbesForMetaFrustration: boolean;
  frustrationSkipAcceptancePipeline: boolean;
  frustrationSkipDeclinePipeline: boolean;
  proactiveScenarioSkipConfirmationInjection: boolean;
  constructProbeFlags: PreClaudeScenarioConstructProbeFlags;
};

function resolveMaxTokensForPreClaudeTurn(
  messagesToUse: MessageWithScenario[],
  currentMoment: number,
): number {
  const lastUserMsg =
    (messagesToUse[messagesToUse.length - 1] as { content?: string })?.content?.toLowerCase() ?? '';
  const isNoExample = /don't have|can't think|i dont|nothing comes|no example|i don't/i.test(lastUserMsg);
  let maxTok = isNoExample ? 600 : 380;
  if (currentMoment >= 1 && currentMoment <= 3) {
    maxTok = Math.max(maxTok, 720);
  }
  if (currentMoment === 4 || currentMoment === 5) {
    maxTok = Math.max(maxTok, 2800);
  }
  return maxTok;
}

/**
 * Assembles Claude API params and frustration-skip ref side effects after all intercept gates pass.
 */
export function buildPreClaudeTurnApiParams(
  deps: PreClaudeTurnGateDeps,
  params: PreClaudeTurnGateParams,
  ctx: BuildPreClaudeTurnApiParamsContext,
): void {
  const {
    messagesToUse,
    userScenarioTag,
    participantFirstNameForSpoken,
    isPersonalOpening,
    lastAssistantContent,
    isNameEntryTurn,
    trimmed,
    shouldForceMoment4ThresholdProbe,
    moment4ThresholdHintInAnswer,
    moment5CombinedUserText,
    metaCommentClassification,
    repeatedFrustrationInMoment,
    alreadyAnsweredPriorSubstantiveVerified,
    checkingInFrustrationAdjacent,
    suppressForcedConstructProbesForMetaFrustration,
    frustrationSkipAcceptancePipeline,
    frustrationSkipDeclinePipeline,
    proactiveScenarioSkipConfirmationInjection,
    constructProbeFlags,
  } = ctx;

  const {
    replyingToScenarioAQ1,
    replyingToScenarioBQ1,
    replyingToScenarioCQ1,
    scenarioAContemptGateUserText,
    shouldForceScenarioAContemptProbe,
    shouldForceScenarioBFullAppreciationProbe,
    shouldForceScenarioBJamesRepairProbe,
    shouldForceScenarioCRepairProbe,
    shouldForceScenarioCSophiePerspectiveProbe,
    specificEmmaLineAlreadyAddressed,
    sidedEntirelyWithJames,
    scenarioBQ1Engaged,
    muteParallelTtsForScenarioAContemptProbeStream,
    muteParallelTtsForS3ToM4HandoffStream,
    allowScenarioARepairAfterContemptAnswer,
  } = constructProbeFlags;

  const maxTok = resolveMaxTokensForPreClaudeTurn(
    messagesToUse,
    deps.currentInterviewMomentRef.current,
  );
  const closingInstruction = deps.usedPersonalExamples
    ? PERSONAL_CLOSING_INSTRUCTION
    : SCENARIO_ONLY_CLOSING_INSTRUCTION;
  const progressSuffix =
    buildInterviewProgressSystemSuffix({
      momentsComplete: { ...deps.interviewMomentsCompleteRef.current },
      currentMoment: deps.currentInterviewMomentRef.current,
      personalHandoffInjected: deps.personalHandoffInjectedRef.current,
    }) +
    buildMoment4TranscriptSystemSuffix(messagesToUse, deps.currentInterviewMomentRef.current);
  const participantFirstNameSystemSuffix = buildInterviewerParticipantFirstNameSystemSuffix(
    deps.interviewNameRef.current ?? '',
  );
  const elongatingSuppressedForUserTurn = true;
  const hadPriorSubstantiveAnswerForFrustrationOffer =
    metaCommentClassification?.type === 'frustration' && !repeatedFrustrationInMoment
      ? hadPriorSubstantiveAnswerInScenarioForFrustration(
          messagesToUse.slice(0, -1),
          userScenarioTag as 1 | 2 | 3,
        )
      : undefined;
  const metaCommentSystemSuffix =
    metaCommentClassification != null
      ? buildMetaCommentHandlingSuffix({
          classification: metaCommentClassification,
          repeatedFrustrationInMoment:
            repeatedFrustrationInMoment && metaCommentClassification.type === 'frustration',
          hadPriorSubstantiveAnswerInMoment: hadPriorSubstantiveAnswerForFrustrationOffer,
          alreadyAnsweredPriorSubstantiveVerified:
            metaCommentClassification.type === 'already_answered'
              ? alreadyAnsweredPriorSubstantiveVerified === true
              : undefined,
          checkingInFrustrationAdjacent:
            metaCommentClassification.type === 'checking_in' ? checkingInFrustrationAdjacent : undefined,
          inMoment5AfterAccountabilityProbe:
            metaCommentClassification.type === 'checking_in'
              ? deps.currentInterviewMomentRef.current === 5 && deps.moment5AccountabilityProbeFiredRef.current
              : undefined,
          moment5ConfusionRepeatHasPriorSubstantive:
            metaCommentClassification.type === 'confusion' &&
            metaCommentClassification.confusion_subtype === 'repeat_request' &&
            deps.currentInterviewMomentRef.current === 5 &&
            moment5TranscriptHasConcreteAnchor(messagesToUse),
        })
      : '';

  deps.metaClassificationForPendingAssistantRef.current = metaCommentClassification;
  if (
    metaCommentClassification?.type === 'frustration' &&
    !repeatedFrustrationInMoment &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin
  ) {
    deps.scenarioSkipOfferSourceRef.current = 'frustration_meta';
    deps.frustrationSkipOfferPendingRef.current = true;
    deps.frustrationSkipAwaitingConfirmationRef.current = true;
    deps.frustrationSkipHadPriorAnswerRef.current = hadPriorSubstantiveAnswerForFrustrationOffer ?? false;
  }
  if (
    metaCommentClassification?.type === 'already_answered' &&
    alreadyAnsweredPriorSubstantiveVerified === false &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin
  ) {
    deps.scenarioSkipOfferSourceRef.current = 'already_answered_meta';
    deps.frustrationSkipOfferPendingRef.current = true;
    deps.frustrationSkipAwaitingConfirmationRef.current = true;
    deps.frustrationSkipHadPriorAnswerRef.current = false;
  }

  const elongatingProbeStateForApi = true;
  const skipContinuationSnap = deps.skipContinuationSystemSuffixRef.current;
  deps.skipContinuationSystemSuffixRef.current = '';

  params.messagesToUse = messagesToUse;
  params.userScenarioTag = userScenarioTag;
  params.participantFirstNameForSpoken = participantFirstNameForSpoken;
  params.isPersonalOpening = isPersonalOpening;
  params.replyingToScenarioAQ1 = replyingToScenarioAQ1;
  params.replyingToScenarioBQ1 = replyingToScenarioBQ1;
  params.replyingToScenarioCQ1 = replyingToScenarioCQ1;
  params.shouldForceScenarioAContemptProbe = shouldForceScenarioAContemptProbe;
  params.shouldForceScenarioBFullAppreciationProbe = shouldForceScenarioBFullAppreciationProbe;
  params.shouldForceScenarioBJamesRepairProbe = shouldForceScenarioBJamesRepairProbe;
  params.shouldForceScenarioCRepairProbe = shouldForceScenarioCRepairProbe;
  params.shouldForceScenarioCSophiePerspectiveProbe = shouldForceScenarioCSophiePerspectiveProbe;
  params.shouldForceMoment4ThresholdProbe = shouldForceMoment4ThresholdProbe;
  params.specificEmmaLineAlreadyAddressed = specificEmmaLineAlreadyAddressed;
  params.suppressForcedConstructProbesForMetaFrustration = suppressForcedConstructProbesForMetaFrustration;
  params.scenarioAContemptGateUserText = scenarioAContemptGateUserText;
  params.sidedEntirelyWithJames = sidedEntirelyWithJames;
  params.scenarioBQ1Engaged = scenarioBQ1Engaged;
  params.moment5CombinedUserText = moment5CombinedUserText;
  params.moment4ThresholdHintInAnswer = moment4ThresholdHintInAnswer;
  params.metaCommentClassification = metaCommentClassification;
  params.repeatedFrustrationInMoment = repeatedFrustrationInMoment;
  params.alreadyAnsweredPriorSubstantiveVerified = alreadyAnsweredPriorSubstantiveVerified;
  params.checkingInFrustrationAdjacent = checkingInFrustrationAdjacent;
  params.maxTok = maxTok;
  params.closingInstruction = closingInstruction;
  params.progressSuffix = progressSuffix;
  params.participantFirstNameSystemSuffix = participantFirstNameSystemSuffix;
  params.elongatingSuppressedForUserTurn = elongatingSuppressedForUserTurn;
  params.metaCommentSystemSuffix = metaCommentSystemSuffix;
  params.muteParallelTtsForScenarioAContemptProbeStream = muteParallelTtsForScenarioAContemptProbeStream;
  params.muteParallelTtsForS3ToM4HandoffStream = muteParallelTtsForS3ToM4HandoffStream;
  params.allowScenarioARepairAfterContemptAnswer = allowScenarioARepairAfterContemptAnswer;
  params.lastAssistantContent = lastAssistantContent;
  params.isNameEntryTurn = isNameEntryTurn;
  params.frustrationSkipAcceptancePipeline = frustrationSkipAcceptancePipeline;
  params.frustrationSkipDeclinePipeline = frustrationSkipDeclinePipeline;
  params.proactiveScenarioSkipConfirmationInjection = proactiveScenarioSkipConfirmationInjection;
  params.elongatingProbeStateForApi = elongatingProbeStateForApi;
  params.skipContinuationSnap = skipContinuationSnap;
  params.hadPriorSubstantiveAnswerForFrustrationOffer = hadPriorSubstantiveAnswerForFrustrationOffer;
}
