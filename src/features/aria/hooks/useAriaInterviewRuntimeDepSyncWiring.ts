import type { MutableRefObject } from 'react';

import type { AriaInterviewRuntimeLayerScreenRefs } from '@features/aria/buildAriaInterviewSyncContextLayerScreenParams';
import { composeAriaInterviewRuntimeSyncContextLayerFromScreen } from '@features/aria/buildAriaInterviewSyncContextLayerScreenParams';
import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { InterviewTtsRuntimeDeps } from '@features/aria/hooks/useInterviewTtsRuntime';
import { syncAriaInterviewEarlyDeps } from '@features/aria/syncAriaInterviewDepsRefs';

export type AriaInterviewRuntimeDepSyncWiringParams = AriaInterviewRuntimeLayerScreenRefs & {
  emotionModalOrchestrationDepsRef: MutableRefObject<EmotionModalOrchestrationDeps>;
  ttsRuntimeDepsRef: MutableRefObject<InterviewTtsRuntimeDeps>;
};

/** Compose runtime sync layers and wire early-deps refs each render. */
export function useAriaInterviewRuntimeDepSyncWiring(params: AriaInterviewRuntimeDepSyncWiringParams) {
  const { emotionModalOrchestrationDepsRef, ttsRuntimeDepsRef, ...runtimeLayerRefs } = params;

  const {
    runtimeCtx: ariaInterviewRuntimeSyncCtx,
    runtimeGateCtx: ariaInterviewRuntimeGateSyncCtx,
    earlyDepsCtx: ariaInterviewEarlyDepsSyncCtx,
  } = composeAriaInterviewRuntimeSyncContextLayerFromScreen(runtimeLayerRefs);

  syncAriaInterviewEarlyDeps(
    { emotionModalOrchestrationDepsRef, ttsRuntimeDepsRef },
    ariaInterviewEarlyDepsSyncCtx,
  );

  return {
    ariaInterviewRuntimeSyncCtx,
    ariaInterviewRuntimeGateSyncCtx,
    ariaInterviewEarlyDepsSyncCtx,
  };
}
