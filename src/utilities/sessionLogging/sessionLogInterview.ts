import { writeSessionLog, type SessionPlatform } from './writeSessionLog';
import {
  getSessionLogRuntime,
  setSessionLogAttemptId,
  touchActivity,
} from './sessionLogContext';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';

/** Must not be named `__DEV__` — that shadows the Metro global and throws TDZ ("before initialization"). */
const isDevBundle = typeof __DEV__ !== 'undefined' && __DEV__;

type Base = {
  userId: string;
  attemptId: string | null;
  platform: SessionPlatform | null;
};

export function logTouchActivityForPause(base: Base, momentNumber: number | null): void {
  const ctx = getSessionLogRuntime();
  const now = Date.now();
  const gap = now - ctx.lastActivityAtMs;
  touchActivity();
  const maxGap = 60 * 60 * 1000;
  if (gap > 60_000 && gap < maxGap && momentNumber != null && base.userId) {
    writeSessionLog({
      userId: base.userId,
      attemptId: base.attemptId,
      eventType: 'session_pause',
      eventData: {
        pause_duration_ms: gap,
        moment_number: momentNumber,
      },
      durationMs: gap,
      error: null,
      platform: base.platform,
    });
  }
}

export function assignAttemptIdForSessionLogs(attemptId: string | null): void {
  setSessionLogAttemptId(attemptId);
}

/** After gate scoring — log floor breach, null pillar scores, weighted vs mean inflation. */
export function logGateAnalyticsToSession(params: {
  base: Base;
  gateReason: string;
  failingConstruct: string | null;
  failingScore: number | null;
  weightedScore: number | null;
  pillarScores: Record<string, number | null | undefined>;
}): void {
  const { base, gateReason, failingConstruct, failingScore, weightedScore, pillarScores } = params;
  if (!base.userId) return;

  if (gateReason === 'floor_breach' && failingConstruct != null && failingScore != null) {
    writeSessionLog({
      userId: base.userId,
      attemptId: base.attemptId,
      eventType: 'floor_breach_detected',
      eventData: { construct: failingConstruct, score: failingScore },
      durationMs: null,
      error: null,
      platform: base.platform,
    });
  }

  for (const id of INTERVIEW_MARKER_IDS) {
    const v = pillarScores[id];
    if (v === null) {
      writeSessionLog({
        userId: base.userId,
        attemptId: base.attemptId,
        eventType: 'null_score_produced',
        eventData: { construct: id, moment: 'full_interview', reason: 'marker_null_in_model_output' },
        durationMs: null,
        error: null,
        platform: base.platform,
      });
    }
  }

  const assessed = INTERVIEW_MARKER_IDS.filter(
    (id) => typeof pillarScores[id] === 'number' && Number.isFinite(pillarScores[id] as number) && (pillarScores[id] as number) > 0
  );
  if (assessed.length > 0 && weightedScore != null) {
    const sum = assessed.reduce((s, id) => s + (pillarScores[id] as number), 0);
    const mean = sum / assessed.length;
    if (weightedScore > mean + 0.0001) {
      writeSessionLog({
        userId: base.userId,
        attemptId: base.attemptId,
        eventType: 'weighted_score_inflation',
        eventData: {
          weighted_score: weightedScore,
          component_mean: Math.round(mean * 1000) / 1000,
        },
        durationMs: null,
        error: null,
        platform: base.platform,
      });
    }
  }
}

export function logProbeEvent(
  base: Base,
  kind: 'probe_fired' | 'probe_suppressed',
  payload: { construct: string; scenario: number | string; trigger_reason: string }
): void {
  if (!base.userId) return;
  writeSessionLog({
    userId: base.userId,
    attemptId: base.attemptId,
    eventType: kind,
    eventData: payload,
    durationMs: null,
    error: null,
    platform: base.platform,
  });
}

export function logCommunicationStylePipelineOutcome(
  base: Base,
  outcome: {
    source_attempt_id: string;
    matchmaker_summary_generated: boolean;
    matchmaker_summary_length: number;
    pipeline_error: string | null;
  }
): void {
  if (!base.userId) return;
  writeSessionLog({
    userId: base.userId,
    attemptId: base.attemptId,
    eventType: 'communication_style_record_written',
    eventData: {
      source_attempt_id: outcome.source_attempt_id,
      matchmaker_summary_generated: outcome.matchmaker_summary_generated,
      matchmaker_summary_length: outcome.matchmaker_summary_length,
      pipeline_error: outcome.pipeline_error,
    },
    durationMs: null,
    error: outcome.pipeline_error,
    platform: base.platform,
  });
}

if (isDevBundle) {
  void 0;
}
