import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  finishPostClaudeForcedConstructProbeGate,
  forcedConstructProbeStrippedTextIsBriefAckOnly,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import {
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  scenarioCRepairConstructStillPending,
} from '@features/aria/scenarioCPromptDetection';
import { markS3RepairProbeTtsDelivered } from '@features/aria/scenarioCDeliveryReconcile';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { remoteLog } from '@utilities/remoteLog';

export async function runPostClaudeScenarioCRepairForcedProbeGate(
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
  const { assistantTurnIsElongatingProbeOnly } = draft;
  const repairStillPending = scenarioCRepairConstructStillPending(params.messagesToUse);

  if (
    !params.shouldForceScenarioCRepairProbe ||
    (deps.s3RepairProbeDeliveredRef.current && !repairStillPending) ||
    (assistantTurnIsElongatingProbeOnly &&
      !forcedConstructProbeStrippedTextIsBriefAckOnly(strippedText))
  ) {
    return null;
  }

  if (
    !shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_C_REPAIR_QUESTION_CANONICAL) &&
    !repairStillPending
  ) {
    void remoteLog('[S3_REPAIR_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

  const repairMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    scenarioNumber: deps.resolveAssistantScenarioNumber(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
      params.messagesToUse,
    ),
  };
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : params.messagesToUse) as PostClaudeInterviewMessage[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    params.messagesToUse,
    SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    {
      scenarioNumber: repairMsg.scenarioNumber,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  markS3RepairProbeTtsDelivered(deps);
  await speakAssistantTurn(SCENARIO_C_REPAIR_QUESTION_CANONICAL, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    forceSpeakDespiteParallelStream: true,
  });
  void remoteLog('[S3_REPAIR_FORCED]', {
    injectedRepairQ2: true,
    strippedPreview: strippedText.slice(0, 220),
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  });
}

