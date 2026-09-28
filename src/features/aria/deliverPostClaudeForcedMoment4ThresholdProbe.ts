import {
  buildMoment4ThresholdProbeWithReflection,
  evaluateMoment4RelationshipType,
} from '@features/aria/moment4ProbeLogic';
import {
  extractLeadingReflectionFromMoment4ThresholdProbe,
  registerDeliveredReflection,
} from '@features/aria/deliveredReflectionRegistry';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { applyMoment4ThresholdReferenceCard } from '@features/aria/interviewReferenceCardResumeHelpers';
import { resolveMoment4GrudgeAnswerForThresholdReflection } from '@features/aria/moment4SpecificityFollowUp';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { applyInterviewCanonicalProbeSideEffects } from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { remoteLog } from '@utilities/remoteLog';

/** Post-Claude M4 threshold forced probe — shares reflection builder with pre-Claude delivery. */
export async function deliverPostClaudeForcedMoment4ThresholdProbe(args: {
  deps: PostClaudeAssistantTurnDeps;
  params: PostClaudeAssistantTurnParams;
  stagedMessages: PostClaudeInterviewMessage[];
  speakAssistantTurn: PostClaudeSpeakAssistantTurn;
  logTag: string;
}): Promise<PostClaudeInterviewMessage[]> {
  const grudgeAnswerForReflection = resolveMoment4GrudgeAnswerForThresholdReflection(
    args.params.messagesToUse,
    args.params.trimmed,
  );
  const thresholdProbeText = buildMoment4ThresholdProbeWithReflection(grudgeAnswerForReflection, {
    deliveredRegistry: args.deps.deliveredReflectionRegistryRef.current,
    moment4Transcript: args.params.messagesToUse,
  });

  const combinedMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: thresholdProbeText,
    scenarioNumber: args.deps.resolveAssistantScenarioNumber(thresholdProbeText, args.stagedMessages),
  };
  const nextMessages = [...args.stagedMessages, combinedMsg];
  args.deps.setMessages(nextMessages);
  applyMoment4ThresholdReferenceCard(args.deps);
  await args.speakAssistantTurn(thresholdProbeText, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    forceSpeakDespiteParallelStream: true,
  });

  const deliveredReflection = extractLeadingReflectionFromMoment4ThresholdProbe(thresholdProbeText);
  if (deliveredReflection) {
    registerDeliveredReflection(
      args.deps.deliveredReflectionRegistryRef,
      'm4_grudge_to_threshold',
      deliveredReflection,
      {
        interviewSessionId: args.deps.interviewSessionIdRef.current,
        source: 'post_claude_m4_threshold_forced_probe',
      },
    );
  }

  applyInterviewCanonicalProbeSideEffects(args.deps, 'm4_commitment_threshold', thresholdProbeText);

  const relationshipEval = evaluateMoment4RelationshipType(args.params.trimmed);
  void remoteLog(args.logTag, {
    injectedCommitmentFollowUp: true,
    moment4CommitmentFollowUpConditionMet: true,
    relationshipTypeDiagnosticOnly: relationshipEval.relationshipType,
    moment4ThresholdHintInAnswer: args.params.moment4ThresholdHintInAnswer,
  });

  return nextMessages;
}
