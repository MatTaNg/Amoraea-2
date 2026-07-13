import { wrapForcedProbeWithAck } from '@features/aria/interviewAssistantReflection';
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

  if (
    !params.shouldForceScenarioCSophiePerspectiveProbe ||
    deps.scenarioCSophiePerspectiveProbeFiredRef.current ||
    assistantTurnIsElongatingProbeOnly
  ) {
    return null;
  }

  if (
    !shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE)
  ) {
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
