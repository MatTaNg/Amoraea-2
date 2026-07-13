import type { MutableRefObject } from 'react';

import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { InterviewWebSpeechRecognitionLocalScope } from '@features/aria/buildInterviewMicTurnAuxSyncExtras';
import type { AriaInterviewDocumentTtsDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewDocumentTtsDepSyncWiring';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreenInput = {
  syncContexts: {
    coreCtx: AriaInterviewDepsSyncContext;
    servicesBaseCtx: AriaInterviewDepsSyncContext;
    coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
    webRuntimeCtx: AriaInterviewDepsSyncContext;
  };
  session: AriaInterviewScreenSessionState;
  typologyContext: string;
  interviewSession: {
    gestureContextLostAtRef: MutableRefObject<unknown>;
    webTabGestureRestoreOverlayRef: MutableRefObject<unknown>;
    useMediaRecorderPath: boolean;
    setWebInterviewerOutputActive: (value: boolean) => void;
  } & InterviewWebSpeechRecognitionLocalScope;
  webTts: {
    ensureWebGestureFlushListener: AriaInterviewDocumentTtsDepSyncWiringParams['documentVisibilityTts']['ensureWebGestureFlushListener'];
    isMobileWebInterviewTtsSessionActive: AriaInterviewDocumentTtsDepSyncWiringParams['interruptDocumentHiddenTts']['isMobileWebInterviewTtsSessionActive'];
    armMobileWebBackgroundTtsContinue: AriaInterviewDocumentTtsDepSyncWiringParams['interruptDocumentHiddenTts']['armMobileWebBackgroundTtsContinue'];
    isInterviewerOutputActiveForMicGate: AriaInterviewDocumentTtsDepSyncWiringParams['tabRestoreWatchdog']['isInterviewerOutputActiveForMicGate'];
    queueMobileWebHtmlResumeAfterScreenReturn: AriaInterviewDocumentTtsDepSyncWiringParams['tabRestoreWatchdog']['queueMobileWebHtmlResumeAfterScreenReturn'];
    resolveStaleWebTtsRuntimeLockThresholdMs: AriaInterviewDocumentTtsDepSyncWiringParams['tabRestoreWatchdog']['resolveStaleWebTtsRuntimeLockThresholdMs'];
    clearStaleWebInterviewTtsRuntimeLocks: AriaInterviewDocumentTtsDepSyncWiringParams['tabRestoreWatchdog']['clearStaleWebInterviewTtsRuntimeLocks'];
    dismissAfterAndroidBackgroundPlaybackEnd: AriaInterviewDocumentTtsDepSyncWiringParams['tabRestoreWatchdog']['dismissAfterAndroidBackgroundPlaybackEnd'];
    dismissTabRestoreOverlay: AriaInterviewDocumentTtsDepSyncWiringParams['tabRestoreWatchdog']['dismissTabRestoreOverlay'];
  };
};

/** Assemble document/TTS aux dep-sync params from session state + upstream web-TTS outputs. */
export function buildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreenInput,
): AriaInterviewDocumentTtsDepSyncWiringParams {
  const { syncContexts, session, typologyContext, interviewSession, webTts } = input;
  const { gate } = session;
  const { currentInterviewMomentRef } = gate.moments;
  const {
    commitInterviewMessages,
    handleWebTabGestureRestoreTapRef,
    staleWebTtsRuntimeLockSinceMsRef,
    speakingWithoutPlaybackSinceMsRef,
    lastRecordingRetryDeliveredNormRef,
    lastRecordingRetryDeliveredAtMsRef,
    currentScenarioRef,
  } = session.shell;
  const {
    gestureContextLostAtRef,
    webTabGestureRestoreOverlayRef,
    useMediaRecorderPath,
    setWebInterviewerOutputActive,
    recognitionRef,
    setCurrentTranscript,
    transcriptAtReleaseRef,
    setMicError,
    setMicWarning,
  } = interviewSession;

  return {
    ...syncContexts,
    handleWebTabGestureRestoreTapRef,
    bumpAriaScreenMountGeneration: wiring.bumpAriaScreenMountGeneration,
    deliverRecordingRetryLine: {
      commitInterviewMessages,
      lastRecordingRetryDeliveredNormRef,
      lastRecordingRetryDeliveredAtMsRef,
      currentScenarioRef,
      currentInterviewMomentRef,
    },
    interruptDocumentHiddenTts: {
      isWebInterviewPlaybackSurfaceActive: wiring.isWebInterviewPlaybackSurfaceActive,
      gestureContextLostAtRef,
      isMobileWebInterviewTtsSessionActive: webTts.isMobileWebInterviewTtsSessionActive,
      armMobileWebBackgroundTtsContinue: webTts.armMobileWebBackgroundTtsContinue,
      setTtsPlaybackActive: wiring.setTtsPlaybackActive,
    },
    documentVisibilityTts: {
      ensureWebGestureFlushListener: webTts.ensureWebGestureFlushListener,
      hasWebInterviewHtmlAudioTabResumePending: wiring.hasWebInterviewHtmlAudioTabResumePending,
      isWebInterviewPlaybackAudiblyActive: wiring.isWebInterviewPlaybackAudiblyActive,
    },
    tabRestoreWatchdog: {
      webTabGestureRestoreOverlayRef,
      isWebInterviewPlaybackSurfaceActive: wiring.isWebInterviewPlaybackSurfaceActive,
      isWebInterviewPlaybackAudiblyActive: wiring.isWebInterviewPlaybackAudiblyActive,
      hasWebInterviewHtmlAudioTabResumePending: wiring.hasWebInterviewHtmlAudioTabResumePending,
      isWebInterviewMidUtteranceTabResumeActive: wiring.isWebInterviewMidUtteranceTabResumeActive,
      isInterviewerOutputActiveForMicGate: webTts.isInterviewerOutputActiveForMicGate,
      queueMobileWebHtmlResumeAfterScreenReturn: webTts.queueMobileWebHtmlResumeAfterScreenReturn,
      resolveStaleWebTtsRuntimeLockThresholdMs: webTts.resolveStaleWebTtsRuntimeLockThresholdMs,
      clearStaleWebInterviewTtsRuntimeLocks: webTts.clearStaleWebInterviewTtsRuntimeLocks,
      dismissAfterAndroidBackgroundPlaybackEnd: webTts.dismissAfterAndroidBackgroundPlaybackEnd,
      dismissTabRestoreOverlay: webTts.dismissTabRestoreOverlay,
      ensureWebGestureFlushListener: webTts.ensureWebGestureFlushListener,
      setWebInterviewerOutputActive,
      staleWebTtsRuntimeLockSinceMsRef,
      speakingWithoutPlaybackSinceMsRef,
    },
    webSpeechRecognition: {
      useMediaRecorderPath,
      recognitionRef,
      setCurrentTranscript,
      transcriptAtReleaseRef,
      setMicError,
      setMicWarning,
    },
    fetchStageScore: { typologyContext },
    saveScenarioCheckpoint: { saveInterviewToStorage: wiring.saveInterviewToStorage },
  };
}
