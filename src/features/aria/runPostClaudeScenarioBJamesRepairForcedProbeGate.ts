import { wrapForcedProbeWithAck } from '@features/aria/interviewAssistantReflection';
import { extractLeadingBriefScenarioAck } from '@features/aria/interviewReflectionAckVariation';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  finishPostClaudeForcedConstructProbeGate,
  forcedConstructProbeStrippedTextIsBriefAckOnly,
  stageAndSpeakForcedConstructProbeLeadIn,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import {
  looksLikeScenarioBRepairAsJamesQuestion,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { remoteLog } from '@utilities/remoteLog';

export async function runPostClaudeScenarioBJamesRepairForcedProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  draft: ForcedConstructProbeContext,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  jamesState: Pick<
    PostClaudeForcedConstructProbeGatesResult,
    'scenarioBSkippedJamesIntermediate' | 'needsScenarioBJamesDifferentlyInsert'
  >,
): Promise<PostClaudeForcedConstructProbeGatesResult | null> {
  const strippedText = draft.strippedText;
  const { recentAsstForAck, assistantTurnIsElongatingProbeOnly } = draft;

  if (
    !params.shouldForceScenarioBJamesRepairProbe ||
    deps.s2RepairProbeDeliveredRef.current ||
    assistantTurnIsElongatingProbeOnly ||
    looksLikeScenarioBRepairAsJamesQuestion(strippedText.trim())
  ) {
    return null;
  }

  if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_B_JAMES_REPAIR_CANONICAL)) {
    void remoteLog('[S2_JAMES_REPAIR_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

  const repairParaphraseOnly =
    !!strippedText && looksLikeScenarioBRepairAsJamesQuestion(strippedText.trim());
  const leadInIsBriefAckOnly = forcedConstructProbeStrippedTextIsBriefAckOnly(strippedText);
  let stagedMessages = params.messagesToUse;
  if (strippedText && !repairParaphraseOnly && !leadInIsBriefAckOnly) {
    stagedMessages = await stageAndSpeakForcedConstructProbeLeadIn(
      deps,
      params,
      strippedText,
      speakAssistantTurn,
    );
  }

  const leadAck = leadInIsBriefAckOnly
    ? (extractLeadingBriefScenarioAck(strippedText) ?? strippedText.replace(/[.!?…]+\s*$/, ''))
    : null;
  const repairProbeText = leadAck
    ? `${leadAck}. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`
    : SCENARIO_B_JAMES_REPAIR_CANONICAL;
  const wrappedRepair = wrapForcedProbeWithAck(
    params.trimmed,
    strippedText,
    repairProbeText,
    recentAsstForAck,
  );
  const repairMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: wrappedRepair,
    scenarioNumber: deps.resolveAssistantScenarioNumber(wrappedRepair, stagedMessages),
  };
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : stagedMessages) as PostClaudeInterviewMessage[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    stagedMessages,
    wrappedRepair,
    {
      scenarioNumber: repairMsg.scenarioNumber,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  await speakAssistantTurn(wrappedRepair, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    forceSpeakDespiteParallelStream: true,
  });
  deps.s2RepairProbeDeliveredRef.current = true;
  void remoteLog('[S2_JAMES_REPAIR_FORCED]', {
    injectedRepairQ3: true,
    strippedPreview: strippedText.slice(0, 220),
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: false,
  });
}

