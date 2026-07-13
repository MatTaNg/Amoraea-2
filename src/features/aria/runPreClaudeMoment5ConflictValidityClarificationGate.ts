import type { PreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { countInterviewWords } from '@features/aria/moment4SpecificityFollowUp';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeMoment5AssistantInject,
  moment5ScenarioNumber,
  persistMoment5AssistantInject,
  type PreClaudeMoment5AccountabilityInjectGatesResult,
} from '@features/aria/preClaudeMoment5AccountabilityInjectShared';
import { MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT } from '@features/aria/probeAndScoringUtils';
import { remoteLog } from '@utilities/remoteLog';

export async function runPreClaudeMoment5ConflictValidityClarificationGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult | null> {
  if (
    !ctx.moment5AccountabilityProbeCandidate ||
    !ctx.moment5LowConflictValidity ||
    !ctx.moment5NarrativeConcrete ||
    ctx.moment5AnsweringAfterConflictValidityClarification ||
    deps.moment5ConflictValidityClarificationIssuedRef.current ||
    deps.moment5ResolutionFollowUpIssuedRef.current ||
    ctx.resolutionFollowUpAlreadyInTranscript
  ) {
    return null;
  }

  deps.moment5ConflictValidityClarificationIssuedRef.current = true;
  deps.moment5ClientScoringMetaRef.current = {
    ...(deps.moment5ClientScoringMetaRef.current ?? {}),
    accountabilityProbeFired: false,
    conflictValidityClarificationAsked: true,
  };
  void remoteLog('[M5_CONFLICT_VALIDITY_CLARIFICATION_ISSUED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    moment_5_clarification_fired: true,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });
  const clarificationMsg: MessageWithScenario = {
    role: 'assistant',
    content: MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT,
    scenarioNumber: moment5ScenarioNumber(deps),
  };
  deps.setMessages([...messagesToUse, clarificationMsg]);
  await persistMoment5AssistantInject(deps, messagesToUse, clarificationMsg, {
    moment_5_clarification_fired: true,
  });
  await deps.speakTextSafe(MOMENT_5_CONFLICT_VALIDITY_CLARIFICATION_TEXT, ASSISTANT_INTERVIEW_SPEECH);
  return finishPreClaudeMoment5AssistantInject(deps, ctx.moment5CombinedUserText);
}
