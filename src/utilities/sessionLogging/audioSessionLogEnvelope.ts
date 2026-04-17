/**
 * Denormalized fields for session_logs audio telemetry (event_data JSON).
 * All writes remain fire-and-forget via writeSessionLog.
 */
import { writeSessionLog, type SessionLogInsert, type SessionPlatform } from './writeSessionLog';
import { getLastAppliedAudioModeLabel } from '@features/aria/utils/audioModeHelpers';

export type DeviceSnapshot = {
  device_model: string | null;
  os_version: string | null;
  app_version: string | null;
};

export type InterviewDeviceEnvironmentPayload = {
  low_power_mode_active: boolean;
  thermal_state: 'nominal' | 'fair' | 'serious' | 'critical' | 'unknown';
  available_memory_mb: number | null;
  /** True when `available_memory_mb` is known and below 512 MB. */
  low_memory_warning: boolean;
  other_app_using_microphone: boolean;
  recent_phone_call: boolean;
  bluetooth_connected: boolean;
  bluetooth_device_name: string | null;
};

let deviceSnapshot: DeviceSnapshot = { device_model: null, os_version: null, app_version: null };
let lastEnv: InterviewDeviceEnvironmentPayload | null = null;
let lastInputRouteLabel = 'unknown';
let lastOutputRouteLabel: 'speaker' | 'bluetooth' | 'wired_headset' | 'airpods' | 'unknown' = 'unknown';
let lastAudioEventType: string | null = null;
let interviewWallClockStartMs: number | null = null;

export function setAudioSessionDeviceSnapshot(s: DeviceSnapshot): void {
  deviceSnapshot = { ...s };
}

export function setLastInterviewDeviceEnvironment(e: InterviewDeviceEnvironmentPayload): void {
  lastEnv = { ...e };
}

export function getLastInterviewDeviceEnvironment(): InterviewDeviceEnvironmentPayload | null {
  return lastEnv;
}

export function setSessionAudioRoutes(input: string, output: typeof lastOutputRouteLabel): void {
  lastInputRouteLabel = input;
  lastOutputRouteLabel = output;
}

export function markInterviewSessionClockStart(): void {
  interviewWallClockStartMs = Date.now();
}

export function markLastAudioSessionEventType(eventType: string): void {
  lastAudioEventType = eventType;
}

export function getLastAudioSessionEventType(): string | null {
  return lastAudioEventType;
}

export function getInterviewWallClockStartMs(): number | null {
  return interviewWallClockStartMs;
}

/** Correlation block requested for every audio-related session_logs row. */
export function getAudioCorrelationFields(): Record<string, unknown> {
  const e = lastEnv;
  return {
    low_power_mode_active: e?.low_power_mode_active ?? false,
    thermal_state: e?.thermal_state ?? 'unknown',
    input_route: lastInputRouteLabel,
    output_route: lastOutputRouteLabel,
    bluetooth_connected: e?.bluetooth_connected ?? false,
    available_memory_mb: e?.available_memory_mb ?? null,
    low_memory_warning: e?.low_memory_warning ?? false,
    audio_session_mode: getLastAppliedAudioModeLabel(),
  };
}

function baseEventDataFields(userId: string, attemptId: string | null): Record<string, unknown> {
  const now = Date.now();
  return {
    user_id: userId,
    attempt_id: attemptId,
    device_model: deviceSnapshot.device_model,
    os_version: deviceSnapshot.os_version,
    app_version: deviceSnapshot.app_version,
    created_at: new Date(now).toISOString(),
    ...getAudioCorrelationFields(),
  };
}

/** Merge standard base + correlation keys into event-specific payload. */
export function mergeAudioSessionEventData(
  userId: string,
  attemptId: string | null,
  eventSpecific: Record<string, unknown>
): Record<string, unknown> {
  return {
    ...baseEventDataFields(userId, attemptId),
    ...eventSpecific,
  };
}

export function writeAudioSessionLog(row: SessionLogInsert): void {
  const merged: SessionLogInsert = {
    ...row,
    eventData: mergeAudioSessionEventData(row.userId, row.attemptId, row.eventData),
  };
  writeSessionLog(merged);
}

// ── Turn / TTS timing (mutable, interview-scoped) ─────────────────────────────

let lastTtsCompletionCallbackMs: number | null = null;
let recordingDelayExtraFromEarlyCutoffMs = 0;
let reAskCountThisSession = 0;
let lastWhisperRatioFlag = false;
let lastWhisperAudioDurationMs: number | null = null;
let lastWhisperWordCount: number | null = null;

export function setLastTtsCompletionCallbackMs(ts: number | null): void {
  lastTtsCompletionCallbackMs = ts;
}

export function getLastTtsCompletionCallbackMs(): number | null {
  return lastTtsCompletionCallbackMs;
}

export function addRecordingDelayExtraFromEarlyCutoffMs(ms: number): void {
  recordingDelayExtraFromEarlyCutoffMs += ms;
}

export function peekRecordingDelayExtraFromEarlyCutoffMs(): number {
  return recordingDelayExtraFromEarlyCutoffMs;
}

export function takeRecordingDelayExtraFromEarlyCutoffMs(): number {
  const v = recordingDelayExtraFromEarlyCutoffMs;
  recordingDelayExtraFromEarlyCutoffMs = 0;
  return v;
}

export function incrementReAskCountThisSession(): number {
  reAskCountThisSession += 1;
  return reAskCountThisSession;
}

export function getReAskCountThisSession(): number {
  return reAskCountThisSession;
}

export function resetAudioInterviewTurnCounters(): void {
  reAskCountThisSession = 0;
  lastWhisperRatioFlag = false;
  lastWhisperAudioDurationMs = null;
  lastWhisperWordCount = null;
}

export function setLastWhisperRatioTelemetry(flag: boolean, audioDurationMs: number | null, wordCount: number | null): void {
  lastWhisperRatioFlag = flag;
  lastWhisperAudioDurationMs = audioDurationMs;
  lastWhisperWordCount = wordCount;
}

export function getLastWhisperRatioFlag(): boolean {
  return lastWhisperRatioFlag;
}

export function getLastWhisperAudioDurationMs(): number | null {
  return lastWhisperAudioDurationMs;
}

export function getLastWhisperWordCount(): number | null {
  return lastWhisperWordCount;
}
