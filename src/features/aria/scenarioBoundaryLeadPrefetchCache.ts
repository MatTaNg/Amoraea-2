import type { ScenarioBoundaryLeadSource } from '@features/aria/resolveScenarioBoundaryLeadForInterview';

export type CachedScenarioBoundaryLead = {
  completedScenario: 1 | 2 | 3;
  lead: string;
  source: ScenarioBoundaryLeadSource;
  userCorpus: string;
  fetchedAtMs: number;
};

const cache = new Map<string, CachedScenarioBoundaryLead>();

export function scenarioBoundaryLeadCacheKey(
  interviewSessionId: string | null | undefined,
  completedScenario: 1 | 2 | 3,
): string {
  return `${interviewSessionId ?? 'anon'}:${completedScenario}`;
}

export function getCachedScenarioBoundaryLead(
  interviewSessionId: string | null | undefined,
  completedScenario: 1 | 2 | 3,
  userCorpus: string,
): CachedScenarioBoundaryLead | null {
  const entry = cache.get(scenarioBoundaryLeadCacheKey(interviewSessionId, completedScenario));
  if (!entry) return null;
  if (entry.userCorpus.trim() !== userCorpus.trim()) return null;
  if (Date.now() - entry.fetchedAtMs > 120_000) return null;
  return entry;
}

export function setCachedScenarioBoundaryLead(
  interviewSessionId: string | null | undefined,
  entry: CachedScenarioBoundaryLead,
): void {
  cache.set(scenarioBoundaryLeadCacheKey(interviewSessionId, entry.completedScenario), entry);
}

export function clearCachedScenarioBoundaryLead(
  interviewSessionId: string | null | undefined,
  completedScenario?: 1 | 2 | 3,
): void {
  if (completedScenario != null) {
    cache.delete(scenarioBoundaryLeadCacheKey(interviewSessionId, completedScenario));
    return;
  }
  const prefix = `${interviewSessionId ?? 'anon'}:`;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}

/** @internal test hook */
export function resetScenarioBoundaryLeadPrefetchCacheForTests(): void {
  cache.clear();
}
