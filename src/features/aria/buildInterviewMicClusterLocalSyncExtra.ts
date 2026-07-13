import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

type SyncExtraParams = AriaInterviewDepsSyncContext;

export type InterviewMicClusterLocalScope = {
  liveState: Pick<
    SyncExtraParams,
    | 'voiceState'
    | 'useMediaRecorderPath'
    | 'currentTranscript'
    | 'audioRecorder'
    | 'interviewStatus'
    | 'useTapMicUi'
    | 'touchActivity'
  >;
  micSetters: Pick<
    SyncExtraParams,
    | 'setMicWarning'
    | 'setMicEnginePrimed'
    | 'setMicPermission'
    | 'setCurrentTranscript'
    | 'setMicNeedsReconnect'
    | 'setMicSessionRecovering'
    | 'setLateStartIdleCueVisible'
    | 'setPreInitMeterLevel'
    | 'setSessionAudioHealthNotice'
    | 'setConversationErrorNotice'
  >;
  playbackGate: Pick<
    SyncExtraParams,
    | 'stopElevenLabsPlayback'
    | 'stopElevenLabsSpeech'
    | 'checkMicPermission'
    | 'isInterviewerOutputActiveForMicGate'
    | 'isWebInterviewPlaybackSurfaceActive'
    | 'webSpeechShouldDeferToUserGesture'
    | 'classifyInterviewQuestionType'
  >;
  recordingPipeline: Pick<
    SyncExtraParams,
    | 'handleRecordingError'
    | 'processUserSpeech'
    | 'transcribeSafe'
    | 'processTurnAudioWithRetry'
    | 'takeRecordingStartEventDataWithVadBypassRestart'
    | 'deleteTurnAudioFile'
    | 'deliverRecordingRetryLine'
    | 'classifyError'
    | 'applyRouteProbeAfterResume'
  >;
  recordingRefs: Pick<
    SyncExtraParams,
    | 'recognitionRef'
    | 'webMicArmInFlightRef'
    | 'micTapWhileTtsActiveRef'
    | 'recordingDelayMeasurementRef'
    | 'transcribeBufferMetaRef'
    | 'recordingPeakMeteringRef'
    | 'lastRecordingVadSpeechDetectedRef'
    | 'transcriptionFailureStreakRef'
    | 'lastRecordingRetryDeliveredNormRef'
    | 'recordingCompleteInFlightRef'
    | 'pendingRecordingRestartAfterVadBypassRef'
    | 'releaseRecordingFnRef'
  >;
  webTtsResume: Pick<
    SyncExtraParams,
    | 'syncInterviewTtsAfterScreenReturn'
    | 'isWebInterviewPlaybackAudiblyActive'
    | 'armMobileWebBackgroundTtsContinue'
    | 'isMobileWebInterviewTtsSessionActive'
    | 'hasWebInterviewHtmlAudioTabResumePending'
    | 'holdTabStashedHtmlAudioForGestureResume'
    | 'hasInterviewClosingSpeakInFlightForSession'
  >;
  pressHandlers: Pick<
    SyncExtraParams,
    | 'webTabGestureRestoreOverlayRef'
    | 'handleWebTabGestureRestoreTapRef'
    | 'setWebTabGestureRestoreOverlay'
    | 'pendingMicStartAfterIdleFlushRef'
    | 'startRecordingAfterPendingTts'
    | 'webGestureTtsConsumedPressRef'
    | 'webGestureConsumeClearTimeoutRef'
    | 'handlePressEnd'
    | 'handlePressStart'
    | 'waitUntilInterviewerQuiescentForWebMic'
  >;
};

export function buildInterviewMicClusterLocalSyncExtra(scope: InterviewMicClusterLocalScope): SyncExtraParams {
  return {
    ...scope.liveState,
    ...scope.micSetters,
    ...scope.playbackGate,
    ...scope.recordingPipeline,
    ...scope.recordingRefs,
    ...scope.webTtsResume,
    ...scope.pressHandlers,
  };
}
