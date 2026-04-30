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
export type SessionOutputRouteLabel =
  | 'speaker'
  | 'bluetooth'
  | 'wired_headset'
  | 'airpods'
  | 'headphones'
  | 'unknown'
  | 'permission_required';
let lastOutputRouteLabel: SessionOutputRouteLabel = 'unknown';
/** Web + best-effort: headphones / BT / wired output likely in use; null = unknown (no labels / no inference). */
let lastHeadphonesConnected: boolean | null = null;
/** JSON string of last enumerated devices (audit). */
let lastDevicesAuditJson: string | null = null;
let lastActiveTrackSettings: Record<string, unknown> | null = null;
let lastHeadphoneDetectionStatus: string | null = null;
let lastEnumerateDevicesResult: string | null = null;
let lastTimeSincePermissionGrantedMs: number | null = null;
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

export function setSessionAudioRoutes(input: string, output: SessionOutputRouteLabel): void {
  lastInputRouteLabel = input;
  lastOutputRouteLabel = output;
}

function normalizeSessionOutputRoute(s: string): SessionOutputRouteLabel {
  const allowed: SessionOutputRouteLabel[] = [
    'speaker',
    'bluetooth',
    'wired_headset',
    'airpods',
    'headphones',
    'unknown',
    'permission_required',
  ];
  return allowed.includes(s as SessionOutputRouteLabel) ? (s as SessionOutputRouteLabel) : 'unknown';
}

/** Web: apply inference from `enumerateDevices` + label heuristics. */
export function setSessionAudioRoutesFromWebInference(inf: {
  input_route: string;
  output_route: string;
  headphones_connected: boolean | null;
  devices_audit: unknown;
  active_track_settings?: Record<string, unknown> | null;
  headphone_detection_status?: string | null;
  enumerate_devices_result?: string | null;
  time_since_permission_granted_ms?: number | null;
}): void {
  lastInputRouteLabel = inf.input_route;
  lastOutputRouteLabel = normalizeSessionOutputRoute(inf.output_route);
  lastHeadphonesConnected = inf.headphones_connected;
  lastDevicesAuditJson =
    inf.devices_audit === undefined || inf.devices_audit === null
      ? JSON.stringify([])
      : JSON.stringify(inf.devices_audit);
  lastActiveTrackSettings =
    inf.active_track_settings != null ? { ...inf.active_track_settings } : null;
  lastHeadphoneDetectionStatus = inf.headphone_detection_status ?? null;
  lastEnumerateDevicesResult = inf.enumerate_devices_result ?? null;
  lastTimeSincePermissionGrantedMs = inf.time_since_permission_granted_ms ?? null;
}

export function getSessionAudioRoutesSnapshot(): {
  input_route: string;
  output_route: SessionOutputRouteLabel;
  headphones_connected: boolean | null;
} {
  return {
    input_route: lastInputRouteLabel,
    output_route: lastOutputRouteLabel,
    headphones_connected: lastHeadphonesConnected,
  };
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
    /** Same as `output_route` — explicit alias for TTS / playback telemetry. */
    audio_output_route: lastOutputRouteLabel,
    headphones_connected: lastHeadphonesConnected,
    /** Raw JSON array from last enumerateDevices audit (may be `[]`); never omit when web inference ran. */
    audio_devices_enumerated_json: lastDevicesAuditJson ?? JSON.stringify([]),
    active_track_settings: lastActiveTrackSettings,
    headphone_detection_status: lastHeadphoneDetectionStatus,
    enumerate_devices_result: lastEnumerateDevicesResult,
    time_since_permission_granted_ms: lastTimeSincePermissionGrantedMs,
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
  const base = baseEventDataFields(userId, attemptId) as Record<string, unknown>;
  return {
    ...base,
    ...eventSpecific,
    // Per-event payloads must not be able to null out session denorm fields.
    device_model: base.device_model,
    os_version: base.os_version,
    app_version: base.app_version,
    available_memory_mb: base.available_memory_mb ?? null,
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
