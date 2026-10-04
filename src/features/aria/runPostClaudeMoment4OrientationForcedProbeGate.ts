import { deliverPostClaudeForcedMoment4OrientationProbe } from '@features/aria/deliverPostClaudeForcedMoment4OrientationProbe';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  isIncompleteMoment4OrientationLeadSentence,
  looksLikeMoment4OrientationQuestion,
  transcriptIncludesAssistantMatch,
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

export async function runPostClaudeMoment4OrientationForcedProbeGate(
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
  const { assistantIssuedMoment4AnyQuestion, assistantTurnIsElongatingProbeOnly } = draft;
  const assistantIssuedMoment4OrientationProbe = transcriptIncludesAssistantMatch(
    params.messagesToUse,
    looksLikeMoment4OrientationQuestion,
  );

  const answeringAfterSpecificityFollowUp = isAnsweringMoment4SpecificityFollowUp(params.messagesToUse);
  const modelIssuedGrudgeElaborationFollowUp =
    looksLikeMoment4GrudgeElaborationFollowUp(strippedText) ||
    looksLikeMoment4GrudgeElaborationFollowUp(text);

  if (
    !params.shouldForceMoment4OrientationProbe ||
    (deps.moment4ClientSpecificityProbeInjectedRef.current && !answeringAfterSpecificityFollowUp) ||
    (modelIssuedGrudgeElaborationFollowUp && !answeringAfterSpecificityFollowUp) ||
    assistantIssuedMoment4OrientationProbe ||
    assistantIssuedMoment4AnyQuestion ||
    assistantTurnIsElongatingProbeOnly ||
    text.includes('[INTERVIEW_COMPLETE]')
  ) {
    return null;
  }

  const orientationParaphraseOnly =
    !!strippedText && looksLikeMoment4OrientationQuestion(strippedText.trim());
  const orientationLeadInProgress =
    !!strippedText &&
    (orientationParaphraseOnly || isIncompleteMoment4OrientationLeadSentence(strippedText));
  const incompleteSpecificityAck =
    !!strippedText &&
    !orientationLeadInProgress &&
    looksLikeMoment4SpecificityCorrectionAck(strippedText);
  let stagedMessages = params.messagesToUse;
  if (strippedText && !orientationLeadInProgress && !incompleteSpecificityAck) {
    stagedMessages = await stageAndSpeakForcedConstructProbeLeadIn(
      deps,
      params,
      strippedText,
      speakAssistantTurn,
    );
  }

  await deliverPostClaudeForcedMoment4OrientationProbe({
    deps,
    params,
    stagedMessages,
    speakAssistantTurn,
    logTag: '[M4_ORIENTATION_FORCED]',
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  });
}
