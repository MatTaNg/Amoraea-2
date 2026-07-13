import type { BuildAriaInterviewCoreTtsDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewCoreTtsDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewGateDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewGateDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewLifecycleDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewLifecycleDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewRenderParamsFromScreenInput } from '@features/aria/buildAriaInterviewRenderParamsFromScreen';
import type { BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewTurnClusterDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewTurnClusterDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreen';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';

export type AriaInterviewScreenInterviewSessionSource = ReturnType<typeof useAriaInterviewSession>;

export type AriaInterviewScreenInterviewSessionBindings = {
  micSession: BuildAriaInterviewGateDepSyncWiringParamsFromScreenInput['micSession'];
  webTtsPreCore: BuildAriaInterviewWebTtsPreCoreDepSyncWiringParamsFromScreenInput['interviewSession'];
  runtime: BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput['interviewSession'];
  coreTts: BuildAriaInterviewCoreTtsDepSyncWiringParamsFromScreenInput['interviewSession'];
  documentTts: BuildAriaInterviewDocumentTtsDepSyncWiringParamsFromScreenInput['interviewSession'];
  turnCluster: BuildAriaInterviewTurnClusterDepSyncWiringParamsFromScreenInput['interviewSession'];
  lifecycle: BuildAriaInterviewLifecycleDepSyncWiringParamsFromScreenInput['interviewSession'];
  render: Omit<BuildAriaInterviewRenderParamsFromScreenInput['interviewSession'], 'audioRecorder'>;
};

/** Slice `useAriaInterviewSession` return into hook-specific interviewSession param bags. */
export function buildAriaInterviewScreenInterviewSessionBindings(
  interview: AriaInterviewScreenInterviewSessionSource,
): AriaInterviewScreenInterviewSessionBindings {
  return {
    micSession: {
      lastHeadphoneProbeRef: interview.lastHeadphoneProbeRef,
      lastAudioRouteFingerprintRef: interview.lastAudioRouteFingerprintRef,
      routeChangedDuringRecordingRef: interview.routeChangedDuringRecordingRef,
      gestureContextLostAtRef: interview.gestureContextLostAtRef,
    },
    webTtsPreCore: {
      awaitTtsScreenReadyGate: interview.awaitTtsScreenReadyGate,
      setVoiceState: interview.setVoiceState,
      isSpeakingRef: interview.isSpeakingRef,
      pendingGestureRestoreSpeakRef: interview.pendingGestureRestoreSpeakRef,
      webTabGestureRestoreOverlayRef: interview.webTabGestureRestoreOverlayRef,
      webGestureFlushListenerAttachedRef: interview.webGestureFlushListenerAttachedRef,
      webGestureFlushHandlerRef: interview.webGestureFlushHandlerRef,
      webGestureTtsConsumedPressRef: interview.webGestureTtsConsumedPressRef,
      webGestureConsumeClearTimeoutRef: interview.webGestureConsumeClearTimeoutRef,
      pendingWebSpeechForGestureRef: interview.pendingWebSpeechForGestureRef,
      setMobileWebTapToBeginDone: interview.setMobileWebTapToBeginDone,
      setWebDesktopPendingTtsGestureOverlay: interview.setWebDesktopPendingTtsGestureOverlay,
      setWebTabRestoreOverlayVisible: interview.setWebTabRestoreOverlayVisible,
      tabVisibilityGestureLossPendingRef: interview.tabVisibilityGestureLossPendingRef,
      needsGestureRestoreRef: interview.needsGestureRestoreRef,
    },
    runtime: {
      voiceStateRef: interview.voiceStateRef,
      setVoiceState: interview.setVoiceState,
      pendingGestureRestoreSpeakRef: interview.pendingGestureRestoreSpeakRef,
      tabVisibilityGestureLossPendingRef: interview.tabVisibilityGestureLossPendingRef,
      needsGestureRestoreRef: interview.needsGestureRestoreRef,
      setMobileWebTapToBeginDone: interview.setMobileWebTapToBeginDone,
      pendingWebSpeechForGestureRef: interview.pendingWebSpeechForGestureRef,
      transcriptAtReleaseRef: interview.transcriptAtReleaseRef,
      setWebTabRestoreOverlayVisible: interview.setWebTabRestoreOverlayVisible,
    },
    coreTts: {
      setMessages: interview.setMessages,
      currentMessagesRef: interview.currentMessagesRef,
      mobileWebTapToBeginDone: interview.mobileWebTapToBeginDone,
      setWebDesktopPendingTtsGestureOverlay: interview.setWebDesktopPendingTtsGestureOverlay,
      setWebTabGestureRestoreOverlay: interview.setWebTabGestureRestoreOverlay,
      awaitTtsScreenReadyGate: interview.awaitTtsScreenReadyGate,
    },
    documentTts: {
      gestureContextLostAtRef: interview.gestureContextLostAtRef,
      webTabGestureRestoreOverlayRef: interview.webTabGestureRestoreOverlayRef,
      useMediaRecorderPath: interview.useMediaRecorderPath,
      setWebInterviewerOutputActive: interview.setWebInterviewerOutputActive,
      recognitionRef: interview.recognitionRef,
      setCurrentTranscript: interview.setCurrentTranscript,
      transcriptAtReleaseRef: interview.transcriptAtReleaseRef,
      setMicError: interview.setMicError,
      setMicWarning: interview.setMicWarning,
    },
    turnCluster: {
      audioRecorderIsRecordingForRouteRef: interview.audioRecorderIsRecordingForRouteRef,
      recognitionRef: interview.recognitionRef,
      webMicArmInFlightRef: interview.webMicArmInFlightRef,
      micTapWhileTtsActiveRef: interview.micTapWhileTtsActiveRef,
      useMediaRecorderPath: interview.useMediaRecorderPath,
      useTapMicUi: interview.useTapMicUi,
      currentTranscript: interview.currentTranscript,
      takeRecordingStartEventDataWithVadBypassRestart: interview.takeRecordingStartEventDataWithVadBypassRestart,
      pendingRecordingRestartAfterVadBypassRef: interview.pendingRecordingRestartAfterVadBypassRef,
      pendingMicStartAfterIdleFlushRef: interview.pendingMicStartAfterIdleFlushRef,
      webGestureTtsConsumedPressRef: interview.webGestureTtsConsumedPressRef,
      webGestureConsumeClearTimeoutRef: interview.webGestureConsumeClearTimeoutRef,
      webTabGestureRestoreOverlayRef: interview.webTabGestureRestoreOverlayRef,
    },
    lifecycle: {
      recognitionRef: interview.recognitionRef,
      onboardingAutoStartRef: interview.onboardingAutoStartRef,
      startInterviewInFlightRef: interview.startInterviewInFlightRef,
      setInterviewStartInFlight: interview.setInterviewStartInFlight,
      useMediaRecorderPath: interview.useMediaRecorderPath,
    },
    render: {
      status: interview.status,
      voiceState: interview.voiceState,
      currentTranscript: interview.currentTranscript,
      useMediaRecorderPath: interview.useMediaRecorderPath,
      webInterviewerOutputActive: interview.webInterviewerOutputActive,
      useTapMicUi: interview.useTapMicUi,
      mobileWebTapToBeginDone: interview.mobileWebTapToBeginDone,
      webDesktopAwaitingStartOverlay: interview.webDesktopAwaitingStartOverlay,
      webDesktopPendingTtsGestureOverlay: interview.webDesktopPendingTtsGestureOverlay,
      webTabGestureRestoreOverlay: interview.webTabGestureRestoreOverlay,
      interviewStartInFlight: interview.interviewStartInFlight,
      onboardingAutoStartRef: interview.onboardingAutoStartRef,
      micError: interview.micError,
      micPermission: interview.micPermission,
      micWarning: interview.micWarning,
      preInitMeterLevel: interview.preInitMeterLevel,
      micSessionRecovering: interview.micSessionRecovering,
      micNeedsReconnect: interview.micNeedsReconnect,
      setMicNeedsReconnect: interview.setMicNeedsReconnect,
      lateStartIdleCueVisible: interview.lateStartIdleCueVisible,
      webInsecureContextMessage: interview.webInsecureContextMessage,
      setWebDesktopAwaitingStartOverlay: interview.setWebDesktopAwaitingStartOverlay,
      setMicError: interview.setMicError,
    },
  };
}
