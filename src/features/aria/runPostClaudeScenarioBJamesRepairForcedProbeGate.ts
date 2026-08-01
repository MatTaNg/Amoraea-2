import { extractLeadingBriefScenarioAck } from '@features/aria/interviewReflectionAckVariation';
import { deliverPostClaudeForcedCanonicalProbe } from '@features/aria/deliverPostClaudeForcedCanonicalProbe';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
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
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBQ1Question,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
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
  const leadInIsWrongBeatQuestion =
    !!strippedText &&
    !leadInIsBriefAckOnly &&
    (looksLikeScenarioBJamesDifferentlyQuestion(strippedText) ||
      looksLikeScenarioBQ1Question(strippedText));
  let stagedMessages = params.messagesToUse;
  if (strippedText && !repairParaphraseOnly && !leadInIsBriefAckOnly && !leadInIsWrongBeatQuestion) {
    stagedMessages = await stageAndSpeakForcedConstructProbeLeadIn(
      deps,
      params,
      strippedText,
      speakAssistantTurn,
    );
  } else if (leadInIsWrongBeatQuestion) {
    void remoteLog('[S2_JAMES_REPAIR_FORCED_DISCARDED_WRONG_BEAT_LEADIN]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: strippedText.slice(0, 220),
    });
  }

  const leadAck = leadInIsBriefAckOnly
    ? (extractLeadingBriefScenarioAck(strippedText) ?? strippedText.replace(/[.!?…]+\s*$/, ''))
    : null;
  const repairProbeText = leadAck
    ? `${leadAck}. ${SCENARIO_B_JAMES_REPAIR_CANONICAL}`
    : SCENARIO_B_JAMES_REPAIR_CANONICAL;

  await deliverPostClaudeForcedCanonicalProbe({
    deps,
    params,
    stagedMessages,
    probeId: 's2_james_repair',
    strippedText,
    recentAsstForAck,
    speakAssistantTurn,
    probeTextOverride: repairProbeText,
    forceSpeakDespiteParallelStream: true,
    logTag: '[S2_JAMES_REPAIR_FORCED]',
  });

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
