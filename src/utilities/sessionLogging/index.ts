export {
  writeSessionLog,
  logSupabaseWriteFailed,
  type SessionLogInsert,
  type SessionPlatform,
} from './writeSessionLog';
export {
  collectDeviceContext,
  type DeviceContextPayload,
} from './collectDeviceContext';
export {
  getSessionLogRuntime,
  resetSessionLogRuntime,
  setSessionLogAttemptId,
  setSessionLogsRequireAttemptId,
  setSessionLogPlatform,
  setSessionCorrelationId,
  markQuestionDelivered,
  setRecordingSessionActive,
  setTtsPlaybackActive,
  setCurrentMomentNumber,
  touchActivity,
  setLastHiddenAtMs,
  setNavigationAwayAtMs,
  type SessionLogRuntimeContext,
} from './sessionLogContext';
export {
  logTouchActivityForPause,
  assignAttemptIdForSessionLogs,
  logGateAnalyticsToSession,
  logProbeEvent,
  logCommunicationStylePipelineOutcome,
} from './sessionLogInterview';
export { gatherRecordingStartTelemetry, gatherTtsPlaybackTelemetry } from './sessionAudioTelemetry';
export {
  writeAudioSessionLog,
  mergeAudioSessionEventData,
  setAudioSessionDeviceSnapshot,
  setLastInterviewDeviceEnvironment,
  setSessionAudioRoutes,
  markInterviewSessionClockStart,
  markLastAudioSessionEventType,
  getInterviewWallClockStartMs,
  getLastAudioSessionEventType,
  getLastTtsCompletionCallbackMs,
  setLastTtsCompletionCallbackMs,
  peekRecordingDelayExtraFromEarlyCutoffMs,
  takeRecordingDelayExtraFromEarlyCutoffMs,
  addRecordingDelayExtraFromEarlyCutoffMs,
  incrementReAskCountThisSession,
  getReAskCountThisSession,
  resetAudioInterviewTurnCounters,
  setLastWhisperRatioTelemetry,
  getLastWhisperRatioFlag,
  getLastWhisperAudioDurationMs,
  getLastWhisperWordCount,
} from './audioSessionLogEnvelope';
export {
  collectInterviewDeviceEnvironment,
  mapHeadphoneProbeToSessionInputRoute,
  shouldWarnHighThermal,
} from './interviewDeviceEnvironment';
export {
  captureWebSessionLogDeviceContext,
  getWebSessionLogDeviceContextForMerge,
  clearWebSessionLogDeviceContextForTests,
} from './webSessionLogDeviceContext';
