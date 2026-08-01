import { deliverPostClaudeForcedCanonicalProbe } from '@features/aria/deliverPostClaudeForcedCanonicalProbe';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  finishPostClaudeForcedConstructProbeGate,
  forcedConstructProbeStrippedTextIsBriefAckOnly,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import {
  isScenarioCRepairAssistantPrompt,
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
  scenarioCRepairConstructStillPending,
} from '@features/aria/scenarioCPromptDetection';
import {
  clearS3RepairProbeDeliveredRefIfFalsePositive,
  isS3RepairProbeAudiblyDelivered,
  markS3RepairProbeTtsDelivered,
} from '@features/aria/scenarioCDeliveryReconcile';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { remoteLog } from '@utilities/remoteLog';

async function deliverS3RepairForcedProbe(args: {
  deps: PostClaudeAssistantTurnDeps;
  params: PostClaudeAssistantTurnParams;
  speakAssistantTurn?: PostClaudeSpeakAssistantTurn;
  skipSpeak?: boolean;
  logTag: string;
}): Promise<void> {
  await deliverPostClaudeForcedCanonicalProbe({
    deps: args.deps,
    params: args.params,
    stagedMessages: args.params.messagesToUse,
    probeId: 's3_repair',
    skipAckWrap: true,
    respectTranscriptDedup: true,
    skipSpeak: args.skipSpeak,
    speakAssistantTurn: args.speakAssistantTurn,
    forceSpeakDespiteParallelStream: true,
    logTag: args.logTag,
  });
  markS3RepairProbeTtsDelivered(args.deps);
}

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
    (assistantTurnIsElongatingProbeOnly &&
      !forcedConstructProbeStrippedTextIsBriefAckOnly(strippedText))
  ) {
    return null;
  }

  const clearedFalsePositive = clearS3RepairProbeDeliveredRefIfFalsePositive(
    deps,
    params.messagesToUse,
  );
  const streamAlreadySpokeRepair = isScenarioCRepairAssistantPrompt(
    deps.parallelStreamingTtsRef.current.spokenCompleteText,
  );
  const alreadyDeliveredToTts = isS3RepairProbeAudiblyDelivered(deps, params.messagesToUse);

  /**
   * Parallel stream often speaks repair before the assistant turn is committed to transcript.
   * When repair is already satisfied in transcript, return null so later M4 handoff speech can run.
   * When the delivery ref was set optimistically but audio never played, clear it and speak below.
   */
  if (alreadyDeliveredToTts) {
    if (!repairStillPending) {
      return null;
    }
    await deliverS3RepairForcedProbe({
      deps,
      params,
      skipSpeak: true,
      logTag: '[S3_REPAIR_FORCED_SKIPPED_STREAM_ALREADY_SPOKE]',
    });
    void remoteLog('[S3_REPAIR_FORCED_SKIPPED_STREAM_ALREADY_SPOKE]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      deliveredRef: deps.s3RepairProbeDeliveredRef.current,
      streamSpokeRepair: streamAlreadySpokeRepair,
      clearedFalsePositive,
      spokenPreview: deps.parallelStreamingTtsRef.current.spokenCompleteText.slice(0, 220),
    });
    return finishPostClaudeForcedConstructProbeGate(deps, {
      strippedText,
      scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
      needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
    });
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

  await deliverS3RepairForcedProbe({
    deps,
    params,
    speakAssistantTurn,
    logTag: '[S3_REPAIR_FORCED]',
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
