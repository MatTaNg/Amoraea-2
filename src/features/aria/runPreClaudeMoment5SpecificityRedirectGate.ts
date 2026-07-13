import { moment5AnswerIncludesResolutionOutcome } from '@features/aria/elongatingProbe';
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
import {
  MOMENT_5_SPECIFICITY_REDIRECT_TEXT,
  shouldInjectMoment5SpecificityRedirect,
} from '@features/aria/probeAndScoringUtils';
import { remoteLog } from '@utilities/remoteLog';

export function ackPreClaudeMoment5SpecificityPushbackIfNeeded(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): void {
  if (!ctx.moment5AccountabilityProbeCandidate || !ctx.moment5PushbackAlreadyGaveSpecificExample) {
    return;
  }

  deps.moment5SpecificityRedirectIssuedRef.current = true;
  if (moment5AnswerIncludesResolutionOutcome(ctx.moment5CombinedUserText || trimmed)) {
    deps.moment5ResolutionFollowUpIssuedRef.current = true;
  }
  deps.moment5ClientScoringMetaRef.current = {
    ...(deps.moment5ClientScoringMetaRef.current ?? {}),
    specificityRedirectIssued: true,
    accountabilityProbeFired: deps.moment5ClientScoringMetaRef.current?.accountabilityProbeFired ?? false,
  };
  void remoteLog('[M5_SPECIFICITY_PUSHBACK_ACK]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
    resolution_already_covered: moment5AnswerIncludesResolutionOutcome(ctx.moment5CombinedUserText || trimmed),
  });
}

async function injectPreClaudeMoment5SpecificityRedirect(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  ctx: PreClaudeMoment5AccountabilityEvalContext,
  path: 'pre_api_thin_or_abstract' | 'accountability_probe_gate',
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult> {
  deps.moment5SpecificityRedirectIssuedRef.current = true;
  deps.moment5ClientScoringMetaRef.current = {
    ...(deps.moment5ClientScoringMetaRef.current ?? {}),
    accountabilityProbeFired: false,
    specificityRedirectIssued: true,
    conflictValidityClarificationFired: true,
  };
  void remoteLog('[M5_SPECIFICITY_REDIRECT_ISSUED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    path,
    probe_reason: path === 'pre_api_thin_or_abstract' ? ctx.moment5AccountabilityEval.reason : undefined,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });
  const redirectStaged = appendAssistantTurn(messagesToUse, MOMENT_5_SPECIFICITY_REDIRECT_TEXT, {
    scenarioNumber: moment5ScenarioNumber(deps),
  });
  deps.setMessages(redirectStaged);
  await deps.speakTextSafe(MOMENT_5_SPECIFICITY_REDIRECT_TEXT, ASSISTANT_INTERVIEW_SPEECH);
  return finishPreClaudeMoment5AssistantInject(deps, ctx.moment5CombinedUserText);
}

export async function runPreClaudeMoment5SpecificityRedirectGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult | null> {
  ackPreClaudeMoment5SpecificityPushbackIfNeeded(deps, trimmed, ctx);

  if (
    !ctx.moment5AccountabilityProbeCandidate ||
    ctx.moment5PushbackAlreadyGaveSpecificExample ||
    ctx.moment5AnsweringAfterResolutionFollowUp ||
    ctx.resolutionFollowUpAlreadyInTranscript ||
    deps.moment5ResolutionFollowUpIssuedRef.current ||
    !shouldInjectMoment5SpecificityRedirect({
      userText: trimmed,
      narrativeConcrete:
        ctx.moment5NarrativeConcreteIncludingCurrent || ctx.moment5NarrativeConcrete,
      answeringAfterSpecificityRedirect: ctx.moment5AnsweringAfterSpecificityRedirect,
      specificityRedirectIssued: deps.moment5SpecificityRedirectIssuedRef.current,
      specificityRedirectInTranscript: ctx.specificityRedirectAlreadyInTranscript,
    })
  ) {
    return null;
  }

  return injectPreClaudeMoment5SpecificityRedirect(deps, trimmed, messagesToUse, ctx, 'pre_api_thin_or_abstract');
}

export async function runPreClaudeMoment5AccountabilityGateSpecificityRedirect(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult | null> {
  if (
    ctx.moment5NarrativeConcreteIncludingCurrent ||
    ctx.moment5AnsweringAfterSpecificityRedirect ||
    ctx.moment5AnsweringAfterResolutionFollowUp ||
    ctx.resolutionFollowUpAlreadyInTranscript ||
    deps.moment5ResolutionFollowUpIssuedRef.current ||
    deps.moment5SpecificityRedirectIssuedRef.current ||
    ctx.specificityRedirectAlreadyInTranscript
  ) {
    return null;
  }

  return injectPreClaudeMoment5SpecificityRedirect(deps, trimmed, messagesToUse, ctx, 'accountability_probe_gate');
}
