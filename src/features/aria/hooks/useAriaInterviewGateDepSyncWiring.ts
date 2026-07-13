import { useCallback, useRef } from 'react';

import type { AriaInterviewGateScreenRefsParams } from '@features/aria/buildAriaInterviewGateScreenRefsInput';
import {
  createClosingQuestionActionsSyncCtxFromGate,
  createInterviewAssistantMetaExemptionSyncCtxFromGate,
  createResetInterviewProgressSyncCtxFromGate,
  createResetScenarioCClientGatesSyncCtxFromScreen,
  type ResetScenarioCClientGatesScreenRefs,
} from '@features/aria/buildAriaInterviewBootMiscScreenParams';
import { useAriaInterviewGateSyncContext } from '@features/aria/hooks/useAriaInterviewGateSyncContext';
import type { InterviewAssistantMetaExemptionDeps } from '@features/aria/interviewAssistantMetaExemptionTypes';
import type { ClosingQuestionActionsDeps } from '@features/aria/interviewClosingQuestionTypes';
import type {
  ResetInterviewProgressRefsDeps,
  ResetScenarioCClientGatesDeps,
} from '@features/aria/interviewProgressResetTypes';
import {
  runResetInterviewProgressRefs,
  runResetScenarioCClientGatesOnly,
} from '@features/aria/runInterviewProgressReset';
import {
  syncClosingQuestionActionsDeps,
  syncInterviewAssistantMetaExemptionDeps,
  syncResetInterviewProgressDeps,
  syncResetScenarioCClientGatesDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';

export type AriaInterviewGateDepSyncWiringParams = Omit<AriaInterviewGateScreenRefsParams, 'identity'> & {
  identity: Omit<AriaInterviewGateScreenRefsParams['identity'], 'resetScenarioCClientGatesOnly'>;
  resetScenarioCClientGates: ResetScenarioCClientGatesScreenRefs;
};

/** Wire scenario-C gate reset, gate sync context, and gate-scoped dep refs each render. */
export function useAriaInterviewGateDepSyncWiring(params: AriaInterviewGateDepSyncWiringParams) {
  const { resetScenarioCClientGates, ...gateScreenRefs } = params;

  const resetScenarioCClientGatesDepsRef = useRef({} as ResetScenarioCClientGatesDeps);
  const resetInterviewProgressDepsRef = useRef({} as ResetInterviewProgressRefsDeps);
  const closingQuestionActionsDepsRef = useRef({} as ClosingQuestionActionsDeps);
  const interviewAssistantMetaExemptionDepsRef = useRef({} as InterviewAssistantMetaExemptionDeps);

  syncResetScenarioCClientGatesDeps(
    resetScenarioCClientGatesDepsRef,
    createResetScenarioCClientGatesSyncCtxFromScreen(resetScenarioCClientGates),
  );
  const resetScenarioCClientGatesOnly = useCallback(
    () => runResetScenarioCClientGatesOnly(resetScenarioCClientGatesDepsRef.current),
    [],
  );

  const ariaInterviewGateSyncCtx = useAriaInterviewGateSyncContext({
    ...gateScreenRefs,
    identity: {
      ...gateScreenRefs.identity,
      resetScenarioCClientGatesOnly,
    },
  });

  syncResetInterviewProgressDeps(
    resetInterviewProgressDepsRef,
    createResetInterviewProgressSyncCtxFromGate(ariaInterviewGateSyncCtx),
  );
  syncInterviewAssistantMetaExemptionDeps(
    interviewAssistantMetaExemptionDepsRef,
    createInterviewAssistantMetaExemptionSyncCtxFromGate(ariaInterviewGateSyncCtx),
  );
  syncClosingQuestionActionsDeps(
    closingQuestionActionsDepsRef,
    createClosingQuestionActionsSyncCtxFromGate(ariaInterviewGateSyncCtx),
  );

  const resetInterviewProgressRefs = useCallback(
    () => runResetInterviewProgressRefs(resetInterviewProgressDepsRef.current),
    [],
  );

  return {
    resetScenarioCClientGatesOnly,
    ariaInterviewGateSyncCtx,
    resetInterviewProgressRefs,
    closingQuestionActionsDepsRef,
    interviewAssistantMetaExemptionDepsRef,
  };
}
