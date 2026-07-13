import { useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewServicesBaseWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';
import {
  createDeliverRecordingRetryLineSyncCtxFromScreen,
  createInterruptDocumentHiddenTtsSyncCtxFromScreen,
  createInterviewDocumentVisibilityTtsSyncCtxFromScreen,
  createInterviewWebSpeechRecognitionSyncCtxFromScreen,
  createSaveScenarioCheckpointSyncCtxFromScreen,
  createTabRestoreWatchdogSyncCtxFromScreen,
  createWebTabRestoreSessionSyncCtxFromScreen,
  type InterruptDocumentHiddenTtsScreenRefs,
  type InterviewDocumentVisibilityTtsScreenRefs,
  type SaveScenarioCheckpointScreenRefs,
  type TabRestoreWatchdogLocalScreenRefs,
} from '@features/aria/buildAriaInterviewAuxClusterScreenParams';
import {
  createFetchStageScoreSyncCtxFromScreen,
  type FetchStageScoreScreenRefs,
} from '@features/aria/buildAriaInterviewBootMiscScreenParams';
import type { DeliverRecordingRetryLineDeps } from '@features/aria/deliverRecordingRetryLineTypes';
import type { FetchStageScoreDeps } from '@features/aria/fetchStageScoreTypes';
import type { InterruptInterviewTtsForDocumentHiddenDeps } from '@features/aria/interruptDocumentHiddenTtsTypes';
import type { InterviewDocumentVisibilityTtsDeps } from '@features/aria/interviewDocumentVisibilityTtsTypes';
import { useAriaScreenMountGenerationBump } from '@features/aria/hooks/useInterviewScreenBootEffects';
import type { InterviewWebSpeechRecognitionDeps } from '@features/aria/interviewWebSpeechRecognitionTypes';
import type { InterviewWebSpeechRecognitionLocalScope } from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { SaveScenarioCheckpointDeps } from '@features/aria/saveScenarioCheckpointTypes';
import type { TabRestoreWatchdogDeps } from '@features/aria/tabRestoreWatchdogTypes';
import { useDeliverRecordingRetryLine } from '@features/aria/hooks/useInterviewTurnProcessingCallbacks';
import { useInterruptInterviewTtsForDocumentHidden } from '@features/aria/hooks/useInterviewTurnProcessingCallbacks';
import { useInterviewDocumentVisibilityTts } from '@features/aria/hooks/useInterviewDocumentVisibilityTts';
import { useInterviewTabRestoreWatchdog } from '@features/aria/hooks/useInterviewTabRestoreWatchdog';
import { useInterviewWebSpeechRecognition } from '@features/aria/hooks/useInterviewWebSpeechRecognition';
import { useInterviewWebTabRestoreSession } from '@features/aria/hooks/useInterviewWebTabRestoreSession';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/webTabRestoreSessionDeps';
import {
  syncDeliverRecordingRetryLineDeps,
  syncFetchStageScoreDeps,
  syncInterruptDocumentHiddenTtsDeps,
  syncInterviewWebSpeechRecognitionDeps,
  syncSaveScenarioCheckpointDeps,
  syncTabRestoreWatchdogDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';
import { syncInterviewDocumentVisibilityTtsDeps } from '@features/aria/syncAriaInterviewDocumentTtsDepsRefs';

export type DocumentVisibilityTtsDepScreenRefs = Omit<
  InterviewDocumentVisibilityTtsScreenRefs,
  | 'interruptInterviewTtsForDocumentHidden'
  | 'syncInterviewTtsAfterScreenReturn'
  | 'docVisibilityWasHiddenRef'
  | 'handleWebTabGestureRestoreTapRef'
>;

export type AriaInterviewDocumentTtsDepSyncWiringParams = {
  coreCtx: AriaInterviewDepsSyncContext;
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  webRuntimeCtx: AriaInterviewDepsSyncContext;
  handleWebTabGestureRestoreTapRef: InterviewDocumentVisibilityTtsDeps['handleWebTabGestureRestoreTapRef'];
  bumpAriaScreenMountGeneration: () => void;
  deliverRecordingRetryLine: Pick<
    DeliverRecordingRetryLineDeps,
    | 'commitInterviewMessages'
    | 'lastRecordingRetryDeliveredNormRef'
    | 'lastRecordingRetryDeliveredAtMsRef'
    | 'currentScenarioRef'
    | 'currentInterviewMomentRef'
  >;
  interruptDocumentHiddenTts: InterruptDocumentHiddenTtsScreenRefs;
  documentVisibilityTts: DocumentVisibilityTtsDepScreenRefs;
  tabRestoreWatchdog: TabRestoreWatchdogLocalScreenRefs;
  webSpeechRecognition: InterviewWebSpeechRecognitionLocalScope;
  fetchStageScore: FetchStageScoreScreenRefs;
  saveScenarioCheckpoint: SaveScenarioCheckpointScreenRefs;
};

/** Wire document/TTS aux dep refs and mount related effects each render. */
export function useAriaInterviewDocumentTtsDepSyncWiring(params: AriaInterviewDocumentTtsDepSyncWiringParams) {
  const {
    coreCtx,
    servicesBaseCtx,
    coreGateServicesBaseCtx,
    webRuntimeCtx,
    handleWebTabGestureRestoreTapRef,
    bumpAriaScreenMountGeneration,
    deliverRecordingRetryLine,
    interruptDocumentHiddenTts,
    documentVisibilityTts,
    tabRestoreWatchdog,
    webSpeechRecognition,
    fetchStageScore,
    saveScenarioCheckpoint,
  } = params;

  const webTabRestoreSessionDepsRef = useRef({} as InterviewWebTabRestoreSessionDeps);
  const docVisibilityWasHiddenRef = useRef(false);

  const deliverRecordingRetryLineDepsRef = useRef({} as DeliverRecordingRetryLineDeps);
  syncDeliverRecordingRetryLineDeps(
    deliverRecordingRetryLineDepsRef,
    createDeliverRecordingRetryLineSyncCtxFromScreen(
      createWebTabRestoreSessionSyncCtxFromScreen({
        coreGateServicesBaseCtx,
        webRuntimeCtx,
        coreCtx,
      }),
      deliverRecordingRetryLine,
    ),
  );
  const deliverRecordingRetryLineFn = useDeliverRecordingRetryLine(deliverRecordingRetryLineDepsRef);

  const interruptDocumentHiddenTtsDepsRef = useRef({} as InterruptInterviewTtsForDocumentHiddenDeps);
  syncInterruptDocumentHiddenTtsDeps(
    interruptDocumentHiddenTtsDepsRef,
    createInterruptDocumentHiddenTtsSyncCtxFromScreen(coreCtx, interruptDocumentHiddenTts),
  );
  const interruptInterviewTtsForDocumentHidden = useInterruptInterviewTtsForDocumentHidden(
    interruptDocumentHiddenTtsDepsRef,
  );

  const {
    attemptMobileWebHtmlTabResumeAfterScreenReturn,
    syncInterviewTtsAfterScreenReturn,
    handleWebTabGestureRestoreTap,
  } = useInterviewWebTabRestoreSession(webTabRestoreSessionDepsRef);

  const documentVisibilityTtsDepsRef = useRef({} as InterviewDocumentVisibilityTtsDeps);
  syncInterviewDocumentVisibilityTtsDeps(
    documentVisibilityTtsDepsRef,
    createInterviewDocumentVisibilityTtsSyncCtxFromScreen(
      mergeAriaInterviewServicesBaseWithLocalSyncCtx(servicesBaseCtx, coreCtx),
      {
      ...documentVisibilityTts,
      docVisibilityWasHiddenRef,
      handleWebTabGestureRestoreTapRef,
      interruptInterviewTtsForDocumentHidden,
      syncInterviewTtsAfterScreenReturn,
    },
    ),
  );
  useInterviewDocumentVisibilityTts(documentVisibilityTtsDepsRef);

  if (handleWebTabGestureRestoreTapRef) {
    handleWebTabGestureRestoreTapRef.current = () => {
      void handleWebTabGestureRestoreTap();
    };
  }

  useAriaScreenMountGenerationBump(bumpAriaScreenMountGeneration);

  const tabRestoreWatchdogDepsRef = useRef({} as TabRestoreWatchdogDeps);
  syncTabRestoreWatchdogDeps(
    tabRestoreWatchdogDepsRef,
    createTabRestoreWatchdogSyncCtxFromScreen({
      coreGateServicesBaseCtx,
      webRuntimeCtx,
      tabRestoreWatchdog,
    }),
  );
  useInterviewTabRestoreWatchdog(tabRestoreWatchdogDepsRef);

  const webSpeechRecognitionDepsRef = useRef({} as InterviewWebSpeechRecognitionDeps);
  syncInterviewWebSpeechRecognitionDeps(
    webSpeechRecognitionDepsRef,
    createInterviewWebSpeechRecognitionSyncCtxFromScreen(coreCtx, webSpeechRecognition),
  );
  useInterviewWebSpeechRecognition(webSpeechRecognitionDepsRef, webSpeechRecognition.useMediaRecorderPath);

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
    webTabRestoreSessionDepsRef,
    deliverRecordingRetryLine: deliverRecordingRetryLineFn,
    syncInterviewTtsAfterScreenReturn,
    attemptMobileWebHtmlTabResumeAfterScreenReturn,
    handleWebTabGestureRestoreTap,
    fetchStageScoreDepsRef: fetchStageScoreDepsRef as MutableRefObject<FetchStageScoreDeps>,
    saveScenarioCheckpointDepsRef: saveScenarioCheckpointDepsRef as MutableRefObject<SaveScenarioCheckpointDeps>,
  };
}
