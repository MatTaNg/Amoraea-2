import {
  logPreClaudeTurnResponseTelemetry,
  logPreClaudeTurnSessionTelemetry,
} from '@features/aria/logPreClaudeTurnSessionTelemetry';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps, PreClaudeTurnGateParams } from '@features/aria/preClaudeTurnGateTypes';
import {
  resolvePreClaudeTurnSkipAndMetaGates,
} from '@features/aria/resolvePreClaudeTurnSkipAndMetaGates';
import {
  resolvePlausibleInterviewFirstName,
} from '@features/aria/interviewNameValidation';
import {
  runPreClaudeAdminPassGate,
} from '@features/aria/runPreClaudeAdminPassGate';
import {
  runPreClaudeResumeRepeatGate,
} from '@features/aria/runPreClaudeResumeRepeatGate';

export type PreClaudeTurnSkipMetaState = {
  frustrationSkipAcceptancePipeline: boolean;
  frustrationSkipDeclinePipeline: boolean;
  proactiveScenarioSkipConfirmationInjection: boolean;
  skipConfirmationGreetingReconnectInjection: boolean;
  metaCommentClassification: MetaCommentClassification | null;
  alreadyAnsweredPriorSubstantiveVerified: boolean | undefined;
  checkingInFrustrationAdjacent: boolean;
  skipRequestConfirmationSpeech: string;
  inabilityInvitationClientInjection: boolean;
  inabilityEscalationSkipInjection: boolean;
  skipRequestMetaConfirmationInjection: boolean;
  repeatedFrustrationInMoment: boolean;
  suppressForcedConstructProbesForMetaFrustration: boolean;
};

export type PreClaudeTurnOpeningPipelineResult =
  | { continue: false }
  | {
      continue: true;
      participantFirstNameForSpoken: string;
      skipMeta: PreClaudeTurnSkipMetaState;
    };

/** Skip/meta resolution, session telemetry, resume repeat, and admin pass. */
export async function runPreClaudeTurnOpeningPipeline(
  deps: PreClaudeTurnGateDeps,
  params: PreClaudeTurnGateParams,
): Promise<PreClaudeTurnOpeningPipelineResult> {
  const skipAndMeta = await resolvePreClaudeTurnSkipAndMetaGates(
    deps,
    params.trimmed,
    params.resumeGatePendingEarly,
  );

  let participantFirstNameForSpoken = resolvePlausibleInterviewFirstName(deps.interviewNameRef.current) ?? '';
  const routeChangedDuringRecordingSnap = deps.routeChangedDuringRecordingRef.current;
  deps.routeChangedDuringRecordingRef.current = false;
  let reentryTypeForLogging: 'repeat_requested' | 'continue_requested' | 'direct_answer' | null = null;
  const telemetryInput = {
    trimmed: params.trimmed,
    participantFirstNameForSpoken,
    reentryTypeForLogging,
    routeChangedDuringRecordingSnap,
    metaClassSnapshotPrePipeline: skipAndMeta.metaClassSnapshotPrePipeline,
  };
  logPreClaudeTurnSessionTelemetry(deps, telemetryInput);

  const resumeRepeat = await runPreClaudeResumeRepeatGate(deps, {
    trimmed: params.trimmed,
    spokenText: params.spokenText,
    routeChangedDuringRecordingSnap,
    metaCommentClassification: skipAndMeta.metaCommentClassification,
    proactiveScenarioSkipConfirmationInjection: skipAndMeta.proactiveScenarioSkipConfirmationInjection,
    skipRequestMetaConfirmationInjection: skipAndMeta.skipRequestMetaConfirmationInjection,
  });
  reentryTypeForLogging = resumeRepeat.reentryTypeForLogging;
  if (resumeRepeat.haltTurn) {
    return { continue: false };
  }

  logPreClaudeTurnResponseTelemetry(deps, {
    ...telemetryInput,
    reentryTypeForLogging,
  });

  const adminPass = await runPreClaudeAdminPassGate(deps, params.trimmed);
  if (adminPass.handled) {
    return { continue: false };
  }

  return {
    continue: true,
    participantFirstNameForSpoken,
    skipMeta: {
      frustrationSkipAcceptancePipeline: skipAndMeta.frustrationSkipAcceptancePipeline,
      frustrationSkipDeclinePipeline: skipAndMeta.frustrationSkipDeclinePipeline,
      proactiveScenarioSkipConfirmationInjection: skipAndMeta.proactiveScenarioSkipConfirmationInjection,
      skipConfirmationGreetingReconnectInjection: skipAndMeta.skipConfirmationGreetingReconnectInjection,
      metaCommentClassification: skipAndMeta.metaCommentClassification,
      alreadyAnsweredPriorSubstantiveVerified: skipAndMeta.alreadyAnsweredPriorSubstantiveVerified,
      checkingInFrustrationAdjacent: skipAndMeta.checkingInFrustrationAdjacent,
      skipRequestConfirmationSpeech: skipAndMeta.skipRequestConfirmationSpeech,
      inabilityInvitationClientInjection: skipAndMeta.inabilityInvitationClientInjection,
      inabilityEscalationSkipInjection: skipAndMeta.inabilityEscalationSkipInjection,
      skipRequestMetaConfirmationInjection: skipAndMeta.skipRequestMetaConfirmationInjection,
      repeatedFrustrationInMoment: skipAndMeta.repeatedFrustrationInMoment,
      suppressForcedConstructProbesForMetaFrustration: skipAndMeta.suppressForcedConstructProbesForMetaFrustration,
    },
  };
}
