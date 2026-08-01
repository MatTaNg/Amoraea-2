import { userTurnSuppressesElongatingProbe } from '@features/aria/elongatingProbe';
import { deliverPostClaudeForcedCanonicalProbe } from '@features/aria/deliverPostClaudeForcedCanonicalProbe';
import { getCanonicalProbeText } from '@features/aria/interviewCanonicalProbeRegistry';
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
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { looksLikeScenarioCSophiePerspectiveQuestion } from '@features/aria/scenarioCPromptDetection';
import { remoteLog } from '@utilities/remoteLog';

export async function runPostClaudeScenarioCSophieForcedProbeGate(
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
  const sophieProbe = getCanonicalProbeText('s3_sophie_perspective');

  const elongatingOnlyDraftBlocksSophieInject =
    assistantTurnIsElongatingProbeOnly &&
    !(params.elongatingSuppressedForUserTurn && userTurnSuppressesElongatingProbe(params.trimmed));

  if (
    !params.shouldForceScenarioCSophiePerspectiveProbe ||
    deps.scenarioCSophiePerspectiveProbeFiredRef.current ||
    elongatingOnlyDraftBlocksSophieInject
  ) {
    return null;
  }

  const streamAlreadySpokeSophie =
    deps.parallelStreamingTtsRef.current.s3SophiePerspectiveProbeDeliveredThisStream ||
    looksLikeScenarioCSophiePerspectiveQuestion(
      deps.parallelStreamingTtsRef.current.spokenCompleteText,
    );

  if (
    !shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, sophieProbe) ||
    streamAlreadySpokeSophie
  ) {
    deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
    if (streamAlreadySpokeSophie) {
      await deliverPostClaudeForcedCanonicalProbe({
        deps,
        params,
        stagedMessages: params.messagesToUse,
        probeId: 's3_sophie_perspective',
        strippedText,
        recentAsstForAck,
        skipSpeak: true,
        logTag: '[S3_SOPHIE_FORCED_SKIPPED_STREAM_ALREADY_SPOKE]',
      });
      void remoteLog('[S3_SOPHIE_FORCED_SKIPPED_STREAM_ALREADY_SPOKE]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        deliveredThisStream:
          deps.parallelStreamingTtsRef.current.s3SophiePerspectiveProbeDeliveredThisStream,
        spokenPreview: deps.parallelStreamingTtsRef.current.spokenCompleteText.slice(0, 220),
      });
      return finishPostClaudeForcedConstructProbeGate(deps, {
        strippedText,
        scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
        needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
      });
    }
    void remoteLog('[S3_SOPHIE_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

  const leadInText = forcedConstructProbeStrippedTextIsBriefAckOnly(strippedText) ? strippedText : '';
  const stagedMessages = leadInText
    ? await stageAndSpeakForcedConstructProbeLeadIn(deps, params, leadInText, speakAssistantTurn)
    : params.messagesToUse;

  await deliverPostClaudeForcedCanonicalProbe({
    deps,
    params,
    stagedMessages,
    probeId: 's3_sophie_perspective',
    strippedText,
    recentAsstForAck,
    speakAssistantTurn,
    forceSpeakDespiteParallelStream: true,
    logTag: '[S3_SOPHIE_FORCED]',
  });

  void remoteLog('[S3_SOPHIE_FORCED]', {
    injectedSophiePerspective: true,
    strippedPreview: strippedText.slice(0, 220),
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  });
}
