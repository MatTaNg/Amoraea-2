import { deliverPostClaudeForcedMoment4ThresholdProbe } from '@features/aria/deliverPostClaudeForcedMoment4ThresholdProbe';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMoment4ThresholdParaphraseInProgress,
  looksLikeMoment4ThresholdQuestion,
} from '@features/aria/moment4ProbeLogic';
import {
  isAnsweringMoment4SpecificityFollowUp,
  looksLikeMoment4GrudgeElaborationFollowUp,
  looksLikeMoment4SpecificityCorrectionAck,
} from '@features/aria/moment4SpecificityFollowUp';
import {
  finishPostClaudeForcedConstructProbeGate,
  stageAndSpeakForcedConstructProbeLeadIn,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';

export async function runPostClaudeMoment4ThresholdForcedProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  draft: ForcedConstructProbeContext,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  jamesState: Pick<
    PostClaudeForcedConstructProbeGatesResult,
    'scenarioBSkippedJamesIntermediate' | 'needsScenarioBJamesDifferentlyInsert'
  >,
): Promise<PostClaudeForcedConstructProbeGatesResult | null> {
  const strippedText = draft.strippedText;
  const { assistantIssuedMoment4ThresholdProbe, assistantIssuedMoment4AnyQuestion, assistantTurnIsElongatingProbeOnly } = draft;

  const answeringAfterSpecificityFollowUp = isAnsweringMoment4SpecificityFollowUp(params.messagesToUse);
  const modelIssuedGrudgeElaborationFollowUp =
    looksLikeMoment4GrudgeElaborationFollowUp(strippedText) ||
    looksLikeMoment4GrudgeElaborationFollowUp(text);

  if (
    !params.shouldForceMoment4ThresholdProbe ||
    (deps.moment4ClientSpecificityProbeInjectedRef.current && !answeringAfterSpecificityFollowUp) ||
    (modelIssuedGrudgeElaborationFollowUp && !answeringAfterSpecificityFollowUp) ||
    assistantIssuedMoment4ThresholdProbe ||
    assistantIssuedMoment4AnyQuestion ||
    assistantTurnIsElongatingProbeOnly ||
    text.includes('[INTERVIEW_COMPLETE]')
  ) {
    return null;
  }

  const thresholdParaphraseOnly =
    !!strippedText && looksLikeMoment4ThresholdQuestion(strippedText.trim());
  const thresholdLeadInProgress =
    !!strippedText &&
    (thresholdParaphraseOnly ||
      isIncompleteMoment4ThresholdLeadSentence(strippedText) ||
      looksLikeMoment4ThresholdParaphraseInProgress(strippedText));
  const incompleteSpecificityAck =
    !!strippedText &&
    !thresholdLeadInProgress &&
    looksLikeMoment4SpecificityCorrectionAck(strippedText);
  let stagedMessages = params.messagesToUse;
  if (strippedText && !thresholdLeadInProgress && !incompleteSpecificityAck) {
    stagedMessages = await stageAndSpeakForcedConstructProbeLeadIn(
      deps,
      params,
      strippedText,
      speakAssistantTurn,
    );
  }

  await deliverPostClaudeForcedMoment4ThresholdProbe({
    deps,
    params,
    stagedMessages,
    speakAssistantTurn,
    logTag: '[M4_THRESHOLD_FORCED]',
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  });
}
