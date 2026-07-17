import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewDocumentTtsDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewDocumentTtsDepSyncWiring';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreenInput = {
  syncContexts: {
    coreCtx: AriaInterviewDepsSyncContext;
    servicesBaseCtx: AriaInterviewDepsSyncContext;
    coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
    runtimeCtx: AriaInterviewDepsSyncContext;
  };
  session: AriaInterviewScreenSessionState;
  typologyContext: string;
};

/** Assemble document/TTS aux dep-sync params from session state. */
export function buildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreenInput,
): AriaInterviewDocumentTtsDepSyncWiringParams {
  const { syncContexts, session, typologyContext } = input;
  const { gate } = session;
  const { currentInterviewMomentRef } = gate.moments;
  const {
    commitInterviewMessages,
    lastRecordingRetryDeliveredNormRef,
    lastRecordingRetryDeliveredAtMsRef,
    currentScenarioRef,
  } = session.shell;

  return {
    ...syncContexts,
    bumpAriaScreenMountGeneration: wiring.bumpAriaScreenMountGeneration,
    deliverRecordingRetryLine: {
      commitInterviewMessages,
      lastRecordingRetryDeliveredNormRef,
      lastRecordingRetryDeliveredAtMsRef,
      currentScenarioRef,
      currentInterviewMomentRef,
    },
    fetchStageScore: { typologyContext },
    saveScenarioCheckpoint: { saveInterviewToStorage: wiring.saveInterviewToStorage },
  };
}
