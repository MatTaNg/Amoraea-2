import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createDeliverRecordingRetryLineSyncCtxFromScreen,
  createSaveScenarioCheckpointSyncCtxFromScreen,
  createWebTabRestoreSessionSyncCtxFromScreen,
  type SaveScenarioCheckpointScreenRefs,
} from '@features/aria/buildAriaInterviewAuxClusterScreenParams';
import {
  createFetchStageScoreSyncCtxFromScreen,
  type FetchStageScoreScreenRefs,
} from '@features/aria/buildAriaInterviewBootMiscScreenParams';
import type { DeliverRecordingRetryLineDeps } from '@features/aria/deliverRecordingRetryLineTypes';
import type { FetchStageScoreDeps } from '@features/aria/fetchStageScoreTypes';
import { useAriaScreenMountGenerationBump } from '@features/aria/hooks/useInterviewScreenBootEffects';
import type { SaveScenarioCheckpointDeps } from '@features/aria/saveScenarioCheckpointTypes';
import { useDeliverRecordingRetryLine } from '@features/aria/hooks/useInterviewTurnProcessingCallbacks';
import type { InterviewDocumentVisibilityTtsDeps } from '@features/aria/interviewDocumentVisibilityTtsTypes';
import {
  syncDeliverRecordingRetryLineDeps,
  syncFetchStageScoreDeps,
  syncSaveScenarioCheckpointDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';

export type AriaInterviewDocumentTtsDepSyncWiringParams = {
  coreCtx: AriaInterviewDepsSyncContext;
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  runtimeCtx: AriaInterviewDepsSyncContext;
  bumpAriaScreenMountGeneration: () => void;
  deliverRecordingRetryLine: Pick<
    DeliverRecordingRetryLineDeps,
    | 'commitInterviewMessages'
    | 'lastRecordingRetryDeliveredNormRef'
    | 'lastRecordingRetryDeliveredAtMsRef'
    | 'currentScenarioRef'
    | 'currentInterviewMomentRef'
  >;
  fetchStageScore: FetchStageScoreScreenRefs;
  saveScenarioCheckpoint: SaveScenarioCheckpointScreenRefs;
};

/**
 * Document/TTS aux dep refs + effects that still matter on native.
 * Browser visibility / tab-restore / speechRecognition mounts removed.
 */
export function useAriaInterviewDocumentTtsDepSyncWiring(
  params: AriaInterviewDocumentTtsDepSyncWiringParams,
) {
  const {
    coreCtx,
    servicesBaseCtx,
    coreGateServicesBaseCtx,
    runtimeCtx,
    bumpAriaScreenMountGeneration,
    deliverRecordingRetryLine,
    fetchStageScore,
    saveScenarioCheckpoint,
  } = params;

  const deliverRecordingRetryLineDepsRef = useRef({} as DeliverRecordingRetryLineDeps);
  syncDeliverRecordingRetryLineDeps(
    deliverRecordingRetryLineDepsRef,
    createDeliverRecordingRetryLineSyncCtxFromScreen(
      createWebTabRestoreSessionSyncCtxFromScreen({
        coreGateServicesBaseCtx,
        runtimeCtx,
        coreCtx,
      }),
      deliverRecordingRetryLine,
    ),
  );
  const deliverRecordingRetryLineFn = useDeliverRecordingRetryLine(deliverRecordingRetryLineDepsRef);

  useAriaScreenMountGenerationBump(bumpAriaScreenMountGeneration);

  const fetchStageScoreDepsRef = useRef({} as FetchStageScoreDeps);
  syncFetchStageScoreDeps(
    fetchStageScoreDepsRef,
    createFetchStageScoreSyncCtxFromScreen(fetchStageScore),
  );

  const saveScenarioCheckpointDepsRef = useRef({} as SaveScenarioCheckpointDeps);
  syncSaveScenarioCheckpointDeps(
    saveScenarioCheckpointDepsRef,
    createSaveScenarioCheckpointSyncCtxFromScreen(servicesBaseCtx, saveScenarioCheckpoint),
  );

  return {
    deliverRecordingRetryLine: deliverRecordingRetryLineFn,
    fetchStageScoreDepsRef: fetchStageScoreDepsRef as MutableRefObject<FetchStageScoreDeps>,
    saveScenarioCheckpointDepsRef: saveScenarioCheckpointDepsRef as MutableRefObject<SaveScenarioCheckpointDeps>,
  };
}
