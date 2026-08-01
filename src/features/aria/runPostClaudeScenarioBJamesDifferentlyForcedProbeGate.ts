import { buildPostClaudeProgressRefsPayload } from '@features/aria/buildPostClaudeProgressRefsPayload';
import { deliverPostClaudeForcedCanonicalProbe } from '@features/aria/deliverPostClaudeForcedCanonicalProbe';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
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
import { stripScenarioBRepairAsJamesQuestion } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL } from '@features/aria/scenarioBProbeLogic';
import { detectScenarioFromResponse } from '@features/aria/scenarioNumberDetection';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { remoteLog } from '@utilities/remoteLog';

export async function runPostClaudeScenarioBJamesDifferentlyForcedProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  draft: ForcedConstructProbeContext,
  parallelStreamingPlaybackUsed: boolean,
  jamesState: Pick<
    PostClaudeForcedConstructProbeGatesResult,
    'scenarioBSkippedJamesIntermediate' | 'needsScenarioBJamesDifferentlyInsert'
  >,
): Promise<PostClaudeForcedConstructProbeGatesResult | null> {
  const strippedText = draft.strippedText;
  const { recentAsstForAck } = draft;
  const { scenarioBSkippedJamesIntermediate, needsScenarioBJamesDifferentlyInsert } = jamesState;

  if (!needsScenarioBJamesDifferentlyInsert) {
    return null;
  }

  if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL)) {
    void remoteLog('[S2_JAMES_DIFF_FORCED_SKIPPED_TRANSCRIPT_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
    return null;
  }

  const repairStripped = stripScenarioBRepairAsJamesQuestion(strippedText).trim();
  const sophieLeakMiddle =
    (/i didn't know what to say/i.test(repairStripped) || /i didn't know how/i.test(repairStripped)) &&
    /sophie/i.test(repairStripped);
  const leaksScenarioCIntoLeadIn =
    /sophie and daniel/i.test(repairStripped) ||
    sophieLeakMiddle ||
    /\[scenario_complete:2\]/i.test(strippedText);
  const bLeadIn = leaksScenarioCIntoLeadIn || !repairStripped ? '' : repairStripped;
  let stagedMessages = params.messagesToUse;
  if (bLeadIn) {
    const detectedScenario = detectScenarioFromResponse(bLeadIn);
    if (detectedScenario !== null) {
      deps.currentScenarioRef.current = detectedScenario;
      void deps.notifyScenarioStarted(detectedScenario);
    }
    const scenarioNum = deps.resolveAssistantScenarioNumber(bLeadIn, params.messagesToUse);
    const liveTranscript = (deps.currentMessagesRef.current.length > 0
      ? deps.currentMessagesRef.current
      : params.messagesToUse) as PostClaudeInterviewMessage[];
    stagedMessages = commitDedupedAssistantTranscriptTurn(
      liveTranscript,
      params.messagesToUse,
      bLeadIn,
      { scenarioNumber: scenarioNum },
      (next) => deps.setMessages(next),
    );
    deps.applyInterviewProgressFromAssistantText(
      bLeadIn,
      buildPostClaudeProgressRefsPayload(deps),
    );
    if (!parallelStreamingPlaybackUsed) {
      await deps.speakTextSafe(bLeadIn, ASSISTANT_INTERVIEW_SPEECH);
    } else {
      void remoteLog('[S2_JAMES_DIFF_FORCED_SKIP_LEADIN_TTS]', {
        reason: 'parallel_streaming_already_spoke',
        preview: bLeadIn.slice(0, 200),
      });
    }
  }
  if (__DEV__) {
    console.log('[S2_JAMES_DIFF_FORCED]', {
      scenarioBQ1Engaged: params.scenarioBQ1Engaged,
      sidedEntirelyWithJames: params.sidedEntirelyWithJames,
    });
  }
  void remoteLog('[S2_JAMES_DIFF_FORCED]', {
    scenarioBQ1Engaged: params.scenarioBQ1Engaged,
    sidedEntirelyWithJames: params.sidedEntirelyWithJames,
    skipped_leadin_tts_due_to_parallel_streaming: parallelStreamingPlaybackUsed && !!bLeadIn,
  });

  await deliverPostClaudeForcedCanonicalProbe({
    deps,
    params,
    stagedMessages,
    probeId: 's2_james_differently',
    strippedText: bLeadIn || strippedText,
    recentAsstForAck,
    useSpeakTextSafe: true,
    logTag: '[S2_JAMES_DIFF_FORCED_DELIVER]',
  });

  return finishPostClaudeForcedConstructProbeGate(deps, {
    strippedText,
    scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert,
  });
}
