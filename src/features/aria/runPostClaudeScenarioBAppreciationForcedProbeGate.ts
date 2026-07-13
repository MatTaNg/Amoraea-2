import { wrapForcedProbeWithAck } from '@features/aria/interviewAssistantReflection';
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

const FORCED_SCENARIO_B_APPRECIATION_PROBE =
  "What do you think James could've done differently so Sarah feels better?";

export async function runPostClaudeScenarioBAppreciationForcedProbeGate(
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
  const { recentAsstForAck, assistantIssuedScenarioBFullProbe, assistantTurnIsElongatingProbeOnly } = draft;

  if (
    !params.shouldForceScenarioBFullAppreciationProbe ||
    assistantIssuedScenarioBFullProbe ||
    assistantTurnIsElongatingProbeOnly ||
    text.includes('[INTERVIEW_COMPLETE]')
  ) {
    return null;
  }

  if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, FORCED_SCENARIO_B_APPRECIATION_PROBE)) {
    void remoteLog('[S2_APPRECIATION_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

  const leadInText = forcedConstructProbeStrippedTextIsBriefAckOnly(strippedText) ? strippedText : '';
  const stagedMessages = leadInText
    ? await stageAndSpeakForcedConstructProbeLeadIn(deps, params, leadInText, speakAssistantTurn)
    : params.messagesToUse;
  if (__DEV__) {
    console.log('[S2_APPRECIATION_FORCED]', {
      sidedEntirelyWithJames: params.sidedEntirelyWithJames,
      scenarioBQ1Engaged: params.scenarioBQ1Engaged,
      assistantIssuedScenarioBFullProbe,
    });
  }
  void remoteLog('[S2_APPRECIATION_FORCED]', {
    sidedEntirelyWithJames: params.sidedEntirelyWithJames,
    scenarioBQ1Engaged: params.scenarioBQ1Engaged,
    assistantIssuedScenarioBFullProbe,
  });
  const wrappedAppreciationProbe = wrapForcedProbeWithAck(
    params.trimmed,
    strippedText,
    FORCED_SCENARIO_B_APPRECIATION_PROBE,
    recentAsstForAck,
  );
  const probeMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: wrappedAppreciationProbe,
    scenarioNumber: deps.resolveAssistantScenarioNumber(wrappedAppreciationProbe, stagedMessages),
  };
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : stagedMessages) as PostClaudeInterviewMessage[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    stagedMessages,
    wrappedAppreciationProbe,
    {
      scenarioNumber: probeMsg.scenarioNumber,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  await deps.speakTextSafe(wrappedAppreciationProbe, ASSISTANT_INTERVIEW_SPEECH);

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: false,
    needsScenarioBJamesDifferentlyInsert: false,
  });
}
