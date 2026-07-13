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
import { runPreClaudeMoment5AccountabilityGateSpecificityRedirect } from '@features/aria/runPreClaudeMoment5SpecificityRedirectGate';
import {
  moment5ResponseContainsDeathDisclosure,
  moment5ResponseIsAbstract,
  moment5UserDeclinesConcreteReask,
  pickMoment5AccountabilityProbeSpokenText,
} from '@features/aria/probeAndScoringUtils';
import { supabase } from '@data/supabase/client';
import { remoteLog } from '@utilities/remoteLog';

export async function runPreClaudeMoment5AccountabilityProbeInjectGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
  messagesToUse: MessageWithScenario[],
  ctx: PreClaudeMoment5AccountabilityEvalContext,
): Promise<PreClaudeMoment5AccountabilityInjectGatesResult | null> {
  if (
    !ctx.moment5AccountabilityProbeCandidate ||
    ctx.moment5PushbackAlreadyGaveSpecificExample ||
    !(ctx.moment5AccountabilityEval.shouldProbe || ctx.moment5ForcedAbstractFollowupAccountabilityProbe)
  ) {
    return null;
  }

  const specificityRedirect = await runPreClaudeMoment5AccountabilityGateSpecificityRedirect(
    deps,
    trimmed,
    messagesToUse,
    ctx,
  );
  if (specificityRedirect) {
    return specificityRedirect;
  }

  if (ctx.moment5AnsweringAfterConflictValidityClarification && ctx.moment5AddsTensionDetailAfterClarification) {
    deps.moment5ClientScoringMetaRef.current = {
      ...(deps.moment5ClientScoringMetaRef.current ?? {}),
      accountabilityProbeFired: deps.moment5ClientScoringMetaRef.current?.accountabilityProbeFired ?? false,
      conflictValidityClarificationAsked: true,
      conflictValidity:
        deps.moment5ClientScoringMetaRef.current?.conflictValidity ??
        ctx.moment5ConflictValidityClassification ??
        'genuine_conflict',
    };
  }

  const moment5AnchoredAfterSpecificityRedirect =
    ctx.moment5AnsweringAfterSpecificityRedirect &&
    deps.moment5SpecificityRedirectIssuedRef.current &&
    (ctx.moment5NarrativeConcreteIncludingCurrent ||
      !moment5ResponseIsAbstract(ctx.moment5CombinedUserText || trimmed) ||
      moment5UserDeclinesConcreteReask(trimmed));

  if (
    moment5AnchoredAfterSpecificityRedirect &&
    !ctx.moment5AccountabilityEval.shouldProbe
  ) {
    deps.moment5ClientScoringMetaRef.current = {
      ...(deps.moment5ClientScoringMetaRef.current ?? { accountabilityProbeFired: false }),
      accountabilityProbeFired: deps.moment5ClientScoringMetaRef.current?.accountabilityProbeFired ?? false,
      conflictValidityClarificationFired: true,
      conflictValiditySecondResponseAbstract: false,
    };
    void remoteLog('[M5_ACCOUNTABILITY_PROBE_SKIPPED_POST_REDIRECT_ANCHORED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      wordCount: countInterviewWords(trimmed),
      preview: trimmed.slice(0, 200),
      should_probe_eval: ctx.moment5AccountabilityEval.shouldProbe,
      narrative_concrete: ctx.moment5NarrativeConcrete,
    });
    return null;
  }

  if (ctx.moment5SelfAccountabilityAlreadyEstablished) {
    void remoteLog('[M5_ACCOUNTABILITY_PROBE_SKIPPED_PRIOR_OWNERSHIP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      wordCount: countInterviewWords(trimmed),
      preview: trimmed.slice(0, 200),
      should_probe_eval: ctx.moment5AccountabilityEval.shouldProbe,
      combined_preview: ctx.moment5CombinedIncludingCurrent.slice(0, 260),
    });
    return null;
  }

  const deathDisclosureForProbe = moment5ResponseContainsDeathDisclosure(trimmed);
  const moment5AccountabilityProbeTriggerReason = ctx.moment5ForcedAbstractFollowupAccountabilityProbe
    ? 'abstract_followup_after_specificity_redirect'
    : ctx.moment5AccountabilityEval.reason;
  const accountabilityProbeSpoken = pickMoment5AccountabilityProbeSpokenText(
    ctx.moment5CombinedIncludingCurrent || trimmed,
    { griefAckPrefix: true },
  );
  deps.moment5AccountabilityProbeFiredRef.current = true;
  deps.moment5ClientScoringMetaRef.current = {
    ...(deps.moment5ClientScoringMetaRef.current ?? {}),
    accountabilityProbeFired: true,
    probeTriggerReason: moment5AccountabilityProbeTriggerReason,
    ...(deps.moment5SpecificityRedirectIssuedRef.current ? { specificityRedirectIssued: true } : {}),
    warmAckBeforeAccountabilityProbe: true,
    ...(deathDisclosureForProbe ? { griefAckBeforeAccountabilityProbe: true } : {}),
    ...(ctx.moment5ForcedAbstractFollowupAccountabilityProbe
      ? {
          accountabilityProbeFiredOnAbstractFollowup: true,
          conflictValiditySecondResponseAbstract: true,
          conflictValidityClarificationFired: true,
        }
      : {}),
  };
  void remoteLog('[M5_ACCOUNTABILITY_PROBE_FIRED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    reason: moment5AccountabilityProbeTriggerReason,
    after_specificity_redirect: deps.moment5SpecificityRedirectIssuedRef.current,
    warm_ack_before_accountability_probe: true,
    grief_ack_before_probe: deathDisclosureForProbe,
    conflict_validity_clarification_fired:
      deps.moment5ClientScoringMetaRef.current?.conflictValidityClarificationFired === true,
    conflict_validity_second_response_abstract:
      deps.moment5ClientScoringMetaRef.current?.conflictValiditySecondResponseAbstract === true,
    accountability_probe_fired_on_abstract_followup:
      deps.moment5ClientScoringMetaRef.current?.accountabilityProbeFiredOnAbstractFollowup === true,
    accountability_probe_self_reference_detected:
      ctx.moment5AccountabilityEval.selfReference.accountability_probe_self_reference_detected,
    self_reference_type: ctx.moment5AccountabilityEval.selfReference.self_reference_type,
    wordCount: countInterviewWords(trimmed),
    preview: trimmed.slice(0, 200),
  });
  deps.probeLogRef.current.push({
    scenario: (deps.currentScenarioRef.current ?? 3) as number,
    construct: 'accountability',
    probe_fired: true,
    trigger_reason: moment5AccountabilityProbeTriggerReason,
    pre_probe_score: 0,
    post_probe_score: 0,
    score_delta: 0,
  });
  const attemptIdForProbeLog = deps.interviewSessionAttemptIdRef.current;
  if (attemptIdForProbeLog && deps.userId) {
    void supabase
      .from('interview_attempts')
      .update({ probe_log: [...deps.probeLogRef.current] })
      .eq('id', attemptIdForProbeLog)
      .eq('user_id', deps.userId)
      .then(({ error }) => {
        if (error) {
          void remoteLog('[M5] probe_log incremental persist failed', {
            attemptId: attemptIdForProbeLog,
            message: error.message,
          });
        } else {
          void remoteLog('[M5] probe_log written after accountability probe', {
            attemptId: attemptIdForProbeLog,
          });
        }
      });
  }
  const accountabilityProbeMsg: MessageWithScenario = {
    role: 'assistant',
    content: accountabilityProbeSpoken,
    scenarioNumber: moment5ScenarioNumber(deps),
  };
  deps.setMessages([...messagesToUse, accountabilityProbeMsg]);
  await deps.speakTextSafe(accountabilityProbeSpoken, ASSISTANT_INTERVIEW_SPEECH);
  return finishPreClaudeMoment5AssistantInject(deps, ctx.moment5CombinedUserText);
}
