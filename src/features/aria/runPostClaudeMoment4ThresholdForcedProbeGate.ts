import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  evaluateMoment4RelationshipType,
  buildMoment4ThresholdProbeWithReflection,
  isIncompleteMoment4ThresholdLeadSentence,
  looksLikeMoment4ThresholdParaphraseInProgress,
  looksLikeMoment4ThresholdQuestion,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import {
  extractLeadingReflectionFromMoment4ThresholdProbe,
  registerDeliveredReflection,
} from '@features/aria/deliveredReflectionRegistry';
import {
  isAnsweringMoment4SpecificityFollowUp,
  looksLikeMoment4SpecificityCorrectionAck,
  looksLikeMoment4GrudgeElaborationFollowUp,
  resolveMoment4GrudgeAnswerForThresholdReflection,
} from '@features/aria/moment4SpecificityFollowUp';
import {
  finishPostClaudeForcedConstructProbeGate,
  stageAndSpeakForcedConstructProbeLeadIn,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import { remoteLog } from '@utilities/remoteLog';

const FORCED_M4_THRESHOLD_PROBE = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;

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
  const grudgeAnswerForReflection = resolveMoment4GrudgeAnswerForThresholdReflection(
    params.messagesToUse,
    params.trimmed,
  );
  const thresholdProbeText = buildMoment4ThresholdProbeWithReflection(grudgeAnswerForReflection, {
    deliveredRegistry: deps.deliveredReflectionRegistryRef.current,
    moment4Transcript: params.messagesToUse,
  });
  const combinedMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: thresholdProbeText,
    scenarioNumber: deps.resolveAssistantScenarioNumber(thresholdProbeText, stagedMessages),
  };
  stagedMessages = [...stagedMessages, combinedMsg];
  deps.setMessages(stagedMessages);
  await speakAssistantTurn(thresholdProbeText, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    forceSpeakDespiteParallelStream: true,
  });
  const deliveredReflection = extractLeadingReflectionFromMoment4ThresholdProbe(thresholdProbeText);
  if (deliveredReflection) {
    registerDeliveredReflection(deps.deliveredReflectionRegistryRef, 'm4_grudge_to_threshold', deliveredReflection, {
      interviewSessionId: deps.interviewSessionIdRef.current,
      source: 'post_claude_m4_threshold_forced_probe',
    });
  }
  deps.moment4ThresholdProbeAskedRef.current = true;
  const relationshipEval = evaluateMoment4RelationshipType(params.trimmed);
  void remoteLog('[M4_THRESHOLD_FORCED]', {
    injectedCommitmentFollowUp: true,
    moment4CommitmentFollowUpConditionMet: true,
    relationshipTypeDiagnosticOnly: relationshipEval.relationshipType,
    moment4ThresholdHintInAnswer: params.moment4ThresholdHintInAnswer,
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  });
}
