import type { PreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { appendAssistantTurn } from '@features/aria/interviewTranscriptTurns';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { countInterviewWords } from '@features/aria/moment4SpecificityFollowUp';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeMoment5AssistantInject,
  moment5ScenarioNumber,
  type PreClaudeMoment5AccountabilityInjectGatesResult,
} from '@features/aria/preClaudeMoment5AccountabilityInjectShared';
import { MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT } from '@features/aria/probeAndScoringUtils';
import { remoteLog } from '@utilities/remoteLog';

export async function runPreClaudeMoment5PersistentAbstractMoveOnGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult | null> {
  if (
    !ctx.moment5AccountabilityProbeCandidate ||
    ctx.moment5NarrativeConcrete ||
    !ctx.moment5AnsweringAfterSpecificityRedirect ||
    !deps.moment5SpecificityRedirectIssuedRef.current ||
    ctx.moment5AccountabilityEval.reason !== 'decline_or_vague_evade'
  ) {
    return null;
  }

  deps.moment5ClientScoringMetaRef.current = {
    ...(deps.moment5ClientScoringMetaRef.current ?? {}),
    accountabilityProbeFired: false,
    specificityRedirectIssued: true,
    persistentAbstractionMoveOn: true,
  };
  void remoteLog('[M5_PERSISTENT_ABSTRACT_MOVE_ON]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    reason: 'decline_after_specificity_redirect',
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });
  deps.setMessages(
    appendAssistantTurn(messagesToUse, MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT, {
      scenarioNumber: moment5ScenarioNumber(deps),
    }),
  );
  await deps.speakTextSafe(MOMENT_5_PERSISTENT_ABSTRACT_MOVE_ON_TEXT, ASSISTANT_INTERVIEW_SPEECH);
  return finishPreClaudeMoment5AssistantInject(deps, ctx.moment5CombinedUserText);
}
