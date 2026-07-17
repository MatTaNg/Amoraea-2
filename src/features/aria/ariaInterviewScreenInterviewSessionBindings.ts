import type { BuildAriaInterviewCoreTtsDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewCoreTtsDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewGateDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewGateDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewLifecycleDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewLifecycleDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewRenderParamsFromScreenInput } from '@features/aria/buildAriaInterviewRenderParamsFromScreen';
import type { BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewRuntimeDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewTurnClusterDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewTurnClusterDepSyncWiringParamsFromScreen';
import type { BuildAriaInterviewTtsPreCoreDepSyncWiringParamsFromScreenInput } from '@features/aria/buildAriaInterviewTtsPreCoreDepSyncWiringParamsFromScreen';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';

export type AriaInterviewScreenInterviewSessionSource = ReturnType<typeof useAriaInterviewSession>;

export type AriaInterviewScreenInterviewSessionBindings = {
  micSession: BuildAriaInterviewGateDepSyncWiringParamsFromScreenInput['micSession'];
  webTtsPreCore: BuildAriaInterviewTtsPreCoreDepSyncWiringParamsFromScreenInput['interviewSession'];
  runtime: BuildAriaInterviewRuntimeDepSyncWiringParamsFromScreenInput['interviewSession'];
  coreTts: BuildAriaInterviewCoreTtsDepSyncWiringParamsFromScreenInput['interviewSession'];
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
    },
    webTtsPreCore: {
      awaitTtsScreenReadyGate: interview.awaitTtsScreenReadyGate,
      setVoiceState: interview.setVoiceState,
      isSpeakingRef: interview.isSpeakingRef,
    },
    runtime: {
      voiceStateRef: interview.voiceStateRef,
      setVoiceState: interview.setVoiceState,
      transcriptAtReleaseRef: interview.transcriptAtReleaseRef,
    },
    coreTts: {
      setMessages: interview.setMessages,
      currentMessagesRef: interview.currentMessagesRef,
      awaitTtsScreenReadyGate: interview.awaitTtsScreenReadyGate,
    },
    turnCluster: {
      audioRecorderIsRecordingForRouteRef: interview.audioRecorderIsRecordingForRouteRef,
      webMicArmInFlightRef: interview.webMicArmInFlightRef,
      micTapWhileTtsActiveRef: interview.micTapWhileTtsActiveRef,
      useTapMicUi: interview.useTapMicUi,
      currentTranscript: interview.currentTranscript,
      takeRecordingStartEventDataWithVadBypassRestart: interview.takeRecordingStartEventDataWithVadBypassRestart,
      pendingRecordingRestartAfterVadBypassRef: interview.pendingRecordingRestartAfterVadBypassRef,
    },
    lifecycle: {
      onboardingAutoStartRef: interview.onboardingAutoStartRef,
      startInterviewInFlightRef: interview.startInterviewInFlightRef,
      setInterviewStartInFlight: interview.setInterviewStartInFlight,
    },
    render: {
      status: interview.status,
      voiceState: interview.voiceState,
      currentTranscript: interview.currentTranscript,
      interviewerOutputActive: interview.interviewerOutputActive,
      useTapMicUi: interview.useTapMicUi,
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
      setMicError: interview.setMicError,
    },
  };
}
