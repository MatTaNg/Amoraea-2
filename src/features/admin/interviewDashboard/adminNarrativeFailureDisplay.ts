export type AdminNarrativeFailureKind = 'timeout' | 'race_condition' | 'other';

export type AdminNarrativeFailureEvent = {
  at: string | null;
  error: string;
  kind: AdminNarrativeFailureKind;
  source: 'last_error' | 'retry_error';
};

function classifyNarrativeError(error: string): AdminNarrativeFailureKind {
  const normalized = error.toLowerCase();
  if (normalized.includes('idle_timeout') || normalized.includes('timeout')) return 'timeout';
  if (normalized.includes('missing_pillar_scores')) return 'race_condition';
  return 'other';
}

export function adminNarrativeFailureKindLabel(kind: AdminNarrativeFailureKind): string {
  if (kind === 'timeout') return 'Timeout failure';
  if (kind === 'race_condition') return 'Race condition (pillar scores not ready)';
  return 'Generation failure';
}

export function parseAdminNarrativeFailureTimeline(
  reasoning: Record<string, unknown> | null,
): {
  failed: boolean;
  events: AdminNarrativeFailureEvent[];
  primaryKind: AdminNarrativeFailureKind | null;
  primaryError: string | null;
} {
  if (!reasoning) {
    return { failed: false, events: [], primaryKind: null, primaryError: null };
  }

  const narrativeFailed = reasoning._narrativeFailed === true;
  const generationFailed = reasoning._generationFailed === true;
  const events: AdminNarrativeFailureEvent[] = [];

  const pushEvent = (
    errorRaw: unknown,
    atRaw: unknown,
    source: AdminNarrativeFailureEvent['source'],
  ) => {
    if (typeof errorRaw !== 'string' || !errorRaw.trim()) return;
    const error = errorRaw.trim();
    events.push({
      at: typeof atRaw === 'string' && atRaw.trim() ? atRaw.trim() : null,
      error,
      kind: classifyNarrativeError(error),
      source,
    });
  };

  pushEvent(reasoning.last_error, reasoning.failed_at, 'last_error');
  pushEvent(reasoning._lastRetryError, reasoning._lastRetryFailedAt, 'retry_error');

  const failed = narrativeFailed || generationFailed || events.length > 0;
  const primary = events[events.length - 1] ?? null;

  return {
    failed,
    events,
    primaryKind: primary?.kind ?? null,
    primaryError: primary?.error ?? null,
  };
}
