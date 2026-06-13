export type ResponseTimingRow = {
  latency_ms?: number;
  duration_ms?: number;
};

/** Sum per-turn latency + recording duration from `interview_attempts.response_timings`. */
export function sumResponseTimingsActiveMs(
  timings: ResponseTimingRow[] | null | undefined,
): number | null {
  if (!Array.isArray(timings) || timings.length === 0) return null;
  let sum = 0;
  for (const t of timings) {
    const lat =
      typeof t.latency_ms === 'number' && Number.isFinite(t.latency_ms) ? Math.max(0, t.latency_ms) : 0;
    const dur =
      typeof t.duration_ms === 'number' && Number.isFinite(t.duration_ms)
        ? Math.max(0, t.duration_ms)
        : 0;
    sum += lat + dur;
  }
  return Number.isFinite(sum) && sum > 0 ? sum : null;
}

export function wallClockMsBetween(startIso: string, endIso: string): number | null {
  const t0 = new Date(startIso).getTime();
  const t1 = new Date(endIso).getTime();
  const ms = t1 - t0;
  return Number.isFinite(ms) && ms >= 0 ? ms : null;
}

/** Prefer active engagement time from response_timings; fall back to created_at → completed_at wall clock. */
export function computeInterviewDurationMs(attempt: {
  created_at: string;
  completed_at: string | null;
  response_timings?: ResponseTimingRow[] | null;
}): number | null {
  const activeMs = sumResponseTimingsActiveMs(attempt.response_timings ?? null);
  if (activeMs != null) return activeMs;
  if (!attempt.completed_at) return null;
  return wallClockMsBetween(attempt.created_at, attempt.completed_at);
}

export function formatDurationMsHuman(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  const mins = Math.floor(ms / 60000);
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export function averageFiniteMs(values: number[]): number | null {
  const finite = values.filter((v) => Number.isFinite(v) && v >= 0);
  if (finite.length === 0) return null;
  return finite.reduce((a, b) => a + b, 0) / finite.length;
}
