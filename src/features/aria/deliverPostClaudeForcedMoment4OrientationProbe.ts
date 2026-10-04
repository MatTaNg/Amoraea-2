import { MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN } from '@features/aria/moment4ProbeLogic';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { applyMoment4OrientationReferenceCard } from '@features/aria/interviewReferenceCardResumeHelpers';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { applyInterviewCanonicalProbeSideEffects } from '@features/aria/interviewCanonicalProbeDeliveryShared';
import { remoteLog } from '@utilities/remoteLog';

/** Post-Claude M4 orientation forced probe — mirrors threshold forced delivery. */
export async function deliverPostClaudeForcedMoment4OrientationProbe(args: {
  deps: PostClaudeAssistantTurnDeps;
  params: PostClaudeAssistantTurnParams;
  stagedMessages: PostClaudeInterviewMessage[];
  speakAssistantTurn: PostClaudeSpeakAssistantTurn;
  logTag: string;
}): Promise<PostClaudeInterviewMessage[]> {
  const orientationProbeText = MOMENT_4_COMMITMENT_ORIENTATION_FROM_GRUDGE_SPOKEN;
  const combinedMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: orientationProbeText,
    scenarioNumber: args.deps.resolveAssistantScenarioNumber(
      orientationProbeText,
      args.stagedMessages,
    ),
  };
  const nextMessages = [...args.stagedMessages, combinedMsg];
  args.deps.setMessages(nextMessages);
  applyMoment4OrientationReferenceCard(args.deps);
  await args.speakAssistantTurn(orientationProbeText, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    forceSpeakDespiteParallelStream: true,
  });

  applyInterviewCanonicalProbeSideEffects(
    args.deps,
    'm4_commitment_orientation',
    orientationProbeText,
  );

  void remoteLog(args.logTag, {
    injectedCommitmentOrientationFollowUp: true,
    moment4OrientationFollowUpConditionMet: true,
  });

  return nextMessages;
}
