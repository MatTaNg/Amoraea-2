import { wrapForcedProbeWithAck } from '@features/aria/interviewAssistantReflection';
import {
  applyInterviewCanonicalProbeSideEffects,
  commitInterviewCanonicalProbeTranscriptTurn,
} from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { getCanonicalProbeText } from '@features/aria/interviewCanonicalProbeRegistry';
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
import { remoteLog } from '@utilities/remoteLog';

export async function runPostClaudeScenarioAContemptForcedProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  draft: ForcedConstructProbeContext,
  parallelStreamingPlaybackUsed: boolean,
  _speakAssistantTurn: PostClaudeSpeakAssistantTurn,
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

  const forcedContemptProbe = getCanonicalProbeText('s1_contempt');
  if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, forcedContemptProbe)) {
    deps.scenarioAContemptProbeAskedRef.current = true;
    void remoteLog('[S1_CONTEMPT_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

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

  const wrappedContemptProbe = wrapForcedProbeWithAck(
    params.trimmed,
    strippedText,
    forcedContemptProbe,
    recentAsstForAck,
  );
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : stagedMessages) as PostClaudeInterviewMessage[];

  commitInterviewCanonicalProbeTranscriptTurn({
    liveTranscript,
    stagedMessages,
    probeText: wrappedContemptProbe,
    probeId: 's1_contempt',
    interviewMomentOverride: deps.currentInterviewMomentRef.current,
    setMessages: (next) => deps.setMessages(next),
    scenarioNumberOverride: deps.resolveAssistantScenarioNumber(wrappedContemptProbe, stagedMessages),
  });
  applyInterviewCanonicalProbeSideEffects(deps, 's1_contempt', wrappedContemptProbe);

  const contemptProbePlaybackConfirmed =
    deps.scenarioAContemptProbePlaybackConfirmedRef.current ||
    deps.scenarioAContemptProbeTtsDeliveredSessionRef.current;
  if (!contemptProbePlaybackConfirmed) {
    deps.setReferenceCardPrompt(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
    await deps.speakTextSafe(SCENARIO_A_CONTEMPT_PROBE_TTS_SPOKEN_COPY, ASSISTANT_INTERVIEW_SPEECH);
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
