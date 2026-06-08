import type { GateFailDetailJson } from '@features/aria/computeGateResultCore';

/** Minimum shape for `interview_attempts.gate_fail_detail` — never persist null. */
export const EMPTY_GATE_FAIL_DETAIL_FOR_PERSIST: Record<string, unknown> = {
  psychometric_floors: {},
};

/**
 * Normalize gate_fail_detail before DB persist.
 * Ensures `psychometric_floors` is always a keyed object (never null / legacy string[]).
 */
export function normalizeGateFailDetailForPersist(
  detail: GateFailDetailJson | Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const base =
    detail != null && typeof detail === 'object' && !Array.isArray(detail)
      ? { ...(detail as Record<string, unknown>) }
      : {};
  const psych = base.psychometric_floors;
  if (psych == null || Array.isArray(psych) || typeof psych !== 'object') {
    base.psychometric_floors = {};
  }
  return base;
}
