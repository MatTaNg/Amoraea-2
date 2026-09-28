import { wrapForcedProbeWithAck } from '@features/aria/interviewAssistantReflection';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import {
  applyInterviewCanonicalProbeSideEffects,
  commitInterviewCanonicalProbeTranscriptTurn,
} from '@features/aria/interviewCanonicalProbeDeliveryShared';
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { getCanonicalProbeText } from '@features/aria/interviewCanonicalProbeRegistry';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { shouldDeliverScenarioFollowUpQuestion } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { remoteLog } from '@utilities/remoteLog';

/** Post-Claude forced probe delivery — shared cookbook for verbatim registry probes. */
export async function deliverPostClaudeForcedCanonicalProbe(args: {
  deps: PostClaudeAssistantTurnDeps;
  params: PostClaudeAssistantTurnParams;
  stagedMessages: PostClaudeInterviewMessage[];
  probeId: InterviewCanonicalProbeId;
  strippedText?: string;
  recentAsstForAck?: readonly string[];
  speakAssistantTurn?: PostClaudeSpeakAssistantTurn;
  probeTextOverride?: string;
  ttsTextOverride?: string;
  skipAckWrap?: boolean;
  respectTranscriptDedup?: boolean;
  skipSpeak?: boolean;
  forceSpeakDespiteParallelStream?: boolean;
  useSpeakTextSafe?: boolean;
  logTag: string;
}): Promise<PostClaudeInterviewMessage[]> {
  const canonicalText = args.probeTextOverride ?? getCanonicalProbeText(args.probeId);
  const probeText = args.skipAckWrap
    ? canonicalText
    : wrapForcedProbeWithAck(
        args.params.trimmed,
        args.strippedText ?? '',
        canonicalText,
        args.recentAsstForAck ?? [],
      );
  const liveTranscript = (args.deps.currentMessagesRef.current.length > 0
    ? args.deps.currentMessagesRef.current
    : args.stagedMessages) as PostClaudeInterviewMessage[];

  const shouldCommit =
    !args.respectTranscriptDedup ||
    shouldDeliverScenarioFollowUpQuestion(args.stagedMessages, canonicalText);
  let nextMessages = args.stagedMessages;
  if (shouldCommit) {
    nextMessages = commitInterviewCanonicalProbeTranscriptTurn({
      liveTranscript,
      stagedMessages: args.stagedMessages,
      probeText,
      probeId: args.probeId,
      interviewMomentOverride: args.deps.currentInterviewMomentRef.current,
      setMessages: (next) => args.deps.setMessages(next),
      scenarioNumberOverride: args.deps.resolveAssistantScenarioNumber(probeText, args.stagedMessages),
    });
    applyInterviewCanonicalProbeSideEffects(args.deps, args.probeId, probeText);
  }

  void remoteLog(args.logTag, {
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    probeId: args.probeId,
    preview: probeText.slice(0, 220),
    committed: shouldCommit,
  });

  if (!args.skipSpeak) {
    const ttsText = args.ttsTextOverride ?? probeText;
    const speakOptions = {
      ...ASSISTANT_INTERVIEW_SPEECH,
      ...(args.forceSpeakDespiteParallelStream ? { forceSpeakDespiteParallelStream: true } : {}),
    };
    if (args.useSpeakTextSafe || !args.speakAssistantTurn) {
      await args.deps.speakTextSafe(ttsText, speakOptions);
    } else {
      await args.speakAssistantTurn(ttsText, speakOptions);
    }
  }

  return nextMessages;
}
