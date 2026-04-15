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
