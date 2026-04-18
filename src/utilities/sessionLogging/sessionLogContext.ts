/**
 * Mutable session-scoped context for correlating logs (attempt id, question timing, recording/TTS overlap).
 * Updated from AriaScreen; read by logging helpers.
 */
import type { SessionPlatform } from './writeSessionLog';

export type SessionLogRuntimeContext = {
  sessionCorrelationId: string;
  attemptId: string | null;
  /** After a successful interview attempt row is created, logs should include attempt_id — dev guard if missing. */
  sessionLogsRequireAttemptId: boolean;
  platform: SessionPlatform | null;
  /** ISO timestamp of last assistant question delivery (for latency). */
  lastQuestionDeliveredAt: string | null;
  /** True while Whisper/native recording pipeline is active (set around transcribe / recorder). */
  recordingSessionActive: boolean;
  /** True while interviewer TTS is expected to be playing (best-effort). */
  ttsPlaybackActive: boolean;
  currentMomentNumber: number | null;
  lastActivityAtMs: number;
  /** Set when user backgrounds or hides tab (web). */
  lastHiddenAtMs: number | null;
  navigationAwayAtMs: number | null;
};

const ctx: SessionLogRuntimeContext = {
  sessionCorrelationId: '',
  attemptId: null,
  sessionLogsRequireAttemptId: false,
  platform: null,
  lastQuestionDeliveredAt: null,
  recordingSessionActive: false,
  ttsPlaybackActive: false,
  currentMomentNumber: null,
  lastActivityAtMs: Date.now(),
  lastHiddenAtMs: null,
  navigationAwayAtMs: null,
};

export function resetSessionLogRuntime(partial?: Partial<SessionLogRuntimeContext>): void {
  ctx.sessionCorrelationId = partial?.sessionCorrelationId ?? ctx.sessionCorrelationId;
  ctx.attemptId = partial?.attemptId ?? null;
  ctx.sessionLogsRequireAttemptId = partial?.sessionLogsRequireAttemptId ?? false;
  ctx.platform = partial?.platform ?? ctx.platform;
  ctx.lastQuestionDeliveredAt = partial?.lastQuestionDeliveredAt ?? null;
  ctx.recordingSessionActive = partial?.recordingSessionActive ?? false;
  ctx.ttsPlaybackActive = partial?.ttsPlaybackActive ?? false;
  ctx.currentMomentNumber = partial?.currentMomentNumber ?? null;
  ctx.lastActivityAtMs = Date.now();
  ctx.lastHiddenAtMs = partial?.lastHiddenAtMs ?? null;
  ctx.navigationAwayAtMs = partial?.navigationAwayAtMs ?? null;
}

export function getSessionLogRuntime(): Readonly<SessionLogRuntimeContext> {
  return ctx;
}

export function setSessionLogAttemptId(attemptId: string | null): void {
  ctx.attemptId = attemptId;
}

export function setSessionLogsRequireAttemptId(require: boolean): void {
  ctx.sessionLogsRequireAttemptId = require;
}

export function setSessionLogPlatform(platform: SessionPlatform | null): void {
  ctx.platform = platform;
}

export function setSessionCorrelationId(id: string): void {
  ctx.sessionCorrelationId = id;
}

export function markQuestionDelivered(isoTime: string): void {
  ctx.lastQuestionDeliveredAt = isoTime;
}

export function setRecordingSessionActive(active: boolean): void {
  ctx.recordingSessionActive = active;
}

export function setTtsPlaybackActive(active: boolean): void {
  ctx.ttsPlaybackActive = active;
}

export function setCurrentMomentNumber(n: number | null): void {
  ctx.currentMomentNumber = n;
}

export function touchActivity(): void {
  ctx.lastActivityAtMs = Date.now();
}

export function setLastHiddenAtMs(t: number | null): void {
  ctx.lastHiddenAtMs = t;
}

export function setNavigationAwayAtMs(t: number | null): void {
  ctx.navigationAwayAtMs = t;
}
