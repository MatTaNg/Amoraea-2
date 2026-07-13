import { isFirstUserTurnAfterMoment5ConflictValidityClarification } from '@features/aria/interviewMomentScenarioConfig';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { Moment5AccountabilityProbeEvaluation } from '@features/aria/moment5ProbeLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  classifyConflictValidity,
  combineMoment5UserTextIncludingCurrent,
  combineMoment5UserTurnText,
  evaluateMoment5AccountabilityProbe,
  extractPriorM5TranscriptBeforeClarification,
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5ResolutionFollowUpPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  moment5AnswerHasExplicitSelfAccountability,
  moment5ConflictValidityIsLow,
  moment5ResponseAddsTensionDetail,
  moment5ResponseIsAbstract,
  moment5TranscriptHasConcreteAnchor,
  moment5UserDeclinesConcreteReask,
  moment5UserOrTranscriptHasConcreteAnchor,
  transcriptHasMoment5ResolutionFollowUpAsked,
} from '@features/aria/probeAndScoringUtils';
import { isPreClaudeMoment5AccountabilityProbeCandidate } from '@features/aria/preClaudeMoment5AccountabilityInjectShared';

/** After the resolution follow-up, evaluate accountability on the full M5 narrative (not only the short reply). */
export function resolveMoment5AccountabilityProbeEvalText(
  trimmed: string,
  moment5CombinedIncludingCurrent: string,
  lastInterviewerContent: string,
): string {
  if (looksLikeMoment5ResolutionFollowUpPrompt(lastInterviewerContent)) {
    return moment5CombinedIncludingCurrent;
  }
  return trimmed;
}

export type PreClaudeMoment5AccountabilityEvalContext = {
  moment5AccountabilityProbeCandidate: boolean;
  moment5AccountabilityEval: Moment5AccountabilityProbeEvaluation;
  moment5CombinedUserText: string;
  moment5CombinedIncludingCurrent: string;
  moment5SelfAccountabilityAlreadyEstablished: boolean;
  moment5NarrativeConcrete: boolean;
  moment5NarrativeConcreteIncludingCurrent: boolean;
  moment5AnsweringAfterSpecificityRedirect: boolean;
  moment5AnsweringAfterConflictValidityClarification: boolean;
  moment5LowConflictValidity: boolean;
  moment5PriorM5Transcript: string;
  moment5ConflictValidityClassification: ReturnType<typeof classifyConflictValidity> | null;
  moment5AddsTensionDetailAfterClarification: boolean;
  moment5ForcedAbstractFollowupAccountabilityProbe: boolean;
  moment5PushbackAlreadyGaveSpecificExample: boolean;
  specificityRedirectAlreadyInTranscript: boolean;
  resolutionFollowUpAlreadyInTranscript: boolean;
  moment5AnsweringAfterResolutionFollowUp: boolean;
};

export function buildPreClaudeMoment5AccountabilityEvalContext(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastInterviewerContent: string,
): PreClaudeMoment5AccountabilityEvalContext {
  const moment5AccountabilityProbeCandidate = isPreClaudeMoment5AccountabilityProbeCandidate(
    deps,
    lastInterviewerContent,
    messagesToUse,
  );
  const moment5CombinedUserText = combineMoment5UserTurnText(messagesToUse);
  const moment5CombinedIncludingCurrent = combineMoment5UserTextIncludingCurrent(messagesToUse, trimmed);
  const accountabilityProbeEvalText = resolveMoment5AccountabilityProbeEvalText(
    trimmed,
    moment5CombinedIncludingCurrent,
    lastInterviewerContent,
  );
  const moment5AccountabilityEval = evaluateMoment5AccountabilityProbe(accountabilityProbeEvalText);
  const moment5SelfAccountabilityAlreadyEstablished = moment5AnswerHasExplicitSelfAccountability(
    moment5CombinedIncludingCurrent,
  );
  const moment5NarrativeConcrete = moment5TranscriptHasConcreteAnchor(messagesToUse);
  const moment5NarrativeConcreteIncludingCurrent = moment5UserOrTranscriptHasConcreteAnchor(trimmed, messagesToUse);
  const moment5AnsweringAfterSpecificityRedirect =
    looksLikeMoment5SpecificityRedirectPrompt(lastInterviewerContent);
  const moment5AnsweringAfterConflictValidityClarification =
    looksLikeMoment5ConflictValidityClarificationPrompt(lastInterviewerContent) ||
    isFirstUserTurnAfterMoment5ConflictValidityClarification(messagesToUse);
  const moment5LowConflictValidity = moment5ConflictValidityIsLow(trimmed);
  const moment5PriorM5Transcript = extractPriorM5TranscriptBeforeClarification(messagesToUse.slice(0, -1));
  const moment5ConflictValidityClassification = moment5AnsweringAfterConflictValidityClarification
    ? classifyConflictValidity(trimmed, moment5PriorM5Transcript)
    : null;
  const moment5AddsTensionDetailAfterClarification =
    moment5AnsweringAfterConflictValidityClarification && moment5ResponseAddsTensionDetail(trimmed);
  const moment5ForcedAbstractFollowupAccountabilityProbe =
    moment5AnsweringAfterSpecificityRedirect &&
    deps.moment5SpecificityRedirectIssuedRef.current &&
    !moment5NarrativeConcreteIncludingCurrent &&
    !moment5UserDeclinesConcreteReask(trimmed) &&
    moment5ResponseIsAbstract(trimmed) &&
    moment5AccountabilityEval.reason !== 'decline_or_vague_evade';
  const moment5PushbackAlreadyGaveSpecificExample =
    moment5UserDeclinesConcreteReask(trimmed) &&
    moment5NarrativeConcreteIncludingCurrent &&
    (moment5AnsweringAfterSpecificityRedirect ||
      looksLikeMoment5AccountabilityProbeAssistantPrompt(lastInterviewerContent));
  const specificityRedirectAlreadyInTranscript = messagesToUse.some(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      looksLikeMoment5SpecificityRedirectPrompt((m as { content?: string }).content ?? ''),
  );
  const resolutionFollowUpAlreadyInTranscript = transcriptHasMoment5ResolutionFollowUpAsked(messagesToUse);
  const moment5AnsweringAfterResolutionFollowUp =
    looksLikeMoment5ResolutionFollowUpPrompt(lastInterviewerContent);

  return {
    moment5AccountabilityProbeCandidate,
    moment5AccountabilityEval,
    moment5CombinedUserText,
    moment5CombinedIncludingCurrent,
    moment5SelfAccountabilityAlreadyEstablished,
    moment5NarrativeConcrete,
    moment5NarrativeConcreteIncludingCurrent,
    moment5AnsweringAfterSpecificityRedirect,
    moment5AnsweringAfterConflictValidityClarification,
    moment5LowConflictValidity,
    moment5PriorM5Transcript,
    moment5ConflictValidityClassification,
    moment5AddsTensionDetailAfterClarification,
    moment5ForcedAbstractFollowupAccountabilityProbe,
    moment5PushbackAlreadyGaveSpecificExample,
    specificityRedirectAlreadyInTranscript,
    resolutionFollowUpAlreadyInTranscript,
    moment5AnsweringAfterResolutionFollowUp,
  };
}
