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
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY,
} from '@features/aria/probeAndScoringUtils';
import { shouldDeliverScenarioFollowUpQuestion, transcriptContainsScenarioAContemptProbe } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { remoteLog } from '@utilities/remoteLog';

export async function runPostClaudeScenarioAContemptForcedProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  draft: ForcedConstructProbeContext,
  parallelStreamingPlaybackUsed: boolean,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  jamesState: Pick<
    PostClaudeForcedConstructProbeGatesResult,
    'scenarioBSkippedJamesIntermediate' | 'needsScenarioBJamesDifferentlyInsert'
  >,
): Promise<PostClaudeForcedConstructProbeGatesResult | null> {
  const strippedText = draft.strippedText;
  const { recentAsstForAck, assistantIssuedScenarioAContemptProbe, assistantTurnIsElongatingProbeOnly } = draft;

  if (
    !params.shouldForceScenarioAContemptProbe ||
    deps.scenarioAContemptProbeAskedRef.current ||
    transcriptContainsScenarioAContemptProbe(params.messagesToUse) ||
    assistantIssuedScenarioAContemptProbe ||
    assistantTurnIsElongatingProbeOnly ||
    text.includes('[INTERVIEW_COMPLETE]')
  ) {
    return null;
  }

  const forcedContemptProbe = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
  if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, forcedContemptProbe)) {
    deps.scenarioAContemptProbeAskedRef.current = true;
    void remoteLog('[S1_CONTEMPT_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

  /** Forced contempt replaces the model draft — never speak incomplete paraphrase before canonical probe. */
  const stagedMessages = params.messagesToUse;
  if (__DEV__) {
    console.log('[S1_CONTEMPT_FORCED]', {
      specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
      assistantIssuedScenarioAContemptProbe,
    });
  }
  void remoteLog('[S1_CONTEMPT_FORCED]', {
    specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
    assistantIssuedScenarioAContemptProbe,
    contempt_probe_skipped: false,
  });
  deps.scenarioAContemptProbeAskedRef.current = true;
  const wrappedContemptProbe = wrapForcedProbeWithAck(
    params.trimmed,
    strippedText,
    forcedContemptProbe,
    recentAsstForAck,
  );
  const probeMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: wrappedContemptProbe,
    scenarioNumber: deps.resolveAssistantScenarioNumber(wrappedContemptProbe, stagedMessages),
  };
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : stagedMessages) as PostClaudeInterviewMessage[];
  commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    stagedMessages,
    wrappedContemptProbe,
    {
      scenarioNumber: probeMsg.scenarioNumber,
      interviewMoment: deps.currentInterviewMomentRef.current,
    },
    (next) => deps.setMessages(next),
  );
  const contemptProbePlaybackConfirmed =
    deps.scenarioAContemptProbePlaybackConfirmedRef.current ||
    deps.scenarioAContemptProbeTtsDeliveredSessionRef.current;
  if (!contemptProbePlaybackConfirmed) {
    if (deps.lastQuestionTextRef) {
      deps.lastQuestionTextRef.current = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
    }
    deps.setReferenceCardPrompt(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
    const probeTextForTts = SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY;
    await deps.speakTextSafe(probeTextForTts, ASSISTANT_INTERVIEW_SPEECH);
    deps.scenarioAContemptProbeTtsDeliveredSessionRef.current = true;
  } else {
    void remoteLog('[S1_CONTEMPT_FORCED_SKIP_TTS_ALREADY_STREAMED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: wrappedContemptProbe.slice(0, 200),
      parallelStreamingPlaybackUsed,
      playbackConfirmed: deps.scenarioAContemptProbePlaybackConfirmedRef.current,
      s1ContemptFixVersion: 16,
    });
  }

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  });
}
