import { moment5AnswerIncludesResolutionOutcome } from '@features/aria/elongatingProbe';
import type { PreClaudeMoment5AccountabilityEvalContext } from '@features/aria/buildPreClaudeMoment5AccountabilityEvalContext';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import { countInterviewWords } from '@features/aria/moment4SpecificityFollowUp';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeMoment5AssistantInject,
  moment5ScenarioNumber,
  type PreClaudeMoment5AccountabilityInjectGatesResult,
} from '@features/aria/preClaudeMoment5AccountabilityInjectShared';
import {
  isMoment5AssistantAnchor,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5ResolutionFollowUpPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import { markMoment5ResolutionFollowUpTtsDelivered } from '@features/aria/moment5DeliveryReconcile';
import { remoteLog } from '@utilities/remoteLog';

export async function runPreClaudeMoment5ResolutionFollowUpGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  lastInterviewerContent: string,
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult | null> {
  if (
    !ctx.moment5AccountabilityProbeCandidate ||
    ctx.moment5PushbackAlreadyGaveSpecificExample ||
    deps.moment5ResolutionFollowUpIssuedRef.current ||
    ctx.resolutionFollowUpAlreadyInTranscript ||
    looksLikeMoment5ResolutionFollowUpPrompt(lastInterviewerContent) ||
    moment5AnswerIncludesResolutionOutcome(ctx.moment5CombinedUserText || trimmed) ||
    !(
      ctx.moment5NarrativeConcreteIncludingCurrent ||
      deps.moment5SpecificityRedirectIssuedRef.current ||
      ctx.specificityRedirectAlreadyInTranscript
    ) ||
    !(
      isMoment5AssistantAnchor(lastInterviewerContent) ||
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(lastInterviewerContent) ||
      looksLikeMoment5SpecificityRedirectPrompt(lastInterviewerContent) ||
      looksLikeMoment5ConflictValidityClarificationPrompt(lastInterviewerContent)
    )
  ) {
    return null;
  }

  deps.moment5ResolutionFollowUpIssuedRef.current = true;
  void remoteLog('[M5_RESOLUTION_FOLLOWUP_ISSUED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });
  const resolutionFollowUpMsg: MessageWithScenario = {
    role: 'assistant',
    content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
    scenarioNumber: moment5ScenarioNumber(deps),
  };
  deps.setMessages([...messagesToUse, resolutionFollowUpMsg]);
  markMoment5ResolutionFollowUpTtsDelivered(deps);
  await deps.speakTextSafe(MOMENT_5_RESOLUTION_FOLLOWUP_TEXT, ASSISTANT_INTERVIEW_SPEECH);
  return finishPreClaudeMoment5AssistantInject(deps, ctx.moment5CombinedUserText);
}
