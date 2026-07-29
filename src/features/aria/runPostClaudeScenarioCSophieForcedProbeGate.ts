import { wrapForcedProbeWithAck } from '@features/aria/interviewAssistantReflection';
import { userTurnSuppressesElongatingProbe } from '@features/aria/elongatingProbe';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
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
  stageAndSpeakForcedConstructProbeLeadIn,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
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
    !shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE) ||
    streamAlreadySpokeSophie
  ) {
    deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
    if (streamAlreadySpokeSophie) {
      const wrappedSophieProbe = wrapForcedProbeWithAck(
        params.trimmed,
        strippedText,
        SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
        recentAsstForAck,
      );
      if (shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, wrappedSophieProbe)) {
        const liveTranscript = (deps.currentMessagesRef.current.length > 0
          ? deps.currentMessagesRef.current
          : params.messagesToUse) as PostClaudeInterviewMessage[];
        commitDedupedAssistantTranscriptTurn(
          liveTranscript,
          params.messagesToUse,
          wrappedSophieProbe,
          {
            scenarioNumber: deps.resolveAssistantScenarioNumber(wrappedSophieProbe, params.messagesToUse),
            interviewMoment: deps.currentInterviewMomentRef.current,
          },
          (next) => deps.setMessages(next),
        );
      }
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

  const wrappedSophieProbe = wrapForcedProbeWithAck(
    params.trimmed,
    strippedText,
    SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    recentAsstForAck,
  );
  const probeMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: wrappedSophieProbe,
    scenarioNumber: deps.resolveAssistantScenarioNumber(wrappedSophieProbe, stagedMessages),
  };
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : stagedMessages) as PostClaudeInterviewMessage[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    stagedMessages,
    wrappedSophieProbe,
    {
      scenarioNumber: probeMsg.scenarioNumber,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  deps.scenarioCSophiePerspectiveProbeFiredRef.current = true;
  await speakAssistantTurn(wrappedSophieProbe, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    forceSpeakDespiteParallelStream: true,
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
