import type { MutableRefObject } from 'react';

import type { AriaInterviewRuntimeLayerScreenRefs } from '@features/aria/buildAriaInterviewSyncContextLayerScreenParams';
import { composeAriaInterviewRuntimeSyncContextLayerFromScreen } from '@features/aria/buildAriaInterviewSyncContextLayerScreenParams';
import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { InterviewWebTtsRuntimeDeps } from '@features/aria/hooks/useInterviewWebTtsRuntime';
import { syncAriaInterviewEarlyDeps } from '@features/aria/syncAriaInterviewDepsRefs';

export type AriaInterviewRuntimeDepSyncWiringParams = AriaInterviewRuntimeLayerScreenRefs & {
  emotionModalOrchestrationDepsRef: MutableRefObject<EmotionModalOrchestrationDeps>;
  webTtsRuntimeDepsRef: MutableRefObject<InterviewWebTtsRuntimeDeps>;
};

/** Compose runtime sync layers and wire early-deps refs each render. */
export function useAriaInterviewRuntimeDepSyncWiring(params: AriaInterviewRuntimeDepSyncWiringParams) {
  const { emotionModalOrchestrationDepsRef, webTtsRuntimeDepsRef, ...runtimeLayerRefs } = params;

  const {
    webRuntimeCtx: ariaInterviewWebRuntimeSyncCtx,
    runtimeGateCtx: ariaInterviewRuntimeGateSyncCtx,
    earlyDepsCtx: ariaInterviewEarlyDepsSyncCtx,
  } = composeAriaInterviewRuntimeSyncContextLayerFromScreen(runtimeLayerRefs);

  syncAriaInterviewEarlyDeps(
    { emotionModalOrchestrationDepsRef, webTtsRuntimeDepsRef },
    ariaInterviewEarlyDepsSyncCtx,
  );

  return {
    ariaInterviewWebRuntimeSyncCtx,
    ariaInterviewRuntimeGateSyncCtx,
    ariaInterviewEarlyDepsSyncCtx,
  };
}
